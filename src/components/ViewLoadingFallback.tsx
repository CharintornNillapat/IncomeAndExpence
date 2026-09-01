import React from 'react';
import { motion } from 'framer-motion';

export const ViewLoadingFallback: React.FC = () => {
  return (
    <div 
      id="view-loading-fallback"
      className="w-full py-12 flex flex-col items-center justify-center space-y-4 min-h-[400px]"
    >
      <div className="relative flex items-center justify-center">
        <div className="w-12 h-12 rounded-2xl bg-stone-900/5 dark:bg-stone-100/5 animate-pulse" />
        <motion.div 
          className="absolute w-8 h-8 rounded-xl border-2 border-stone-300 dark:border-stone-700 border-t-stone-900 dark:border-t-stone-100"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
        />
      </div>

      <div className="text-center space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
          Loading Module
        </p>
        <div className="flex items-center justify-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-stone-400 dark:bg-stone-600 animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-stone-400 dark:bg-stone-600 animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-stone-400 dark:bg-stone-600 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
};
