import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'メールアドレスとパスワードを入力してください' },
        { status: 400 }
      );
    }

    if (!email.endsWith('@st.kanazawa-it.ac.jp')) {
      return NextResponse.json(
        { error: 'st.kanazawa-it.ac.jp ドメインのメールアドレスのみ使用可能です' },
        { status: 403 }
      );
    }

    try {
      // 管理者（サーバー）SDKでユーザーを作成
      const displayName = email.split('@')[0];
      const userRecord = await adminAuth.createUser({
        email,
        password,
        displayName,
        emailVerified: true,
        disabled: false,
      });

      // Adminコレクションにユーザー情報を保存
      const adminData = {
        adminId: userRecord.uid,
        email: userRecord.email,
        name: userRecord.displayName || displayName,
        isActive: true,
        createdAt: new Date(),
      };
      await adminDb.collection('admins').doc(userRecord.uid).set(adminData);

      // Custom Claimsで管理者権限を設定
      await adminAuth.setCustomUserClaims(userRecord.uid, {
        role: 'admin',
        isAdmin: true,
      });

      // 必要であればカスタムトークンを返却（クライアント側で即ログインに利用可）
      const customToken = await adminAuth.createCustomToken(userRecord.uid, {
        role: 'admin',
        isAdmin: true,
      });

      return NextResponse.json({
        success: true,
        message: '管理者アカウントが作成されました',
        customToken,
        user: {
          uid: userRecord.uid,
          email: userRecord.email,
          name: adminData.name,
          isAdmin: true,
        },
      });
    } catch (error: unknown) {
      const firebaseError = error as { code?: string; message?: string };
      let errorMessage = '管理者アカウントの作成に失敗しました';
      if (firebaseError.code === 'auth/email-already-exists') {
        errorMessage = 'このメールアドレスは既に使用されています';
      } else if (firebaseError.code === 'auth/invalid-password') {
        errorMessage = 'パスワードの形式が正しくありません（6文字以上など）';
      } else if (firebaseError.code === 'auth/invalid-email') {
        errorMessage = 'メールアドレスの形式が正しくありません';
      }
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

  } catch (error) {
    console.error('Admin register error:', error);
    return NextResponse.json(
      { error: '管理者アカウントの作成に失敗しました' },
      { status: 500 }
    );
  }
}
