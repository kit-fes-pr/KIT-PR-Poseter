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
    const year = searchParams.get('year');
    const lastUpdated = searchParams.get('lastUpdated');
    const includeDeleted = searchParams.get('includeDeleted') === 'true';
    
    if (!year) {
      return NextResponse.json(
        { error: 'year パラメータは必須です' },
        { status: 400 }
      );
    }

    // lastUpdated がある場合は差分取得、ない場合は全取得
    let query = adminDb.collection('teams').where('year', '==', parseInt(year));
    
    if (lastUpdated) {
      const lastUpdateTime = new Date(lastUpdated);
      // updatedAt または createdAt が lastUpdated より新しいものを取得
      query = query.where('updatedAt', '>', lastUpdateTime)
               .orderBy('updatedAt', 'desc');
    } else {
      // 初回取得時は全データを取得
      query = query.orderBy('updatedAt', 'desc');
    }

    const teamsSnapshot = await query.get();
    const teams = teamsSnapshot.docs.map(doc => ({
      teamId: doc.id,
      ...doc.data(),
      // Firestore Timestamp を ISO string に変換
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt,
      validStartDate: doc.data().validStartDate?.toDate?.()?.toISOString() || doc.data().validStartDate,
      validEndDate: doc.data().validEndDate?.toDate?.()?.toISOString() || doc.data().validEndDate,
      validDate: doc.data().validDate?.toDate?.()?.toISOString() || doc.data().validDate
    }));

    // 削除されたドキュメントの取得（別途削除ログがある場合）
    let deletedTeams: any[] = [];
    if (includeDeleted && lastUpdated) {
      const deletedQuery = adminDb.collection('deletedTeams')
        .where('year', '==', parseInt(year))
        .where('deletedAt', '>', new Date(lastUpdated));
      
      const deletedSnapshot = await deletedQuery.get();
      deletedTeams = deletedSnapshot.docs.map(doc => ({
        teamId: doc.data().teamId,
        deleted: true,
        deletedAt: doc.data().deletedAt?.toDate?.()?.toISOString()
      }));
    }

    const currentTime = new Date().toISOString();
    
    return NextResponse.json({
      teams,
      deletedTeams,
      lastUpdated: currentTime,
      isIncremental: !!lastUpdated,
      totalCount: teams.length
    });

  } catch (error) {
    console.error('差分取得エラー:', error);
    return NextResponse.json(
      { error: '差分取得に失敗しました' },
      { status: 500 }
    );
  }
}