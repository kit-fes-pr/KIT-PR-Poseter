'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { FastNavButton } from '@/lib/hooks/useFastNavigation';

interface YearSidebarProps {
  year: string;
  distributionPeriod?: string;
}

export default function YearSidebar({ year, distributionPeriod }: YearSidebarProps) {
  const pathname = usePathname();
  const items = useMemo(
    () => [
      { href: `/admin/event/${year}`, label: '年度トップ', exact: true },
      { href: `/admin/event/${year}/form`, label: 'フォーム管理' },
      { href: `/admin/event/${year}/setting`, label: 'イベント設定' },
      { href: `/admin/event/${year}/team`, label: 'チーム管理' },
    ],
    [year],
  );

  const activeHref = useMemo(() => {
    const exactMatch = items.find((item) => item.exact && pathname === item.href);
    if (exactMatch) return exactMatch.href;
    const prefixMatches = items
      .filter((item) => !item.exact && pathname.startsWith(item.href))
      .sort((a, b) => b.href.length - a.href.length);
    return prefixMatches[0]?.href || '';
  }, [items, pathname]);

  return (
    <aside className="flex h-full min-h-full flex-col rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="shrink-0">
        <h2 className="mt-1 text-lg font-semibold text-gray-900">{year} 年度</h2>
        <div className="mt-4 rounded-2xl bg-gray-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">配布期間</p>
          <p className="mt-1 text-sm font-medium text-gray-900">{distributionPeriod || '未設定'}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-1 flex-wrap gap-2 lg:flex-col lg:items-stretch">
        {items.map((item) => {
          const isActive = activeHref === item.href;
          return (
            <FastNavButton
              key={item.href}
              href={item.href}
              className={`rounded-md px-3 py-2 text-sm transition-colors lg:w-full ${
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
    </aside>
  );
}
