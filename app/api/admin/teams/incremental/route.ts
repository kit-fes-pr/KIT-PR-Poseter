import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import {
  buildTeamIncrementalDeletedTeamView,
  buildTeamIncrementalTeamView,
  normalizeTeamIncrementalAuthHeader,
  parseTeamIncrementalQuery,
} from '@/lib/utils/team/team-incremental-route';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = normalizeTeamIncrementalAuthHeader(authHeader);
    if (!token) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const decodedToken = await adminAuth.verifyIdToken(token);

    if (decodedToken.role !== 'admin') {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const query = parseTeamIncrementalQuery({
      year: searchParams.get('year'),
      lastUpdated: searchParams.get('lastUpdated'),
      includeDeleted: searchParams.get('includeDeleted'),
    });

    if (!query.year) {
      return NextResponse.json({ error: 'year パラメータは必須です' }, { status: 400 });
    }
    if (Number.isNaN(query.yearNum)) {
      return NextResponse.json({ error: 'year の形式が不正です' }, { status: 400 });
    }

    // lastUpdated がある場合は差分取得、ない場合は全取得
    let teamQuery = adminDb.collection('teams').where('year', '==', query.yearNum);

    if (query.lastUpdated) {
      const lastUpdateTime = new Date(query.lastUpdated);
      // updatedAt または createdAt が lastUpdated より新しいものを取得
      teamQuery = teamQuery.where('updatedAt', '>', lastUpdateTime).orderBy('updatedAt', 'desc');
    } else {
      // 初回取得時は全データを取得
      teamQuery = teamQuery.orderBy('updatedAt', 'desc');
    }

    const teamsSnapshot = await teamQuery.get();
    const teams = teamsSnapshot.docs.map((doc) =>
      buildTeamIncrementalTeamView({
        teamId: doc.id,
        data: doc.data() as Record<string, unknown>,
      }),
    );

    // 削除されたドキュメントの取得（別途削除ログがある場合）
    let deletedTeams: Array<{ teamId: string; deleted: true; deletedAt: string | Date }> = [];
    if (query.includeDeleted && query.lastUpdated) {
      const deletedQuery = adminDb
        .collection('deletedTeams')
        .where('year', '==', query.yearNum)
        .where('deletedAt', '>', new Date(query.lastUpdated));

      const deletedSnapshot = await deletedQuery.get();
      deletedTeams = deletedSnapshot.docs.map((doc) =>
        buildTeamIncrementalDeletedTeamView({
          teamId: String(doc.data().teamId),
          data: doc.data() as Record<string, unknown>,
        }),
      );
    }

    const currentTime = new Date().toISOString();

    return NextResponse.json({
      teams,
      deletedTeams,
      lastUpdated: currentTime,
      isIncremental: !!query.lastUpdated,
      totalCount: teams.length,
    });
  } catch (error) {
    console.error('差分取得エラー:', error);
    return NextResponse.json({ error: '差分取得に失敗しました' }, { status: 500 });
  }
}
