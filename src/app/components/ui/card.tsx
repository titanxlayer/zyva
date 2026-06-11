import React from 'react';

export function Card({ children, className = '' }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={`bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

Card.Header = function CardHeader({ children }: { children: React.ReactNode }) {
  return <div className="p-4 border-b border-zinc-800 bg-zinc-950/50">{children}</div>;
};

Card.Title = function CardTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="font-semibold text-white text-lg">{children}</h3>;
};

Card.Content = function CardContent({ children }: { children: React.ReactNode }) {
  return <div className="p-4">{children}</div>;
};
