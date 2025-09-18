import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { YearlyStats } from '@/types';

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

    let query = adminDb.collection('distributionHistory');

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
      const yearData = histories.find((h: any) => h.year === parseInt(year));
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

function generateDetailedYearlyStats(yearData: any): YearlyStats {
  const bestTeam = yearData.teams.reduce((best: any, team: any) => {
    return team.completionRate > (best?.completionRate || 0) ? team : best;
  }, null);

  return {
    year: yearData.year,
    eventName: yearData.eventName,
    totalEvents: 1,
    totalStores: yearData.totalStores,
    totalTeams: yearData.teams.length,
    totalMembers: yearData.teams.reduce((total: number, team: any) => total + team.members.length, 0),
    averageCompletionRate: yearData.completionRate,
    bestPerformingTeam: bestTeam ? {
      teamCode: bestTeam.teamCode,
      teamName: bestTeam.teamName,
      completionRate: bestTeam.completionRate
    } : {
      teamCode: '',
      teamName: '',
      completionRate: 0
    },
    distributionTrends: [{
      date: yearData.distributionDate,
      completedStores: yearData.completedStores,
      totalStores: yearData.totalStores
    }]
  };
}

function generateComparativeStats(histories: any[]) {
  return histories.map((history: any) => ({
    year: history.year,
    eventName: history.eventName,
    totalStores: history.totalStores,
    completedStores: history.completedStores,
    completionRate: history.completionRate,
    totalTeams: history.teams.length,
    totalMembers: history.teams.reduce((total: number, team: any) => total + team.members.length, 0),
    distributionDate: history.distributionDate
  }));
}