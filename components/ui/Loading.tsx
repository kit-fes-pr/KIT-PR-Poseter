'use client';

import React from 'react';

type LoadingSize = 'sm' | 'md' | 'lg';

const sizeMap: Record<LoadingSize, string> = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-8 w-8 border-4',
};

export function LoadingSpinner({
  size = 'md',
  className = '',
}: {
  size?: LoadingSize;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`animate-spin rounded-full border-t-blue-600 border-gray-300 border-solid ${sizeMap[size]} ${className}`}
    />
  );
}

export function LoadingInline({
  message = '読み込み中...',
  size = 'md',
  className = '',
}: {
  message?: string;
  size?: LoadingSize;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={`inline-flex items-center gap-2 text-gray-600 ${className}`}
    >
      <LoadingSpinner size={size} />
      <span className="text-sm">{message}</span>
    </div>
  );
}

export function LoadingScreen({
  message = '読み込み中...',
  progress,
  className = '',
}: {
  message?: string;
  progress?: number;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={`fixed inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-sm ${className}`}
    >
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <LoadingSpinner size="lg" />
        </div>
        <p className="text-sm font-medium text-gray-700">{message}</p>
        {typeof progress === 'number' && (
          <div className="w-64 bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function LoadingButtonLabel({
  message = '読み込み中...',
}: {
  message?: string;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <LoadingSpinner size="sm" />
      <span>{message}</span>
    </span>
  );
}
