import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

/**
 * 段階的データ読み込みAPI - チャンク単位でデータを追加取得
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ year: string }> }
) {
  const startTime = Date.now();
  
  try {
    const { year } = await context.params;
    const authHeader = request.headers.get('authorization');
    const { searchParams } = new URL(request.url);
    
    const offset = parseInt(searchParams.get('offset') || '0');
    const limit = parseInt(searchParams.get('limit') || '10');
    const includeMembers = searchParams.get('includeMembers') === 'true';
    
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);

    if (decodedToken.role !== 'admin') {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 });
    }

    const yearNum = parseInt(year);

    console.log(`📦 段階的データ取得: offset=${offset}, limit=${limit}`);

    // チームデータをチャンク単位で取得
    const teamsQuery = adminDb.collection('teams')
      .where('year', '==', yearNum)
      .orderBy('updatedAt', 'desc')
      .offset(offset)
      .limit(limit);

    const teamsSnapshot = await teamsQuery.get();
    
    const teams = await Promise.all(
      teamsSnapshot.docs.map(async (doc) => {
        const teamData = {
          teamId: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.()?.toISOString(),
          updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString(),
          validStartDate: doc.data().validStartDate?.toDate?.()?.toISOString(),
          validEndDate: doc.data().validEndDate?.toDate?.()?.toISOString(),
          validDate: doc.data().validDate?.toDate?.()?.toISOString(),
          memberCount: 0 // デフォルト
        };

        // メンバー数が必要な場合のみ取得
        if (includeMembers) {
          try {
            const memberCountSnapshot = await adminDb.collection('members')
              .where('teamId', '==', doc.id)
              .count()
              .get();
            teamData.memberCount = memberCountSnapshot.data().count;
          } catch (error) {
            console.warn(`メンバー数取得エラー (team: ${doc.id}):`, error);
          }
        }

        return teamData;
      })
    );

    // エリア統計の更新
    const areaStats = teams.reduce((acc, team) => {
      const area = String((team as Record<string, unknown>).assignedArea || '未設定');
      if (!acc[area]) {
        acc[area] = { teamCount: 0, memberCount: 0 };
      }
      acc[area].teamCount++;
      acc[area].memberCount += team.memberCount || 0;
      return acc;
    }, {} as Record<string, { teamCount: number; memberCount: number }>);

    // 次のチャンクがあるかチェック
    const hasMore = teams.length === limit;
    const nextOffset = hasMore ? offset + limit : null;

    const responseTime = Date.now() - startTime;

    return NextResponse.json({
      teams,
      pagination: {
        offset,
        limit,
        hasMore,
        nextOffset,
        returned: teams.length
      },
      areaStats,
      performance: {
        responseTime,
        chunkTime: responseTime
      }
    }, {
      headers: {
        'Cache-Control': 'public, max-age=60',
        'X-Chunk-Info': `${offset}-${offset + teams.length - 1}/${limit}`
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error('段階的取得エラー:', error);
    return NextResponse.json(
      { 
        error: '段階的データ取得に失敗しました',
        performance: { responseTime }
      },
      { status: 500 }
    );
  }
}