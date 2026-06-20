'use client';

import { formatAvailabilitySlotLabel, normalizeAvailabilitySlots, sortAvailabilitySlotKeys } from '@/lib/utils/availability';

type AvailabilitySlotBadgesProps = {
  slots?: string[] | null;
  emptyLabel?: string;
  badgeClassName?: string;
  wrapperClassName?: string;
};

export function AvailabilitySlotBadges({
  slots,
  emptyLabel = '未設定',
  badgeClassName = 'bg-indigo-100 text-indigo-800',
  wrapperClassName = 'flex flex-wrap gap-2',
}: AvailabilitySlotBadgesProps) {
  const normalized = sortAvailabilitySlotKeys(normalizeAvailabilitySlots(slots || []));

  return (
    <div className={wrapperClassName}>
      {normalized.length > 0 ? (
        normalized.map((slot) => (
          <span
            key={slot}
            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${badgeClassName}`}
          >
            {formatAvailabilitySlotLabel(slot)}
          </span>
        ))
      ) : (
        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
          {emptyLabel}
        </span>
      )}
    </div>
  );
}

