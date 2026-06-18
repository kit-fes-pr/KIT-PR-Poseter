'use client';

import { FastNavButton } from '@/lib/hooks/useFastNavigation';

interface YearEventHeaderProps {
  year: string;
}

export default function YearEventHeader({ year }: YearEventHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-gray-500">
            学外配布管理
          </p>
          <h1 className="truncate text-lg font-semibold text-gray-900">
            {year} 年度
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <FastNavButton
            href="/admin/event"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50"
          >
            年度一覧
          </FastNavButton>
          <FastNavButton
            href={`/admin/event/${year}/form`}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50"
          >
            フォーム管理
          </FastNavButton>
        </div>
      </div>
    </header>
  );
}
