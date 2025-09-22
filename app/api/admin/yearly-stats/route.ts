import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { YearlyStats } from '@/types';
import { Query, DocumentData } from 'firebase-admin/firestore';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);

    if (decodedToken.role !== 'admin') {
      return NextResponse.json(
        { error: '管理者権限が必要です' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const startYear = searchParams.get('startYear');
    const endYear = searchParams.get('endYear');

    let query: Query<DocumentData> = adminDb.collection('distributionHistory');

    if (year) {
      query = query.where('year', '==', parseInt(year));
    } else if (startYear && endYear) {
      query = query
        .where('year', '>=', parseInt(startYear))
        .where('year', '<=', parseInt(endYear));
    }

    const snapshot = await query.orderBy('year', 'desc').get();
    const histories = snapshot.docs.map(doc => doc.data());

    if (year) {
      // 特定年度の詳細統計
      const yearData = histories.find((h: Record<string, unknown>) => h.year === parseInt(year));
      if (!yearData) {
        return NextResponse.json({ stats: null });
      }

      const stats = generateDetailedYearlyStats(yearData);
      return NextResponse.json({ stats });
    } else {
      // 複数年度の比較統計
      const comparativeStats = generateComparativeStats(histories);
      return NextResponse.json({ stats: comparativeStats });
    }

  } catch (error) {
    console.error('Get yearly stats error:', error);
    return NextResponse.json(
      { error: '年度別統計の取得に失敗しました' },
      { status: 500 }
    );
  }
}

function generateDetailedYearlyStats(yearData: Record<string, unknown>): YearlyStats {
  const bestTeam = (yearData.teams as Record<string, unknown>[]).reduce((best: Record<string, unknown> | null, team: Record<string, unknown>) => {
    return (team.completionRate as number) > ((best?.completionRate as number) || 0) ? team : best;
  }, null);

  return {
    year: yearData.year as number,
    eventName: yearData.eventName as string,
    totalEvents: 1,
    totalStores: yearData.totalStores as number,
    totalTeams: (yearData.teams as unknown[]).length,
    totalMembers: (yearData.teams as Record<string, unknown>[]).reduce((total: number, team: Record<string, unknown>) => total + ((team.members as unknown[])?.length || 0), 0),
    averageCompletionRate: yearData.completionRate as number,
    bestPerformingTeam: bestTeam ? {
      teamCode: bestTeam.teamCode as string,
      teamName: bestTeam.teamName as string,
      completionRate: bestTeam.completionRate as number
    } : {
      teamCode: '',
      teamName: '',
      completionRate: 0
    },
    distributionTrends: [{
      date: new Date(yearData.distributionDate as string),
      completedStores: yearData.completedStores as number,
      totalStores: yearData.totalStores as number
    }]
  };
}

function generateComparativeStats(histories: Record<string, unknown>[]) {
  return histories.map((history: Record<string, unknown>) => ({
    year: history.year as number,
    eventName: history.eventName as string,
    totalStores: history.totalStores as number,
    completedStores: history.completedStores as number,
    completionRate: history.completionRate as number,
    totalTeams: (history.teams as unknown[])?.length || 0,
    totalMembers: (history.teams as Record<string, unknown>[])?.reduce((total: number, team: Record<string, unknown>) => total + ((team.members as unknown[])?.length || 0), 0) || 0,
    distributionDate: new Date(history.distributionDate as string)
  }));
}