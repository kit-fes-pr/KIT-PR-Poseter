import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year');

    if (yearParam) {
      const year = parseInt(yearParam);
      const snap = await adminDb
        .collection('distributionEvents')
        .where('year', '==', year)
        .limit(1)
        .get();
      if (snap.empty) return NextResponse.json({ data: null });
      const d = snap.docs[0];
      return NextResponse.json({ data: { id: d.id, ...(d.data() as any) } });
    }

    const snap = await adminDb
      .collection('distributionEvents')
      .orderBy('year', 'desc')
      .get();
    const events = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
    const latest = events[0] || null;
    return NextResponse.json({ events, latest });
  } catch (error) {
    console.error('Get events error:', error);
    return NextResponse.json({ error: 'イベント一覧の取得に失敗しました' }, { status: 500 });
  }
}

