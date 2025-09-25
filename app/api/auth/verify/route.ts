import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('No Authorization header found');
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    const idToken = authHeader.split('Bearer ')[1];
    console.log('Verifying ID token:', idToken.substring(0, 50) + '...');
    
    const decodedToken = await adminAuth.verifyIdToken(idToken, true);
    console.log('Token decoded successfully:', {
      uid: decodedToken.uid,
      email: decodedToken.email,
      role: decodedToken.role,
      customClaims: decodedToken
    });

    // セッションの最大寿命（24時間）を強制
    const nowSec = Math.floor(Date.now() / 1000);
    const authTime = (decodedToken as unknown as { auth_time?: number }).auth_time || decodedToken.iat || nowSec;
    const maxAgeSec = 24 * 60 * 60;
    if (nowSec - authTime > maxAgeSec) {
      return NextResponse.json(
        { error: 'セッションが期限切れです。再度ログインしてください' },
        { status: 401 }
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
        isAdmin: decodedToken.role === 'admin'
      }
    });

  } catch (error) {
    console.error('Auth verification error:', error);
    return NextResponse.json(
      { error: 'セッションが期限切れです。再度ログインしてください' },
      { status: 401 }
    );
  }
}
