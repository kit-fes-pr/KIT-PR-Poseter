'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { FastNavButton } from '@/lib/hooks/useFastNavigation';

interface YearEventHeaderProps {
  year: string;
}

export default function YearEventHeader({ year }: YearEventHeaderProps) {
  const pathname = usePathname();
  const yearNavItems = useMemo(
    () => [
      { href: `/admin/event/${year}`, label: '年度トップ', exact: true },
      { href: `/admin/event/${year}/form`, label: 'フォーム管理' },
      { href: `/admin/event/${year}/setting`, label: 'イベント設定' },
      { href: `/admin/event/${year}/team`, label: 'チーム管理' },
    ],
    [year],
  );

  return (
    <header className="border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-gray-500">
            学外配布管理
          </p>
          <h1 className="truncate text-lg font-semibold text-gray-900">{year} 年度</h1>
        </div>

        <div className="flex items-center gap-2">
          {yearNavItems.map((item) => {
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);

            return (
              <FastNavButton
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'border border-indigo-300 bg-indigo-50 text-indigo-700'
                    : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {item.label}
              </FastNavButton>
            );
          })}
        </div>
      </div>
    </header>
  );
}
