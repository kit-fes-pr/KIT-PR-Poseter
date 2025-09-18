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

    // 一時メールアドレス + パスワード方式
    const tempEmail = `${teamData.teamCode}@temp.kohdai-poster.local`;
    const tempPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-4);

    // 既存ユーザー確認 or 作成
    let uid: string | null = null;
    try {
      const existing = await adminAuth.getUserByEmail(tempEmail);
      uid = existing.uid;
      // 既存の一時ユーザーのパスワードをローテーション
      await adminAuth.updateUser(uid, { password: tempPassword, emailVerified: true, displayName: teamData.teamName || teamData.teamCode, disabled: false });
    } catch {
      const created = await adminAuth.createUser({ email: tempEmail, password: tempPassword, emailVerified: true, displayName: teamData.teamName || teamData.teamCode, disabled: false });
      uid = created.uid;
    }

    // カスタムクレームを設定（班情報）
    if (uid) {
      await adminAuth.setCustomUserClaims(uid, {
        teamCode: teamData.teamCode,
        teamId: teamDoc.id,
        role: 'team',
        tempUser: true
      });
    }

    // 一時アカウント情報を記録
    const tempAccountRef = adminDb.collection('tempAccounts').doc();
    await tempAccountRef.set({
      accountId: tempAccountRef.id,
      teamCode: teamData.teamCode,
      tempEmail,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      isActive: true
    });

    return NextResponse.json({
      success: true,
      tempEmail,
      tempPassword,
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
