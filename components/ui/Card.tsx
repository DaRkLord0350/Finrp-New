import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  as?: React.ElementType;
}

const Card: React.FC<CardProps> = ({ children, className = '', as: Component = 'div' }) => {
  return (
    <Component className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4 sm:p-6 transition-all duration-300 hover:shadow-lg dark:hover:shadow-slate-700/50 ${className}`}>
      {children}
    </Component>
  );
};

export default React.memo(Card);
