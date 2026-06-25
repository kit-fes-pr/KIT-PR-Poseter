import YearSidebar from '@/components/admin/YearSidebar';
import { adminDb } from '@/lib/firebase-admin';
import { formatDateOnly } from '@/lib/utils/dateUtils';
import { normalizeDistributionEventListYear } from '@/lib/utils/events/events-api';

function formatDateRangeLabel(
  startValue: string | Date | number | null | undefined,
  endValue: string | Date | number | null | undefined,
): string {
  const start = formatDateOnly(startValue);
  const end = formatDateOnly(endValue);

  if (start === '-' && end === '-') return '未設定';
  if (start !== '-' && end !== '-' && start !== end) {
    return `${start} 〜 ${end}`;
  }
  return start !== '-' ? start : end;
}

function getRangeFromAvailabilitySlots(slots: unknown): string | null {
  if (!Array.isArray(slots)) return null;

  const dates = slots
    .filter((slot): slot is string => typeof slot === 'string')
    .map((slot) => slot.match(/^(\d{4}-\d{2}-\d{2})_(am|pm)$/)?.[1])
    .filter((date): date is string => Boolean(date));

  if (dates.length === 0) return null;

  const uniqueDates = Array.from(new Set(dates)).sort();
  const start = uniqueDates[0];
  const end = uniqueDates[uniqueDates.length - 1];
  return formatDateRangeLabel(start, end);
}

export default async function YearEventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ year: string }>;
}) {
  const resolvedParams = await params;
  const yearNumber = normalizeDistributionEventListYear(resolvedParams.year);

  let distributionPeriod = '未設定';
  if (yearNumber !== null) {
    const snap = await adminDb
      .collection('distributionEvents')
      .where('year', '==', yearNumber)
      .limit(1)
      .get();

    if (!snap.empty) {
      const eventData = snap.docs[0].data() as {
        distributionStartDate?: string | Date | number | null;
        distributionEndDate?: string | Date | number | null;
        distributionAvailabilitySlots?: unknown;
      };
      const dateRangeLabel = formatDateRangeLabel(
        eventData.distributionStartDate,
        eventData.distributionEndDate,
      );
      distributionPeriod =
        dateRangeLabel === '未設定'
          ? getRangeFromAvailabilitySlots(eventData.distributionAvailabilitySlots) || '未設定'
          : dateRangeLabel;
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full px-0 py-6">
        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-stretch">
          <YearSidebar year={resolvedParams.year} distributionPeriod={distributionPeriod} />
          <main className="min-w-0 lg:self-stretch">{children}</main>
        </div>
      </div>
    </div>
  );
}
