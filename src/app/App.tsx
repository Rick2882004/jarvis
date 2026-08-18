import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, RefreshCw, Radio } from 'lucide-react';
import { useJarvisAssistant } from '../features/assistant/hooks/useJarvisAssistant';
import { JarvisCoreOrb } from '../features/assistant/components/JarvisCoreOrb';
import { StatusBadge } from '../features/assistant/components/StatusBadge';
import { TranscriptHUD } from '../features/assistant/components/TranscriptHUD';
import { ControlPanel } from '../features/assistant/components/ControlPanel';
import { SettingsModal } from '../features/assistant/components/SettingsModal';

export const App: React.FC = () => {
  const {
    assistantState,
    session,
    activeTranscript,
    latestResponse,
    errorMessage,
    voices,
    isMicSupported,
    isTtsSupported,
    audioFeedbackEnabled,
    activateMicrophone,
    interruptSpeaking,
    resetError,
    toggleAudioFeedback,
    setVoice,
    sendTextMessage,
    aiProviderName,
  } = useJarvisAssistant();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Global Keyboard Shortcuts (Space to talk/interrupt, Esc to cancel/reset)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore key events when user is typing inside input elements
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        activateMicrophone();
      } else if (e.code === 'Escape') {
        e.preventDefault();
        if (assistantState === 'speaking') {
          interruptSpeaking();
        } else if (assistantState === 'error') {
          resetError();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activateMicrophone, interruptSpeaking, resetError, assistantState]);

  return (
    <div className="relative min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col items-center justify-between overflow-hidden jarvis-bg-gradient">
      {/* Background Futuristic Grid Overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:32px_32px] opacity-20 pointer-events-none" />

      {/* TOP HUD HEADER */}
      <header className="w-full max-w-7xl px-6 py-6 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-lg shadow-cyan-400/50" />
          <h1 className="font-display font-black tracking-widest text-lg sm:text-xl text-slate-100 flex items-center gap-2">
            <span>JARVIS</span>
            <span className="text-xs font-mono text-cyan-400 font-normal px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/30">
              CORE v1.0
            </span>
          </h1>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full glass-pill border border-slate-800 text-slate-400">
            <Radio size={14} className="text-emerald-400" />
            <span>SYSTEM ONLINE</span>
          </div>

          <button
            onClick={() => setIsSettingsOpen(true)}
            className="px-3.5 py-1.5 rounded-full glass-pill border border-slate-700/60 hover:border-cyan-500/40 text-slate-300 hover:text-cyan-400 transition-all"
          >
            DIAGNOSTICS
          </button>
        </div>
      </header>

      {/* CENTER STAGE: THE JARVIS CORE */}
      <main className="flex-1 w-full flex flex-col items-center justify-center relative px-4 z-10">
        {/* Unsupported Browser Alert Banner */}
        {!isMicSupported && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 max-w-md glass-panel p-4 rounded-2xl border border-amber-500/40 text-amber-300 text-xs font-mono flex items-start gap-3"
          >
            <AlertCircle size={18} className="shrink-0 text-amber-400 mt-0.5" />
            <div>
              <p className="font-semibold mb-0.5">Microphone Recognition Unsupported</p>
              <p className="text-amber-400/80">
                Your current browser does not support the Web Speech API. You can still test Jarvis using the keyboard input button in the toolbar below.
              </p>
            </div>
          </motion.div>
        )}

        {/* Central State Indicator Badge */}
        <StatusBadge state={assistantState} errorMessage={errorMessage} />

        {/* The Animated Jarvis Core Orb */}
        <JarvisCoreOrb state={assistantState} onClick={activateMicrophone} />

        {/* Dynamic Live Transcript / Subtitle HUD */}
        <TranscriptHUD
          state={assistantState}
          activeTranscript={activeTranscript}
          latestResponse={latestResponse}
        />

        {/* Error Recovery Overlay */}
        {assistantState === 'error' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-3 flex items-center gap-3 z-30"
          >
            <button
              onClick={resetError}
              className="px-4 py-2 rounded-full bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 text-xs font-mono flex items-center gap-2 transition-colors"
            >
              <RefreshCw size={14} />
              <span>RECOVER SYSTEM STATE</span>
            </button>
          </motion.div>
        )}
      </main>

      {/* FLOATING GLASS CONTROL TOOLBAR */}
      <ControlPanel
        state={assistantState}
        isMicSupported={isMicSupported}
        audioFeedbackEnabled={audioFeedbackEnabled}
        onToggleMic={activateMicrophone}
        onInterrupt={interruptSpeaking}
        onToggleAudioFeedback={toggleAudioFeedback}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onSendText={sendTextMessage}
      />

      {/* SYSTEM DIAGNOSTICS & SETTINGS MODAL */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        voices={voices}
        selectedVoiceId={session.selectedVoiceId}
        onSelectVoice={setVoice}
        aiProviderName={aiProviderName}
        isMicSupported={isMicSupported}
        isTtsSupported={isTtsSupported}
      />
    </div>
  );
};
