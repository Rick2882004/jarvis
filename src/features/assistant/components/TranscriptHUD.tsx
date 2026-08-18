import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AssistantState } from '../types/assistant';

interface TranscriptHUDProps {
  state: AssistantState;
  activeTranscript: string;
  latestResponse: string;
}

export const TranscriptHUD: React.FC<TranscriptHUDProps> = ({
  state,
  activeTranscript,
  latestResponse,
}) => {
  return (
    <div className="w-full max-w-xl min-h-[90px] flex items-center justify-center text-center px-6 py-3 my-2 z-20">
      <AnimatePresence mode="wait">
        {state === 'listening' && (
          <motion.div
            key="listening-transcript"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="glass-panel px-5 py-3 rounded-2xl border border-cyan-500/20 max-w-full"
          >
            <p className="text-xs text-cyan-400 font-mono mb-1 uppercase tracking-wider">
              YOU ARE SAYING:
            </p>
            <p className="text-base text-slate-100 font-medium italic">
              {activeTranscript ? `"${activeTranscript}"` : 'Listening for your voice...'}
            </p>
          </motion.div>
        )}

        {state === 'thinking' && (
          <motion.div
            key="thinking-transcript"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="text-slate-400 text-sm font-mono flex items-center gap-2"
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping" />
            <span>Analyzing query: "{activeTranscript}"</span>
          </motion.div>
        )}

        {(state === 'speaking' || (state === 'idle' && latestResponse)) && (
          <motion.div
            key="speaking-response"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="glass-panel px-6 py-3.5 rounded-2xl border border-blue-500/20 max-w-full"
          >
            <p className="text-xs text-blue-400 font-mono mb-1 uppercase tracking-wider flex items-center justify-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              JARVIS RESPONSE:
            </p>
            <p className="text-base sm:text-lg text-slate-100 font-normal leading-relaxed">
              "{latestResponse}"
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
