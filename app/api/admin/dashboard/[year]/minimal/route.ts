import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { ServerCache, FirestoreCache } from '@/lib/utils/server-cache';

/**
 * 超軽量ダッシュボードAPI - 最小限データで超高速初期表示
 * 目標: 200ms以下でレスポンス
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ year: string }> }
) {
  const startTime = Date.now();
  
  try {
    const { year } = await context.params;
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);

    if (decodedToken.role !== 'admin') {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 });
    }

    const yearNum = parseInt(year);
    if (isNaN(yearNum)) {
      return NextResponse.json({ error: '不正な年度です' }, { status: 400 });
    }

    console.log(`⚡ 最小限データ取得開始: ${year}年度`);

    // キャッシュされた最小限データを取得
    const minimalData = await FirestoreCache.getCachedMinimalData(yearNum, async () => {
      // 超並列クエリ（カウントのみで高速化）
      const [eventSnapshot, teamsCountSnapshot, membersCountSnapshot] = await Promise.all([
        // イベント情報（1件のみ）
        adminDb.collection('distributionEvents')
          .where('year', '==', yearNum)
          .limit(1)
          .get(),
        
        // チーム数のみ（データは取得しない）
        FirestoreCache.getCachedCount('teams', yearNum, () =>
          adminDb.collection('teams')
            .where('year', '==', yearNum)
            .count()
            .get()
            .then(snapshot => snapshot.data().count)
        ),
        
        // メンバー数のみ（データは取得しない）  
        FirestoreCache.getCachedCount('members', yearNum, () =>
          adminDb.collection('members')
            .where('year', '==', yearNum)
            .count()
            .get()
            .then(snapshot => snapshot.data().count)
        )
      ]);

      // イベント情報（軽量）
      let event = null;
      if (!eventSnapshot.empty) {
        const doc = eventSnapshot.docs[0];
        event = {
          id: doc.id,
          eventName: doc.data().eventName,
          year: doc.data().year,
          distributionStartDate: doc.data().distributionStartDate?.toDate?.()?.toISOString(),
          distributionEndDate: doc.data().distributionEndDate?.toDate?.()?.toISOString()
        };
      }

      return {
        event,
        totalTeams: teamsCountSnapshot,
        totalMembers: membersCountSnapshot
      };
    });

    const { event, totalTeams, totalMembers } = minimalData;

    // 最小限の統計
    const minimalStats = {
      totalTeams,
      totalMembers,
      totalAreas: 0, // 後で更新
      isMinimal: true // 最小限データであることを示す
    };

    const responseTime = Date.now() - startTime;
    console.log(`⚡ 最小限データ完了: ${responseTime}ms`);

    return NextResponse.json({
      event,
      stats: minimalStats,
      teams: [], // 空配列（後で段階的読み込み）
      performance: {
        responseTime,
        dataFreshnessTime: new Date().toISOString(),
        isMinimalResponse: true
      },
      loadingStrategy: {
        nextEndpoint: `/api/admin/dashboard/${year}/progressive`,
        chunkSize: 10,
        totalItems: totalTeams
      }
    }, {
      headers: {
        'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
        'X-Response-Type': 'minimal'
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error('最小限データエラー:', error);
    return NextResponse.json(
      { 
        error: 'データ取得に失敗しました',
        performance: { responseTime }
      },
      { status: 500 }
    );
  }
}