import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Square, Volume2, VolumeX, Keyboard, Settings, Send } from 'lucide-react';
import { AssistantState } from '../types/assistant';

interface ControlPanelProps {
  state: AssistantState;
  isMicSupported: boolean;
  audioFeedbackEnabled: boolean;
  onToggleMic: () => void;
  onInterrupt: () => void;
  onToggleAudioFeedback: () => void;
  onOpenSettings: () => void;
  onSendText: (text: string) => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  state,
  isMicSupported,
  audioFeedbackEnabled,
  onToggleMic,
  onInterrupt,
  onToggleAudioFeedback,
  onOpenSettings,
  onSendText,
}) => {
  const [showTextInput, setShowTextInput] = useState(false);
  const [textValue, setTextValue] = useState('');

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (textValue.trim()) {
      onSendText(textValue.trim());
      setTextValue('');
      setShowTextInput(false);
    }
  };

  const isListening = state === 'listening';
  const isSpeaking = state === 'speaking';

  return (
    <div className="fixed bottom-8 left-0 right-0 flex flex-col items-center justify-center gap-3 px-4 z-30 pointer-events-auto">
      {/* Optional Text Input Drawer */}
      <AnimatePresence>
        {showTextInput && (
          <motion.form
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            onSubmit={handleTextSubmit}
            className="glass-panel px-3 py-2 rounded-full border border-slate-700/60 flex items-center gap-2 w-full max-w-md shadow-2xl"
          >
            <input
              type="text"
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              placeholder="Type a message to Jarvis..."
              autoFocus
              className="bg-transparent text-sm text-slate-100 placeholder-slate-500 px-3 py-1.5 focus:outline-none w-full font-sans"
            />
            <button
              type="submit"
              disabled={!textValue.trim()}
              className="p-2 rounded-full bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 transition-colors"
              aria-label="Send message"
            >
              <Send size={16} />
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Main Glass Control Toolbar */}
      <div className="glass-pill px-4 py-2.5 rounded-full flex items-center gap-3 border border-slate-800/80 shadow-2xl">
        {/* Toggle Audio SFX */}
        <button
          onClick={onToggleAudioFeedback}
          className={`p-2.5 rounded-full transition-all duration-200 ${
            audioFeedbackEnabled
              ? 'text-slate-300 hover:text-cyan-400 hover:bg-slate-800/60'
              : 'text-slate-600 hover:text-slate-400 hover:bg-slate-800/40'
          }`}
          title={audioFeedbackEnabled ? 'Audio Chimes Enabled' : 'Audio Chimes Muted'}
          aria-label="Toggle Sound Effects"
        >
          {audioFeedbackEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>

        {/* Text Input Toggle */}
        <button
          onClick={() => setShowTextInput((prev) => !prev)}
          className={`p-2.5 rounded-full transition-all duration-200 ${
            showTextInput
              ? 'text-cyan-400 bg-cyan-950/40 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
          title="Toggle Text Input Fallback"
          aria-label="Toggle Text Keyboard Input"
        >
          <Keyboard size={18} />
        </button>

        {/* PRIMARY MICROPHONE BUTTON */}
        <div className="relative flex items-center justify-center mx-1">
          {/* Interruption indicator / Listening pulse */}
          {isListening && (
            <span className="absolute inset-0 rounded-full bg-cyan-400/40 animate-ping pointer-events-none" />
          )}

          {isSpeaking ? (
            <button
              onClick={onInterrupt}
              className="relative z-10 px-5 py-2.5 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium text-xs font-mono tracking-wider flex items-center gap-2 shadow-lg shadow-amber-500/25 transition-all active:scale-95"
              title="Interrupt Jarvis Speech (Or press Space)"
              aria-label="Interrupt Jarvis Speech"
            >
              <Square size={14} fill="currentColor" />
              <span>INTERRUPT</span>
            </button>
          ) : (
            <button
              onClick={onToggleMic}
              disabled={!isMicSupported}
              className={`relative z-10 p-3.5 rounded-full font-medium transition-all duration-300 flex items-center justify-center shadow-lg active:scale-95 ${
                !isMicSupported
                  ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                  : isListening
                  ? 'bg-cyan-400 text-slate-950 shadow-cyan-400/50 scale-105'
                  : 'bg-slate-800/90 hover:bg-slate-700 text-cyan-400 border border-cyan-500/30 hover:border-cyan-400'
              }`}
              title={
                !isMicSupported
                  ? 'Speech Recognition unsupported in this browser'
                  : isListening
                  ? 'Stop Listening (Space)'
                  : 'Activate Microphone (Space)'
              }
              aria-label={isListening ? 'Deactivate Microphone' : 'Activate Microphone'}
            >
              {isListening ? <Mic size={22} className="animate-pulse" /> : <MicOff size={22} />}
            </button>
          )}
        </div>

        {/* Settings & Diagnostic Modal Button */}
        <button
          onClick={onOpenSettings}
          className="p-2.5 rounded-full text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all duration-200"
          title="System Settings & Diagnostics"
          aria-label="Open System Settings"
        >
          <Settings size={18} />
        </button>
      </div>

      {/* Keyboard Shortcut Hint */}
      <p className="text-[11px] text-slate-600 font-mono tracking-wider">
        PRESS <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">SPACE</kbd> TO TALK / INTERRUPT
      </p>
    </div>
  );
};
