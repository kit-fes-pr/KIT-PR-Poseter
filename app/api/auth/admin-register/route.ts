import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';

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
      // 新規アカウント作成
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Adminコレクションにユーザー情報を保存
      const adminData = {
        adminId: user.uid,
        email: user.email,
        name: user.displayName || email.split('@')[0],
        isActive: true,
        createdAt: new Date()
      };
      
      await adminDb.collection('admins').doc(user.uid).set(adminData);

      // Custom Claimsで管理者権限を設定
      await adminAuth.setCustomUserClaims(user.uid, {
        role: 'admin',
        isAdmin: true
      });

      console.log('Custom claims set for user:', user.uid);

      // カスタムトークンを生成
      const customToken = await adminAuth.createCustomToken(user.uid, {
        role: 'admin',
        isAdmin: true
      });

      return NextResponse.json({
        success: true,
        message: '管理者アカウントが作成されました',
        customToken,
        user: {
          uid: user.uid,
          email: user.email,
          name: adminData.name,
          isAdmin: true
        }
      });

    } catch (error: unknown) {
      const firebaseError = error as { code?: string; message?: string };
      
      let errorMessage = '管理者アカウントの作成に失敗しました';
      
      if (firebaseError.code === 'auth/email-already-in-use') {
        errorMessage = 'このメールアドレスは既に使用されています';
      } else if (firebaseError.code === 'auth/weak-password') {
        errorMessage = 'パスワードが弱すぎます。6文字以上で設定してください';
      } else if (firebaseError.code === 'auth/invalid-email') {
        errorMessage = 'メールアドレスの形式が正しくありません';
      }
      
      return NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Admin register error:', error);
    return NextResponse.json(
      { error: '管理者アカウントの作成に失敗しました' },
      { status: 500 }
    );
  }
}