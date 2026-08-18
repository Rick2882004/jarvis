import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mic, Volume2, Cpu, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { SpeechVoiceOption } from '../../voice/types/voice';
import { webPlatformAdapter } from '../../../platform/web/WebPlatformAdapter';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  voices: SpeechVoiceOption[];
  selectedVoiceId: string | null;
  onSelectVoice: (voiceId: string) => void;
  aiProviderName: string;
  isMicSupported: boolean;
  isTtsSupported: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  voices,
  selectedVoiceId,
  onSelectVoice,
  aiProviderName,
  isMicSupported,
  isTtsSupported,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative z-10 w-full max-w-lg glass-panel p-6 rounded-3xl border border-slate-700/80 shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-950/60 border border-cyan-500/30 text-cyan-400">
                  <Cpu size={20} />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-100 font-display tracking-wide">
                    JARVIS SYSTEM DIAGNOSTICS
                  </h2>
                  <p className="text-xs text-slate-400 font-mono">Phase 1 Architecture Status</p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-2 rounded-full text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
                aria-label="Close settings"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="py-5 space-y-5 text-sm">
              {/* Platform Engine */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-900/60 border border-slate-800">
                <div className="flex items-center gap-3">
                  <ShieldCheck size={18} className="text-emerald-400" />
                  <div>
                    <p className="font-medium text-slate-200 text-xs font-mono">PLATFORM LAYER</p>
                    <p className="text-xs text-slate-400">
                      Engine: <span className="text-slate-200">{webPlatformAdapter.platformName().toUpperCase()}</span>
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
                  CONNECTED
                </span>
              </div>

              {/* Speech Recognition Status */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-900/60 border border-slate-800">
                <div className="flex items-center gap-3">
                  <Mic size={18} className={isMicSupported ? 'text-cyan-400' : 'text-amber-400'} />
                  <div>
                    <p className="font-medium text-slate-200 text-xs font-mono">VOICE INPUT ADAPTER</p>
                    <p className="text-xs text-slate-400">
                      Engine: <span className="text-slate-200">Web Speech Recognition</span>
                    </p>
                  </div>
                </div>
                {isMicSupported ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2.5 py-1 rounded-full bg-cyan-950/60 text-cyan-400 border border-cyan-500/30">
                    <CheckCircle2 size={12} /> READY
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2.5 py-1 rounded-full bg-amber-950/60 text-amber-400 border border-amber-500/30">
                    <AlertTriangle size={12} /> UNSUPPORTED
                  </span>
                )}
              </div>

              {/* Speech Synthesis Voice Selection */}
              <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Volume2 size={18} className={isTtsSupported ? 'text-blue-400' : 'text-slate-500'} />
                    <div>
                      <p className="font-medium text-slate-200 text-xs font-mono">VOICE OUTPUT ADAPTER</p>
                      <p className="text-xs text-slate-400">Engine: SpeechSynthesis</p>
                    </div>
                  </div>
                </div>

                {isTtsSupported && voices.length > 0 && (
                  <div className="pt-1">
                    <label htmlFor="voice-select" className="text-[11px] font-mono text-slate-400 block mb-1">
                      SELECT SYNTHESIS VOICE:
                    </label>
                    <select
                      id="voice-select"
                      value={selectedVoiceId || ''}
                      onChange={(e) => onSelectVoice(e.target.value)}
                      className="w-full bg-slate-950 text-xs text-slate-200 border border-slate-700 rounded-xl px-3 py-2 focus:outline-none focus:border-cyan-500 font-mono"
                    >
                      <option value="">Default Natural Voice</option>
                      {voices.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} ({v.lang})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* AI Provider */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-900/60 border border-slate-800">
                <div className="flex items-center gap-3">
                  <Cpu size={18} className="text-purple-400" />
                  <div>
                    <p className="font-medium text-slate-200 text-xs font-mono">AI PROVIDER ABSTRACTION</p>
                    <p className="text-xs text-slate-400">
                      Active: <span className="text-purple-300 font-semibold">{aiProviderName}</span>
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-purple-950/60 text-purple-300 border border-purple-500/30">
                  SECURE MOCK
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500 font-mono">
              <span>SECURITY: NO API KEYS EXPOSED</span>
              <button
                onClick={onClose}
                className="px-4 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
