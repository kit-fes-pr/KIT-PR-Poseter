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
    if (!eventDoc.empty) {
      const doc = eventDoc.docs[0];
      event = {
        id: doc.id,
        ...doc.data(),
        // Timestamp を ISO string に変換
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        distributionStartDate: doc.data().distributionStartDate?.toDate?.()?.toISOString() || doc.data().distributionStartDate,
        distributionEndDate: doc.data().distributionEndDate?.toDate?.()?.toISOString() || doc.data().distributionEndDate,
        distributionDate: doc.data().distributionDate?.toDate?.()?.toISOString() || doc.data().distributionDate
      };
    }

    // チームデータの処理
    const teams = teamsSnapshot.docs.map(doc => ({
      teamId: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt,
      validStartDate: doc.data().validStartDate?.toDate?.()?.toISOString() || doc.data().validStartDate,
      validEndDate: doc.data().validEndDate?.toDate?.()?.toISOString() || doc.data().validEndDate,
      validDate: doc.data().validDate?.toDate?.()?.toISOString() || doc.data().validDate
    }));

    // メンバー統計の計算
    const members = membersSnapshot.docs.map(doc => doc.data());
    const memberStats = {
      totalMembers: members.length,
      byTeam: members.reduce((acc, member) => {
        const teamId = member.teamId;
        if (!acc[teamId]) {
          acc[teamId] = { count: 0, members: [] };
        }
        acc[teamId].count++;
        acc[teamId].members.push({
          name: member.name || member.displayName,
          studentId: member.studentId,
          grade: member.grade,
          department: member.department
        });
        return acc;
      }, {} as Record<string, any>)
    };

    // チーム統計の計算
    const teamStats = teams.map(team => {
      const teamMembers = memberStats.byTeam[team.teamId] || { count: 0, members: [] };
      return {
        ...team,
        memberCount: teamMembers.count,
        members: teamMembers.members
      };
    });

    // エリア別統計
    const areaStats = teams.reduce((acc, team) => {
      const area = team.assignedArea || '未設定';
      if (!acc[area]) {
        acc[area] = { teamCount: 0, memberCount: 0, teams: [] };
      }
      const teamMembers = memberStats.byTeam[team.teamId] || { count: 0 };
      acc[area].teamCount++;
      acc[area].memberCount += teamMembers.count;
      acc[area].teams.push(team.teamCode);
      return acc;
    }, {} as Record<string, any>);

    const responseTime = Date.now() - startTime;
    console.log(`ダッシュボードデータ取得完了: ${responseTime}ms`);

    return NextResponse.json({
      event,
      teams: teamStats,
      stats: {
        totalTeams: teams.length,
        totalMembers: memberStats.totalMembers,
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