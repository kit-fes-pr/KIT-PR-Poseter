'use client';

import React, { MouseEvent, useRef, useState } from 'react';

type MDButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  color?: 'primary' | 'secondary' | 'surface';
  variant?: 'filled' | 'tonal' | 'outlined' | 'text';
  className?: string;
  title?: string;
};

export default function MDButton({
  children,
  onClick,
  disabled,
  color = 'primary',
  variant = 'filled',
  className,
  title,
}: MDButtonProps) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number }>>([]);

  const handlePointerDown = (e: MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now();
    setRipples((prev) => [...prev, { id, x, y }]);
    // 自動で消す
    setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== id)), 550);
  };

  const palette = {
    primary: {
      filled: 'bg-indigo-600 text-white shadow-md hover:shadow-lg',
      tonal: 'bg-indigo-100 text-indigo-900 hover:bg-indigo-200',
      outlined: 'border border-indigo-300 text-indigo-700 hover:bg-indigo-50',
      text: 'text-indigo-700 hover:bg-indigo-50',
      ripple: 'bg-white/60',
    },
    secondary: {
      filled: 'bg-blue-600 text-white shadow-md hover:shadow-lg',
      tonal: 'bg-blue-100 text-blue-900 hover:bg-blue-200',
      outlined: 'border border-blue-300 text-blue-700 hover:bg-blue-50',
      text: 'text-blue-700 hover:bg-blue-50',
      ripple: 'bg-white/60',
    },
    surface: {
      filled: 'bg-gray-800 text-white shadow-md hover:shadow-lg',
      tonal: 'bg-gray-100 text-gray-900 hover:bg-gray-200',
      outlined: 'border border-gray-300 text-gray-800 hover:bg-gray-50',
      text: 'text-gray-800 hover:bg-gray-50',
      ripple: 'bg-black/10',
    },
  } as const;

  const base = 'relative overflow-hidden rounded-full px-4 py-2 text-sm transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed';
  const style = `${base} ${(palette[color] as any)[variant]} ${className || ''}`;

  return (
    <button
      ref={btnRef}
      type="button"
      title={title}
      className={style}
      disabled={disabled}
      onPointerDown={handlePointerDown}
      onClick={onClick}
    >
      {/* Ripple container */}
      <span className="pointer-events-none absolute inset-0">
        {ripples.map((r) => (
          <span
            key={r.id}
            className={`absolute block rounded-full scale-0 animate-md-ripple ${(palette[color] as any).ripple}`}
            style={{ left: r.x, top: r.y, width: 10, height: 10 }}
          />
        ))}
      </span>
      <span className="relative z-[1] flex items-center gap-2">{children}</span>
      <style jsx>{`
        @keyframes md-ripple {
          0% { transform: translate(-50%, -50%) scale(0); opacity: 0.35; }
          60% { transform: translate(-50%, -50%) scale(18); opacity: 0.25; }
          100% { transform: translate(-50%, -50%) scale(22); opacity: 0; }
        }
        .animate-md-ripple {
          animation: md-ripple 550ms ease-out forwards;
        }
      `}</style>
    </button>
  );
}

