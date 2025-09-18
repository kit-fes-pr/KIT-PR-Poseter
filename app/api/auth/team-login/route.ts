import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
  try {
    const { teamCode } = await request.json();

    if (!teamCode) {
      return NextResponse.json(
        { error: 'ログインコードを入力してください' },
        { status: 400 }
      );
    }

    const teamsRef = adminDb.collection('teams');
    const teamQuery = await teamsRef
      .where('teamCode', '==', teamCode)
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (teamQuery.empty) {
      return NextResponse.json(
        { error: '入力されたログインコードが見つかりません' },
        { status: 404 }
      );
    }

    const teamDoc = teamQuery.docs[0];
    const teamData = teamDoc.data();

    const today = new Date();
    const validDate = new Date(teamData.validDate._seconds * 1000);
    
    if (today.toDateString() !== validDate.toDateString()) {
      return NextResponse.json(
        { error: `本日は配布日ではありません。配布日: ${validDate.toLocaleDateString('ja-JP')}` },
        { status: 403 }
      );
    }

    // 一時ユーザーIDを生成
    const tempUserId = `temp_${teamCode}_${Date.now()}`;

    // カスタムトークンを生成
    const customToken = await adminAuth.createCustomToken(tempUserId, {
      teamCode: teamData.teamCode,
      teamId: teamDoc.id,
      role: 'team',
      tempUser: true
    });

    // 一時アカウント情報を記録
    const tempAccountRef = adminDb.collection('tempAccounts').doc();
    await tempAccountRef.set({
      accountId: tempAccountRef.id,
      tempUserId,
      teamCode: teamData.teamCode,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      isActive: true
    });

    return NextResponse.json({
      success: true,
      customToken,
      teamData: {
        teamId: teamDoc.id,
        teamCode: teamData.teamCode,
        teamName: teamData.teamName,
        assignedArea: teamData.assignedArea,
        adjacentAreas: teamData.adjacentAreas
      }
    });

  } catch (error) {
    console.error('Team login error:', error);
    return NextResponse.json(
      { error: 'ログインに失敗しました' },
      { status: 500 }
    );
  }
}