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

    // Admin SDKでユーザーを検索
    try {
      const userRecord = await adminAuth.getUserByEmail(email);
      
      // Admin用のカスタムトークンを生成
      const customToken = await adminAuth.createCustomToken(userRecord.uid, {
        role: 'admin',
        isAdmin: true
      });

      // Admin情報を確認/作成
      const adminDoc = await adminDb.collection('admins').doc(userRecord.uid).get();
      
      if (!adminDoc.exists) {
        const adminData = {
          adminId: userRecord.uid,
          email: userRecord.email,
          name: userRecord.displayName || email.split('@')[0],
          isActive: true,
          createdAt: new Date()
        };
        
        await adminDb.collection('admins').doc(userRecord.uid).set(adminData);
      }

      return NextResponse.json({
        success: true,
        customToken,
        user: {
          uid: userRecord.uid,
          email: userRecord.email,
          name: userRecord.displayName || email.split('@')[0],
          isAdmin: true
        }
      });

    } catch (userError: unknown) {
      const firebaseError = userError as { code?: string };
      
      if (firebaseError.code === 'auth/user-not-found') {
        return NextResponse.json(
          { error: 'ユーザーが見つかりません。先にアカウントを作成してください。' },
          { status: 404 }
        );
      }
      
      throw userError;
    }

  } catch (error: unknown) {
    console.error('Admin login error:', error);
    
    let errorMessage = 'ログインに失敗しました';
    
    const firebaseError = error as { code?: string };
    if (firebaseError.code === 'auth/user-not-found') {
      errorMessage = 'ユーザーが見つかりません';
    } else if (firebaseError.code === 'auth/wrong-password') {
      errorMessage = 'パスワードが正しくありません';
    } else if (firebaseError.code === 'auth/invalid-email') {
      errorMessage = 'メールアドレスの形式が正しくありません';
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 401 }
    );
  }
}