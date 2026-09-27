import React from 'react';
import { motion } from 'framer-motion';

export const ViewLoadingFallback: React.FC = () => {
  return (
    <div 
      id="view-loading-fallback"
      className="w-full py-12 flex flex-col items-center justify-center space-y-4 min-h-[400px]"
    >
      <div className="relative flex items-center justify-center">
        <div className="w-12 h-12 rounded-xl bg-surface-2 animate-pulse" />
        <motion.div 
          className="absolute w-8 h-8 rounded-lg border-2 border-line border-t-brand"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
        />
      </div>

      <div className="text-center space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-fg-secondary">
          Loading Module
        </p>
        <div className="flex items-center justify-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-fg-muted animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-fg-muted animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-fg-muted animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
};
