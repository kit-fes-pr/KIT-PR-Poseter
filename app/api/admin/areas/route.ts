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
    const eventId = searchParams.get('eventId');
    if (!eventId) {
      return NextResponse.json({ error: 'eventIdが必要です' }, { status: 400 });
    }

    const snap = await adminDb.collection('areas').where('eventId', '==', eventId).orderBy('areaCode').get();
    const areas = snap.docs.map(doc => ({
      areaId: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date()
    }));

    return NextResponse.json({ areas });
  } catch (error) {
    console.error('配布区域取得エラー:', error);
    return NextResponse.json({ error: '配布区域の取得に失敗しました' }, { status: 500 });
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

    const { areaCode, areaName, timeSlot, description, eventId } = await request.json();

    if (!areaCode || !areaName || !timeSlot || !eventId) {
      return NextResponse.json({ 
        error: 'areaCode, areaName, timeSlot, eventId は必須です' 
      }, { status: 400 });
    }

    if (!['morning', 'afternoon'].includes(timeSlot)) {
      return NextResponse.json({ 
        error: 'timeSlotは morning または afternoon である必要があります' 
      }, { status: 400 });
    }

    // 同じeventId内でareaCodeが重複していないかチェック
    const existingSnap = await adminDb.collection('areas')
      .where('eventId', '==', eventId)
      .where('areaCode', '==', areaCode)
      .get();

    if (!existingSnap.empty) {
      return NextResponse.json({ 
        error: 'この区域コードは既に使用されています' 
      }, { status: 400 });
    }

    const areaData = {
      areaCode,
      areaName,
      timeSlot,
      description: description || '',
      eventId,
      createdAt: new Date()
    };

    const docRef = await adminDb.collection('areas').add(areaData);
    const newArea = {
      areaId: docRef.id,
      ...areaData
    };

    return NextResponse.json({ success: true, area: newArea });
  } catch (error) {
    console.error('配布区域作成エラー:', error);
    return NextResponse.json({ error: '配布区域の作成に失敗しました' }, { status: 500 });
  }
}