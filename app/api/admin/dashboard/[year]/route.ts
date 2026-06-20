import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { FirestoreOptimizer } from '@/lib/utils/firestore-optimizer';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ year: string }> }
) {
  const startTime = Date.now();
  
  try {
    const { year } = await context.params;
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken, true);

    if (decodedToken.role !== 'admin') {
      return NextResponse.json(
        { error: '管理者権限が必要です' },
        { status: 403 }
      );
    }

    const yearNum = parseInt(year);
    if (isNaN(yearNum)) {
      return NextResponse.json(
        { error: '不正な年度です' },
        { status: 400 }
      );
    }

    console.log(`🚀 高速ダッシュボード開始: ${year}年度`);
    
    // 超並列クエリ実行（キャッシュ機能付き）
    const queries = await FirestoreOptimizer.parallelQuery([
      {
        key: `event_${year}`,
        query: () => adminDb.collection('distributionEvents')
          .where('year', '==', yearNum)
          .limit(1)
          .get()
      },
      {
        key: `teams_${year}`,
        query: () => adminDb.collection('teams')
          .where('year', '==', yearNum)
          .orderBy('updatedAt', 'desc')
          .get()
      },
      {
        key: `members_${year}`,
        query: () => adminDb.collection('members')
          .where('year', '==', yearNum)
          .get()
      }
    ]);

    const [eventDoc, teamsSnapshot, membersSnapshot] = [
      queries[`event_${year}`],
      queries[`teams_${year}`],
      queries[`members_${year}`]
    ];

    // イベントデータの処理
    let event = null;
    if (!(eventDoc as { empty: boolean; docs: unknown[] }).empty) {
      const doc = (eventDoc as { empty: boolean; docs: unknown[] }).docs[0] as { id: string; data: () => unknown };
      event = {
        id: doc.id,
        ...(doc.data() as Record<string, unknown>),
        // Timestamp を ISO string に変換
        createdAt: (doc.data() as Record<string, { toDate?: () => Date }>).createdAt?.toDate?.()?.toISOString() || (doc.data() as Record<string, unknown>).createdAt,
        distributionStartDate: (doc.data() as Record<string, { toDate?: () => Date }>).distributionStartDate?.toDate?.()?.toISOString() || (doc.data() as Record<string, unknown>).distributionStartDate,
        distributionEndDate: (doc.data() as Record<string, { toDate?: () => Date }>).distributionEndDate?.toDate?.()?.toISOString() || (doc.data() as Record<string, unknown>).distributionEndDate
      };
    }

    // チームデータの処理
    const teams = (teamsSnapshot as { docs: { id: string; data: () => Record<string, unknown> }[] }).docs.map(doc => ({
      teamId: doc.id,
      ...doc.data(),
      createdAt: (doc.data() as Record<string, { toDate?: () => Date }>).createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
      updatedAt: (doc.data() as Record<string, { toDate?: () => Date }>).updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt,
      validStartDate: (doc.data() as Record<string, { toDate?: () => Date }>).validStartDate?.toDate?.()?.toISOString() || doc.data().validStartDate,
      validEndDate: (doc.data() as Record<string, { toDate?: () => Date }>).validEndDate?.toDate?.()?.toISOString() || doc.data().validEndDate,
      validDate: (doc.data() as Record<string, { toDate?: () => Date }>).validDate?.toDate?.()?.toISOString() || doc.data().validDate
    }));

    // メンバー統計の計算
    const members = (membersSnapshot as { docs: { data: () => Record<string, unknown> }[] }).docs.map(doc => doc.data());
    const memberStats = {
      totalMembers: members.length,
      byTeam: members.reduce((acc, member) => {
        const teamId = String((member as Record<string, unknown>).teamId);
        if (!acc[teamId]) {
          acc[teamId] = { count: 0, members: [] };
        }
        (acc[teamId] as { count: number; members: Array<{ name: string; studentId: string; grade: string; department: string }> }).count++;
        (acc[teamId] as { count: number; members: Array<{ name: string; studentId: string; grade: string; department: string }> }).members.push({
          name: String((member as Record<string, unknown>).name || (member as Record<string, unknown>).displayName),
          studentId: String((member as Record<string, unknown>).studentId),
          grade: String((member as Record<string, unknown>).grade),
          department: String((member as Record<string, unknown>).department)
        });
        return acc;
      }, {} as Record<string, { count: number; members: Array<{ name: string; studentId: string; grade: string; department: string }> }>)
    };

    // チーム統計の計算
    const teamStats = teams.map(team => {
      const teamMembers = memberStats.byTeam[team.teamId] as { count: number; members: Array<{ name: string; studentId: string; grade: string; department: string }> } | undefined || { count: 0, members: [] };
      return {
        ...team,
        memberCount: teamMembers.count,
        members: teamMembers.members
      };
    });

    const areasCountSnapshot = await adminDb.collection('areas')
      .count()
      .get()
      .then(snapshot => snapshot.data().count);

    // エリア別統計
    const areaStats = teams.reduce((acc, team) => {
      const area = String((team as Record<string, unknown>).assignedArea || '未設定');
      if (!acc[area]) {
        acc[area] = { teamCount: 0, memberCount: 0, teams: [] };
      }
      const teamMembers = (memberStats.byTeam[team.teamId] as { count: number } | undefined) || { count: 0 };
      acc[area].teamCount++;
      acc[area].memberCount += teamMembers.count;
      acc[area].teams.push(String((team as Record<string, unknown>).teamCode));
      return acc;
    }, {} as Record<string, { teamCount: number; memberCount: number; teams: string[] }>);

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
        teamStats: teamStats
      },
      performance: {
        responseTime,
        dataFreshnessTime: new Date().toISOString()
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error('ダッシュボードデータ取得エラー:', error);
    return NextResponse.json(
      { 
        error: 'データ取得に失敗しました',
        performance: { responseTime }
      },
      { status: 500 }
    );
  }
}
