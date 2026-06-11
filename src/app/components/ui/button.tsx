import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export function Button({ children, className = '', ...props }: ButtonProps) {
  return (
    <button 
      {...props} 
      className={`px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded font-medium transition-colors ${className}`}
    >
      {children}
    </button>
  );
}
