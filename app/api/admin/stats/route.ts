import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

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
    const eventIdParam = searchParams.get('eventId');
    const yearParam = searchParams.get('year');

    let targetEventId = eventIdParam || 'kohdai2025';
    if (!eventIdParam && yearParam) {
      const year = parseInt(yearParam);
      const evSnap = await adminDb.collection('distributionEvents').where('year', '==', year).limit(1).get();
      if (!evSnap.empty) targetEventId = evSnap.docs[0].id;
    }

    const storesSnapshot = await adminDb.collection('stores')
      .where('eventId', '==', targetEventId)
      .get();

    const teamsSnapshot = await adminDb.collection('teams')
      .where('eventId', '==', targetEventId)
      .where('isActive', '==', true)
      .get();

    const stores = storesSnapshot.docs.map(doc => doc.data()) as Array<{
      distributionStatus: string;
      distributedBy: string;
      areaCode: string;
    }>;
    const teams = teamsSnapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    })) as Array<{ 
      id: string; 
      teamCode: string; 
      teamName: string; 
      assignedArea: string; 
    }>;

    const totalStores = stores.length;
    const completedStores = stores.filter(store => store.distributionStatus === 'completed').length;
    const failedStores = stores.filter(store => store.distributionStatus === 'failed').length;
    const pendingStores = stores.filter(store => store.distributionStatus === 'pending').length;
    const completionRate = totalStores > 0 ? (completedStores / totalStores) * 100 : 0;

    const teamStats = teams.map(team => {
      const teamStores = stores.filter(store => store.distributedBy === team.teamCode);
      const teamCompleted = teamStores.filter(store => store.distributionStatus === 'completed').length;
      const teamFailed = teamStores.filter(store => store.distributionStatus === 'failed').length;
      const teamTotal = teamStores.length;
      const teamDistributedCount = teamStores.reduce((sum, s: Record<string, unknown>) => sum + ((s.distributedCount as number) || 0), 0);
      const teamRate = teamTotal > 0 ? (teamCompleted / teamTotal) * 100 : 0;

      return {
        teamId: team.id,
        teamCode: team.teamCode,
        teamName: team.teamName,
        assignedArea: team.assignedArea,
        totalStores: teamTotal,
        completedStores: teamCompleted,
        failedStores: teamFailed,
        distributedCount: teamDistributedCount,
        completionRate: teamRate
      };
    });

    const areaStats = [...new Set(stores.map(store => store.areaCode))].map(areaCode => {
      const areaStores = stores.filter(store => store.areaCode === areaCode);
      const areaCompleted = areaStores.filter(store => store.distributionStatus === 'completed').length;
      const areaTotal = areaStores.length;
      const areaRate = areaTotal > 0 ? (areaCompleted / areaTotal) * 100 : 0;

      return {
        areaCode,
        totalStores: areaTotal,
        completedStores: areaCompleted,
        completionRate: areaRate
      };
    });

    return NextResponse.json({
      overall: {
        totalStores,
        completedStores,
        failedStores,
        pendingStores,
        completionRate
      },
      teamStats,
      areaStats
    });

  } catch (error) {
    console.error('Get stats error:', error);
    return NextResponse.json(
      { error: '統計情報の取得に失敗しました' },
      { status: 500 }
    );
  }
}
