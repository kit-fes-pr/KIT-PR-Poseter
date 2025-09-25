import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

/**
 * ストリーミングダッシュボードAPI - 段階的データ配信で初回表示を高速化
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
    const decodedToken = await adminAuth.verifyIdToken(idToken, true);

    if (decodedToken.role !== 'admin') {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 });
    }

    const yearNum = parseInt(year);
    if (isNaN(yearNum)) {
      return NextResponse.json({ error: '不正な年度です' }, { status: 400 });
    }

    console.log(`🚄 ストリーミング開始: ${year}年度`);

    // ストリーミングレスポンスを作成
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        // ヘルパー関数：データをストリームに送信
        const sendChunk = (data: unknown, chunkType: string) => {
          const chunk = {
            type: chunkType,
            data,
            timestamp: new Date().toISOString(),
            elapsed: Date.now() - startTime
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        };

        try {
          // 1. 最優先：基本統計（最速）
          sendChunk({ phase: 'initializing', message: 'データ取得開始' }, 'status');

          // 2. イベント情報を最初に取得（軽量）
          const eventQuery = adminDb.collection('distributionEvents')
            .where('year', '==', yearNum)
            .limit(1);
          
          const eventSnapshot = await eventQuery.get();
          let event = null;
          
          if (!eventSnapshot.empty) {
            const doc = eventSnapshot.docs[0];
            event = {
              id: doc.id,
              ...doc.data(),
              createdAt: doc.data().createdAt?.toDate?.()?.toISOString(),
              distributionStartDate: doc.data().distributionStartDate?.toDate?.()?.toISOString(),
              distributionEndDate: doc.data().distributionEndDate?.toDate?.()?.toISOString(),
              distributionDate: doc.data().distributionDate?.toDate?.()?.toISOString()
            };
          }

          // 即座にイベント情報を送信
          sendChunk({ event, stats: { phase: 'event_loaded' } }, 'event');

          // 3. チーム数のクイックカウント（統計のみ）
          const teamsCountQuery = adminDb.collection('teams')
            .where('year', '==', yearNum)
            .count();
          
          const teamsCountSnapshot = await teamsCountQuery.get();
          const totalTeams = teamsCountSnapshot.data().count;

          sendChunk({ 
            quickStats: { totalTeams },
            phase: 'quick_stats'
          }, 'quick-stats');

          // 4. 並列でメンバー数もカウント
          const membersCountQuery = adminDb.collection('members')
            .where('year', '==', yearNum)
            .count();

          const membersCountPromise = membersCountQuery.get();

          // 5. チーム詳細データを段階的に取得
          const teamsQuery = adminDb.collection('teams')
            .where('year', '==', yearNum)
            .orderBy('updatedAt', 'desc')
            .limit(20); // 最初は20件だけ

          const teamsSnapshot = await teamsQuery.get();
          
          const teams = teamsSnapshot.docs.map(doc => ({
            teamId: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.()?.toISOString(),
            updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString(),
            validStartDate: doc.data().validStartDate?.toDate?.()?.toISOString(),
            validEndDate: doc.data().validEndDate?.toDate?.()?.toISOString(),
            validDate: doc.data().validDate?.toDate?.()?.toISOString()
          }));

          // チーム詳細データを送信
          sendChunk({ 
            teams: teams.slice(0, 10), // 最初は10件のみ表示
            hasMore: teams.length > 10,
            phase: 'teams_partial'
          }, 'teams-partial');

          // 6. メンバー数確定を待つ
          const membersCountSnapshot = await membersCountPromise;
          const totalMembers = membersCountSnapshot.data().count;

          // 7. 残りのチームデータ
          if (teams.length > 10) {
            sendChunk({ 
              teams: teams.slice(10),
              phase: 'teams_remaining'
            }, 'teams-remaining');
          }

          // 8. 最終統計
          const areaStats = teams.reduce((acc, team) => {
            const area = String((team as Record<string, unknown>).assignedArea || '未設定');
            if (!acc[area]) {
              acc[area] = { teamCount: 0 };
            }
            acc[area].teamCount++;
            return acc;
          }, {} as Record<string, { teamCount: number }>);

          const finalStats = {
            totalTeams,
            totalMembers,
            byArea: areaStats,
            teamStats: teams
          };

          sendChunk({ 
            stats: finalStats,
            performance: {
              responseTime: Date.now() - startTime,
              dataFreshnessTime: new Date().toISOString()
            },
            phase: 'complete'
          }, 'final');

          // 完了
          controller.close();

        } catch (error) {
          console.error('ストリーミングエラー:', error);
          sendChunk({ 
            error: 'データ取得に失敗しました',
            phase: 'error'
          }, 'error');
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('ストリーミング初期化エラー:', error);
    return NextResponse.json(
      { error: 'ストリーミング開始に失敗しました' },
      { status: 500 }
    );
  }
}