import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AssistantState } from '../types/assistant';

interface JarvisCoreOrbProps {
  state: AssistantState;
  onClick?: () => void;
}

export const JarvisCoreOrb: React.FC<JarvisCoreOrbProps> = ({ state, onClick }) => {
  // Theme parameters based on state
  const getTheme = () => {
    switch (state) {
      case 'listening':
        return {
          coreColor: '#00F0FF',
          outerGlow: 'rgba(0, 240, 255, 0.4)',
          ringColor: 'rgba(0, 240, 255, 0.6)',
          particleColor: '#00F0FF',
          label: 'LISTENING',
        };
      case 'thinking':
        return {
          coreColor: '#A855F7', // Violet
          outerGlow: 'rgba(168, 85, 247, 0.4)',
          ringColor: 'rgba(234, 179, 8, 0.6)', // Gold accent
          particleColor: '#EC4899',
          label: 'THINKING',
        };
      case 'speaking':
        return {
          coreColor: '#3B82F6', // Vibrant Blue
          outerGlow: 'rgba(59, 130, 246, 0.45)',
          ringColor: 'rgba(0, 240, 255, 0.7)',
          particleColor: '#60A5FA',
          label: 'SPEAKING',
        };
      case 'error':
        return {
          coreColor: '#EF4444', // Red
          outerGlow: 'rgba(239, 68, 68, 0.4)',
          ringColor: 'rgba(239, 68, 68, 0.5)',
          particleColor: '#F87171',
          label: 'ERROR',
        };
      case 'idle':
      default:
        return {
          coreColor: '#06B6D4', // Calm Cyan
          outerGlow: 'rgba(6, 182, 212, 0.25)',
          ringColor: 'rgba(255, 255, 255, 0.15)',
          particleColor: '#22D3EE',
          label: 'STANDBY',
        };
    }
  };

  const theme = getTheme();

  return (
    <div
      onClick={onClick}
      className="relative flex items-center justify-center cursor-pointer group select-none my-8"
      style={{ width: 320, height: 320 }}
      role="button"
      aria-label={`Jarvis Core - Current State: ${state}. Click to toggle microphone.`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      {/* Outer ambient glow backlight */}
      <motion.div
        className="absolute inset-0 rounded-full filter blur-3xl opacity-60 pointer-events-none transition-all duration-700"
        style={{
          background: `radial-gradient(circle, ${theme.outerGlow} 0%, transparent 70%)`,
        }}
        animate={{
          scale: state === 'listening' ? [1, 1.25, 1] : state === 'speaking' ? [1, 1.18, 1] : [1, 1.08, 1],
          opacity: state === 'thinking' ? [0.4, 0.8, 0.4] : 0.6,
        }}
        transition={{
          duration: state === 'thinking' ? 1.5 : 3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* State: LISTENING - Concentric audio ripple rings */}
      {state === 'listening' && (
        <>
          {[1, 2, 3].map((ringIndex) => (
            <motion.div
              key={`ripple-${ringIndex}`}
              className="absolute border border-cyan-400/40 rounded-full pointer-events-none"
              initial={{ width: 140, height: 140, opacity: 0.8 }}
              animate={{
                width: [140, 360],
                height: [140, 360],
                opacity: [0.8, 0],
              }}
              transition={{
                duration: 2.2,
                repeat: Infinity,
                delay: (ringIndex - 1) * 0.7,
                ease: 'easeOut',
              }}
            />
          ))}
        </>
      )}

      {/* State: SPEAKING - Dynamic wave ripples */}
      {state === 'speaking' && (
        <>
          {[1, 2].map((ringIndex) => (
            <motion.div
              key={`speak-ripple-${ringIndex}`}
              className="absolute border border-blue-400/40 rounded-full pointer-events-none"
              initial={{ width: 160, height: 160, opacity: 0.7 }}
              animate={{
                width: [160, 320],
                height: [160, 320],
                opacity: [0.7, 0],
              }}
              transition={{
                duration: 1.6,
                repeat: Infinity,
                delay: (ringIndex - 1) * 0.8,
                ease: 'easeOut',
              }}
            />
          ))}
        </>
      )}

      {/* Orbital Ring 1: Outer Dotted HUD Ring */}
      <motion.svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 320 320"
        animate={{
          rotate: state === 'thinking' ? 360 : state === 'listening' ? -360 : 360,
        }}
        transition={{
          duration: state === 'thinking' ? 10 : state === 'listening' ? 18 : 35,
          repeat: Infinity,
          ease: 'linear',
        }}
      >
        <circle
          cx="160"
          cy="160"
          r="145"
          fill="none"
          stroke={theme.ringColor}
          strokeWidth="1.5"
          strokeDasharray="6 14"
        />
      </motion.svg>

      {/* Orbital Ring 2: Medium Tech Arc Ring */}
      <motion.svg
        className="absolute w-[250px] h-[250px] pointer-events-none"
        viewBox="0 0 250 250"
        animate={{
          rotate: state === 'thinking' ? -360 : 360,
        }}
        transition={{
          duration: state === 'thinking' ? 6 : 22,
          repeat: Infinity,
          ease: 'linear',
        }}
      >
        <circle
          cx="125"
          cy="125"
          r="115"
          fill="none"
          stroke={theme.ringColor}
          strokeWidth="2"
          strokeDasharray="90 35 15 35"
        />
      </motion.svg>

      {/* Orbital Ring 3: Inner Fast Quantum Ring */}
      <motion.svg
        className="absolute w-[190px] h-[190px] pointer-events-none"
        viewBox="0 0 190 190"
        animate={{
          rotate: state === 'thinking' ? 360 : -360,
        }}
        transition={{
          duration: state === 'thinking' ? 3 : 14,
          repeat: Infinity,
          ease: 'linear',
        }}
      >
        <circle
          cx="95"
          cy="95"
          r="85"
          fill="none"
          stroke={theme.coreColor}
          strokeWidth="2.5"
          strokeDasharray="40 20 80 20"
          opacity="0.75"
        />
      </motion.svg>

      {/* Core Plasma Sphere (Center) */}
      <motion.div
        className="relative z-10 rounded-full flex items-center justify-center transition-shadow duration-500"
        style={{
          width: 120,
          height: 120,
          background: `radial-gradient(circle at 35% 35%, #FFFFFF 0%, ${theme.coreColor} 50%, #030712 100%)`,
          boxShadow: `0 0 45px ${theme.coreColor}, inset 0 0 25px rgba(255, 255, 255, 0.8)`,
        }}
        animate={{
          scale:
            state === 'listening'
              ? [1, 1.15, 1.02, 1.12, 1]
              : state === 'speaking'
              ? [1, 1.1, 0.98, 1.08, 1]
              : state === 'thinking'
              ? [0.95, 1.05, 0.95]
              : [1, 1.04, 1],
          boxShadow:
            state === 'error'
              ? [
                  '0 0 35px rgba(239, 68, 68, 0.8)',
                  '0 0 55px rgba(239, 68, 68, 1)',
                  '0 0 35px rgba(239, 68, 68, 0.8)',
                ]
              : [
                  `0 0 30px ${theme.coreColor}`,
                  `0 0 50px ${theme.coreColor}`,
                  `0 0 30px ${theme.coreColor}`,
                ],
        }}
        transition={{
          duration: state === 'speaking' ? 0.8 : state === 'listening' ? 1.4 : 3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        {/* Core Inner Geometry / Pulse Icon */}
        <AnimatePresence mode="wait">
          <motion.div
            key={state}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.2 }}
            className="flex items-center justify-center text-slate-950 font-bold"
          >
            {state === 'thinking' ? (
              <div className="w-8 h-8 rounded-full border-2 border-slate-950 border-t-transparent animate-spin" />
            ) : state === 'listening' ? (
              <div className="w-6 h-6 rounded-full bg-slate-950/80 animate-ping" />
            ) : state === 'speaking' ? (
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4].map((bar) => (
                  <motion.div
                    key={bar}
                    className="w-1 bg-slate-950 rounded-full"
                    animate={{ height: [8, 22, 6, 26, 8] }}
                    transition={{
                      duration: 0.6,
                      repeat: Infinity,
                      delay: bar * 0.1,
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="w-4 h-4 rounded-full bg-slate-950/90 shadow-inner" />
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
