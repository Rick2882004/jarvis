import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AssistantState } from '../types/assistant';

interface StatusBadgeProps {
  state: AssistantState;
  errorMessage?: string | null;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ state, errorMessage }) => {
  const getStatusConfig = () => {
    switch (state) {
      case 'listening':
        return {
          text: 'LISTENING',
          detail: 'Listening for voice input...',
          dotClass: 'bg-cyan-400 animate-pulse',
          badgeClass: 'border-cyan-500/40 text-cyan-300 bg-cyan-950/40',
        };
      case 'thinking':
        return {
          text: 'THINKING',
          detail: 'Processing neural response...',
          dotClass: 'bg-purple-400 animate-ping',
          badgeClass: 'border-purple-500/40 text-purple-300 bg-purple-950/40',
        };
      case 'speaking':
        return {
          text: 'SPEAKING',
          detail: 'Spoken output active',
          dotClass: 'bg-blue-400 animate-pulse',
          badgeClass: 'border-blue-500/40 text-blue-300 bg-blue-950/40',
        };
      case 'error':
        return {
          text: 'SYSTEM ERROR',
          detail: errorMessage || 'An unexpected error occurred.',
          dotClass: 'bg-red-500 animate-ping',
          badgeClass: 'border-red-500/50 text-red-300 bg-red-950/40',
        };
      case 'idle':
      default:
        return {
          text: 'STANDING BY',
          detail: 'Jarvis Core Ready',
          dotClass: 'bg-emerald-400/80',
          badgeClass: 'border-slate-700/60 text-slate-400 bg-slate-900/50',
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className="flex flex-col items-center justify-center gap-1.5 z-20">
      <AnimatePresence mode="wait">
        <motion.div
          key={state}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.25 }}
          className={`inline-flex items-center gap-2 px-3.5 py-1 rounded-full border text-xs font-mono tracking-widest uppercase glass-pill ${config.badgeClass}`}
        >
          <span className={`w-2 h-2 rounded-full ${config.dotClass}`} />
          <span>{config.text}</span>
        </motion.div>
      </AnimatePresence>

      <p className="text-xs text-slate-500 font-mono tracking-wide">
        {config.detail}
      </p>
    </div>
  );
};
