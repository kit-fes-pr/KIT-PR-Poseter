import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      console.log('No Authorization header found');
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];

    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const userRecord = await adminAuth.getUser(decodedToken.uid);

    if (userRecord.disabled) {
      return NextResponse.json(
        { error: 'セッションが無効です。再度ログインしてください' },
        { status: 401 },
      );
    }

    const authTime =
      (decodedToken as unknown as { auth_time?: number }).auth_time || decodedToken.iat || 0;
    const revokedAfterMs = userRecord.tokensValidAfterTime
      ? Date.parse(userRecord.tokensValidAfterTime)
      : 0;

    if (revokedAfterMs && authTime * 1000 < revokedAfterMs) {
      return NextResponse.json(
        { error: 'セッションが失効しています。再度ログインしてください' },
        { status: 401 },
      );
    }

    // セッションの最大寿命（24時間）を強制
    const nowSec = Math.floor(Date.now() / 1000);
    const effectiveAuthTime = authTime || nowSec;
    const maxAgeSec = 24 * 60 * 60;
    if (nowSec - effectiveAuthTime > maxAgeSec) {
      return NextResponse.json(
        { error: 'セッションが期限切れです。再度ログインしてください' },
        { status: 401 },
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        uid: decodedToken.uid,
        email: decodedToken.email,
        teamCode: decodedToken.teamCode,
        teamId: decodedToken.teamId,
        role: decodedToken.role,
        isAdmin: decodedToken.role === 'admin',
      },
    });
  } catch (error) {
    console.error('Auth verification error:', error);
    return NextResponse.json(
      { error: 'セッションが期限切れです。再度ログインしてください' },
      { status: 401 },
    );
  }
}
