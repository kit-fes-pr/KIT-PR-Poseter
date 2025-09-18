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

    const { year, eventName, distributionDate, distributionStartDate, distributionEndDate, eventId } = await request.json();

    if (!year || (!distributionDate && !distributionStartDate)) {
      return NextResponse.json({ error: '年度と配布日（開始日）を入力してください' }, { status: 400 });
    }

    const y = parseInt(String(year));
    if (!Number.isFinite(y)) {
      return NextResponse.json({ error: '年度の形式が不正です' }, { status: 400 });
    }

    // 年度の重複チェック
    const existSnap = await adminDb
      .collection('distributionEvents')
      .where('year', '==', y)
      .limit(1)
      .get();
    if (!existSnap.empty) {
      return NextResponse.json({ error: 'この年度のイベントは既に存在します' }, { status: 409 });
    }

    const id = eventId || `kohdai${y}`;
    const docRef = adminDb.collection('distributionEvents').doc(id);

    const startDateStr = distributionStartDate || distributionDate;
    const endDateStr = distributionEndDate || distributionDate || distributionStartDate;
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ error: '配布日の形式が不正です' }, { status: 400 });
    }

    const payload = {
      eventId: id,
      eventName: eventName || `工大祭${y}`,
      distributionDate: start, // 後方互換
      distributionStartDate: start,
      distributionEndDate: end,
      year: y,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await docRef.set(payload, { merge: false });
    return NextResponse.json({ success: true, data: { id, ...payload } });
  } catch (error) {
    console.error('Create event error:', error);
    return NextResponse.json({ error: 'イベントの作成に失敗しました' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
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

    const { id, year, eventName, distributionDate, distributionStartDate, distributionEndDate, isActive } = await request.json();
    if (!id && !year) {
      return NextResponse.json({ error: 'id か year を指定してください' }, { status: 400 });
    }

    let docRef;
    if (id) {
      docRef = adminDb.collection('distributionEvents').doc(String(id));
    } else {
      const y = parseInt(String(year));
      const snap = await adminDb.collection('distributionEvents').where('year', '==', y).limit(1).get();
      if (snap.empty) return NextResponse.json({ error: '対象の年度が見つかりません' }, { status: 404 });
      docRef = snap.docs[0].ref;
    }

    const update: Record<string, any> = { updatedAt: new Date() };
    if (typeof eventName === 'string') update.eventName = eventName;
    if (typeof isActive === 'boolean') update.isActive = isActive;
    // 単日（distributionDate）と期間（distributionStartDate, distributionEndDate）の両対応
    if (distributionStartDate || distributionEndDate || distributionDate) {
      const startDateStr = distributionStartDate || distributionDate;
      const endDateStr = distributionEndDate || distributionDate || distributionStartDate;
      if (startDateStr) update.distributionStartDate = new Date(startDateStr);
      if (endDateStr) update.distributionEndDate = new Date(endDateStr);
      if (startDateStr) update.distributionDate = new Date(startDateStr); // 後方互換
    }

    await docRef.update(update);
    const doc = await docRef.get();
    return NextResponse.json({ success: true, data: { id: doc.id, ...(doc.data() as any) } });
  } catch (error) {
    console.error('Update event error:', error);
    return NextResponse.json({ error: 'イベントの更新に失敗しました' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
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

    const { id, year } = await request.json();
    if (!id && !year) return NextResponse.json({ error: 'id か year を指定してください' }, { status: 400 });

    let docRef;
    if (id) {
      docRef = adminDb.collection('distributionEvents').doc(String(id));
    } else {
      const y = parseInt(String(year));
      const snap = await adminDb.collection('distributionEvents').where('year', '==', y).limit(1).get();
      if (snap.empty) return NextResponse.json({ error: '対象の年度が見つかりません' }, { status: 404 });
      docRef = snap.docs[0].ref;
    }

    const doc = await docRef.get();
    if (!doc.exists) return NextResponse.json({ error: 'イベントが見つかりません' }, { status: 404 });
    const eid = doc.id;

    // 依存データがある場合は削除不可
    const storesSnap = await adminDb.collection('stores').where('eventId', '==', eid).limit(1).get();
    const teamsSnap = await adminDb.collection('teams').where('eventId', '==', eid).limit(1).get();
    if (!storesSnap.empty || !teamsSnap.empty) {
      return NextResponse.json({ error: '関連データ（stores/teams）が存在するため削除できません' }, { status: 409 });
    }

    await docRef.delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete event error:', error);
    return NextResponse.json({ error: 'イベントの削除に失敗しました' }, { status: 500 });
  }
}
