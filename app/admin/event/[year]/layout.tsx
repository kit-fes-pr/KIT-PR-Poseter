import YearEventHeader from '@/components/admin/YearEventHeader';

export default async function YearEventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ year: string }>;
}) {
  const resolvedParams = await params;

  return (
    <div className="min-h-screen bg-gray-50">
      <YearEventHeader year={resolvedParams.year} />
      <main>{children}</main>
    </div>
  );
}
