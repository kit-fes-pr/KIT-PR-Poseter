import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { hasAdminPrivileges } from '@/lib/utils/admin/auth';
import {
  buildDashboardAreaStats,
  buildDashboardEventData,
  buildDashboardMemberStats,
  buildDashboardTeamStats,
} from '@/lib/utils/dashboard/dashboard-route';
import { FirestoreOptimizer } from '@/lib/utils/firestore-optimizer';

export async function GET(request: NextRequest, context: { params: Promise<{ year: string }> }) {
  const startTime = Date.now();

  try {
    const { year } = await context.params;
    const authHeader = request.headers.get('authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken, true);
    } catch (error) {
      console.error('Auth token verification failed:', error);
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    if (!hasAdminPrivileges(decodedToken as { role?: unknown; isAdmin?: unknown })) {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 });
    }

    const yearNum = parseInt(year);
    if (isNaN(yearNum)) {
      return NextResponse.json({ error: '不正な年度です' }, { status: 400 });
    }

    console.log(`🚀 高速ダッシュボード開始: ${year}年度`);

    // 超並列クエリ実行（キャッシュ機能付き）
    const queries = await FirestoreOptimizer.parallelQuery([
      {
        key: `event_${year}`,
        query: () =>
          adminDb.collection('distributionEvents').where('year', '==', yearNum).limit(1).get(),
      },
      {
        key: `teams_${year}`,
        query: () =>
          adminDb
            .collection('teams')
            .where('year', '==', yearNum)
            .orderBy('updatedAt', 'desc')
            .get(),
      },
      {
        key: `members_${year}`,
        query: () => adminDb.collection('members').where('year', '==', yearNum).get(),
      },
    ]);

    const [eventDoc, teamsSnapshot, membersSnapshot] = [
      queries[`event_${year}`],
      queries[`teams_${year}`],
      queries[`members_${year}`],
    ];

    // イベントデータの処理
    let event = null;
    if (!(eventDoc as { empty: boolean; docs: unknown[] }).empty) {
      const doc = (eventDoc as { empty: boolean; docs: unknown[] }).docs[0] as {
        id: string;
        data: () => unknown;
      };
      event = buildDashboardEventData({
        id: doc.id,
        ...(doc.data() as Record<string, unknown>),
      });
    }

    // チームデータの処理
    const teams = (
      teamsSnapshot as { docs: { id: string; data: () => Record<string, unknown> }[] }
    ).docs.map((doc) => ({
      teamId: doc.id,
      ...doc.data(),
    })) as Array<Record<string, unknown> & { teamId: string }>;

    // メンバー統計の計算
    const members = (
      membersSnapshot as { docs: { data: () => Record<string, unknown> }[] }
    ).docs.map((doc) => doc.data());
    const memberStats = buildDashboardMemberStats(members);

    // チーム統計の計算
    const teamStats = buildDashboardTeamStats({
      teams,
      memberStatsByTeam: memberStats.byTeam,
    });

    const areasCountSnapshot = await adminDb
      .collection('areas')
      .count()
      .get()
      .then((snapshot) => snapshot.data().count);

    // エリア別統計
    const areaStats = buildDashboardAreaStats({
      teams,
      memberStatsByTeam: memberStats.byTeam,
    });

    const responseTime = Date.now() - startTime;
    console.log(`ダッシュボードデータ取得完了: ${responseTime}ms`);

    return NextResponse.json({
      event,
      teams: teamStats,
      stats: {
        totalTeams: teams.length,
        totalMembers: memberStats.totalMembers,
        totalAreas: areasCountSnapshot,
        byArea: areaStats,
        teamStats: teamStats,
      },
      performance: {
        responseTime,
        dataFreshnessTime: new Date().toISOString(),
      },
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error('ダッシュボードデータ取得エラー:', error);
    return NextResponse.json(
      {
        error: 'データ取得に失敗しました',
        performance: { responseTime },
      },
      { status: 500 },
    );
  }
}
