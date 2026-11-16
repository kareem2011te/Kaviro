import React from 'react';
import { KAVIRO_LOGO_SRC } from '../design-system/components';

export const LoadingScreen: React.FC<{ label?: string }> = ({ label = 'Initializing workspace' }) => (
  <div className="min-h-screen w-full bg-[#040814] flex flex-col items-center justify-center px-6">
    <div className="w-full max-w-xs flex flex-col items-center gap-6">
      <div className="w-56 p-3 rounded-2xl bg-[#02050d] border border-blue-500/25 shadow-[0_20px_50px_-15px_rgba(29,122,252,0.45)]">
        <img
          src={KAVIRO_LOGO_SRC}
          alt="KAVIRO"
          referrerPolicy="no-referrer"
          className="w-full h-auto object-contain"
        />
      </div>
      <div className="w-48 h-1 rounded-full bg-slate-800 overflow-hidden">
        <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-[#1D7AFC] to-[#00D4FF] animate-pulse" />
      </div>
      <p className="text-xs font-medium text-slate-400 tracking-wide">{label}</p>
    </div>
  </div>
);
