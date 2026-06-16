'use client';

import { ReactNode } from 'react';

interface YearPageSectionHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export default function YearPageSectionHeader({
  title,
  description,
  actions,
}: YearPageSectionHeaderProps) {
  return (
    <div className="mb-8 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-gray-600">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
