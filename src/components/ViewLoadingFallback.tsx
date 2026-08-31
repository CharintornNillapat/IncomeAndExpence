import React from 'react';
import { motion } from 'framer-motion';

export const ViewLoadingFallback: React.FC = () => {
  return (
    <div 
      id="view-loading-fallback"
      className="w-full py-12 flex flex-col items-center justify-center space-y-4 min-h-[400px]"
    >
      <div className="relative flex items-center justify-center">
        <div className="w-12 h-12 rounded-2xl bg-stone-900/5 animate-pulse" />
        <motion.div 
          className="absolute w-8 h-8 rounded-xl border-2 border-stone-300 border-t-stone-900"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
        />
      </div>

      <div className="text-center space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
          Loading Module
        </p>
        <div className="flex items-center justify-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
};
