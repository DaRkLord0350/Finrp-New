import React from 'react';

interface ProgressBarProps {
  progress: number; // 0-100
  className?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progress, className = '' }) => {
  const bgColor = progress > 75 ? 'bg-emerald-500' : progress > 40 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className={`w-full bg-slate-200 dark:bg-slate-600 rounded-full h-2 ${className}`}>
      <div
        className={`h-2 rounded-full transition-all duration-500 ${bgColor}`}
        style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
      ></div>
    </div>
  );
};

export default ProgressBar;
