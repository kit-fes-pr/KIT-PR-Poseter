import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

const ADMIN_EMAIL_PATTERN = /^[^\s@]+@(?:[^\s@]+\.)+kanazawa-it\.ac\.jp$/i;

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    if (decodedToken.role !== 'admin') {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 });
    }

    const body = (await request.json().catch(() => null)) as {
      email?: string;
    } | null;
    const email = body?.email?.trim() || '';

    if (!email || !ADMIN_EMAIL_PATTERN.test(email)) {
      return NextResponse.json(
        { error: 'kanazawa-it.ac.jp のメールアドレスを入力してください' },
        { status: 400 },
      );
    }

    const displayName = email.split('@')[0];

    let userRecord;
    let operation: 'created' | 'updated';
    try {
      const existingUser = await adminAuth.getUserByEmail(email);
      userRecord = await adminAuth.updateUser(existingUser.uid, {
        displayName,
        emailVerified: true,
        disabled: false,
      });
      operation = 'updated';
    } catch (error) {
      const firebaseError = error as { code?: string };
      if (firebaseError.code !== 'auth/user-not-found') {
        throw error;
      }

      userRecord = await adminAuth.createUser({
        email,
        displayName,
        emailVerified: true,
        disabled: false,
      });
      operation = 'created';
    }

    await adminAuth.setCustomUserClaims(userRecord.uid, {
      role: 'admin',
      isAdmin: true,
    });

    const adminRef = adminDb.collection('admins').doc(userRecord.uid);
    const adminDoc = await adminRef.get();
    if (adminDoc.exists) {
      await adminRef.set(
        {
          adminId: userRecord.uid,
          email: userRecord.email,
          name: userRecord.displayName || displayName,
          isActive: true,
          updatedAt: new Date(),
        },
        { merge: true },
      );
    } else {
      await adminRef.set({
        adminId: userRecord.uid,
        email: userRecord.email,
        name: userRecord.displayName || displayName,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    await adminDb.collection('adminInvites').add({
      email,
      name: displayName,
      invitedBy: decodedToken.email || decodedToken.uid,
      invitedAt: new Date(),
      operation,
      uid: userRecord.uid,
    });

    return NextResponse.json({
      success: true,
      invite: {
        email,
        name: displayName,
        operation,
      },
    });
  } catch (error) {
    console.error('管理者招待エラー:', error);
    return NextResponse.json({ error: 'ユーザー招待に失敗しました' }, { status: 500 });
  }
}
