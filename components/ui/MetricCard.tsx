'use client';

import { CSSProperties, ReactNode } from 'react';

type MetricCardProps = {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  detail?: ReactNode;
  onClick?: () => void;
  className?: string;
  style?: CSSProperties;
  labelClassName?: string;
  valueClassName?: string;
  iconClassName?: string;
};

export function MetricCard({
  label,
  value,
  icon,
  detail,
  onClick,
  className = '',
  style,
  labelClassName = 'text-gray-500',
  valueClassName = 'text-gray-900',
  iconClassName = 'text-3xl',
}: MetricCardProps) {
  const interactive = Boolean(onClick);

  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={`bg-white overflow-hidden shadow-lg rounded-xl transform transition-all border border-gray-100 ${interactive ? 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:scale-105' : ''} ${className}`}
      style={style}
    >
      <div className="p-6">
        <div className="flex items-center">
          {icon && (
            <div className="flex-shrink-0">
              <div className={iconClassName}>{icon}</div>
            </div>
          )}
          <div className={icon ? 'ml-5 w-0 flex-1' : 'w-full'}>
            <dl>
              <dt className={`text-sm font-medium truncate ${labelClassName}`}>{label}</dt>
              <dd className={`text-2xl font-bold flex items-center gap-2 ${valueClassName}`}>
                <span>{value}</span>
              </dd>
              {detail && <dd className="mt-1 text-xs font-medium text-gray-500">{detail}</dd>}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
