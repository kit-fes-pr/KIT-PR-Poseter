import YearSidebar from '@/components/admin/YearSidebar';
import { adminDb } from '@/lib/firebase-admin';
import { normalizeDistributionEventListYear } from '@/lib/utils/events/events-api';
import { buildDistributionPeriodLabel } from '@/lib/utils/events/events';

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
    try {
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
        distributionPeriod = buildDistributionPeriodLabel({
          distributionStartDate: eventData.distributionStartDate,
          distributionEndDate: eventData.distributionEndDate,
          distributionAvailabilitySlots: eventData.distributionAvailabilitySlots,
        });
      }
    } catch (error) {
      console.error('配布期間の取得に失敗しました:', error);
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
