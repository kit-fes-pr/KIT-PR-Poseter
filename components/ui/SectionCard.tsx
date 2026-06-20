'use client';

import { ReactNode } from 'react';

type SectionCardProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
};

export function SectionCard({
  title,
  description,
  actions,
  children,
  className = '',
  bodyClassName = '',
}: SectionCardProps) {
  return (
    <section className={`bg-white shadow rounded-lg p-6 ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium text-gray-900">{title}</h2>
          {description && <p className="text-sm text-gray-500">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
      <div className={bodyClassName}>
        {children}
      </div>
    </section>
  );
}

