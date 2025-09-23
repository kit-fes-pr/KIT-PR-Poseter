import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ areaId: string }> }) {
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

    const resolvedParams = await params;
    const { areaId } = resolvedParams;
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

    // 区域の存在確認
    const areaRef = adminDb.collection('areas').doc(areaId);
    const areaDoc = await areaRef.get();
    if (!areaDoc.exists) {
      return NextResponse.json({ error: '指定された配布区域が見つかりません' }, { status: 404 });
    }

    // 同じeventId内で他の区域がareaCodeを使用していないかチェック
    const existingSnap = await adminDb.collection('areas')
      .where('eventId', '==', eventId)
      .where('areaCode', '==', areaCode)
      .get();

    const conflictDocs = existingSnap.docs.filter(doc => doc.id !== areaId);
    if (conflictDocs.length > 0) {
      return NextResponse.json({ 
        error: 'この区域コードは既に他の区域で使用されています' 
      }, { status: 400 });
    }

    const updateData = {
      areaCode,
      areaName,
      timeSlot,
      description: description || '',
      eventId,
      updatedAt: new Date()
    };

    await areaRef.update(updateData);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('配布区域更新エラー:', error);
    return NextResponse.json({ error: '配布区域の更新に失敗しました' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ areaId: string }> }) {
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

    const resolvedParams = await params;
    const { areaId } = resolvedParams;

    // 区域の存在確認
    const areaRef = adminDb.collection('areas').doc(areaId);
    const areaDoc = await areaRef.get();
    if (!areaDoc.exists) {
      return NextResponse.json({ error: '指定された配布区域が見つかりません' }, { status: 404 });
    }

    // TODO: 将来的に、この区域に関連する店舗やチームがある場合の確認を追加

    await areaRef.delete();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('配布区域削除エラー:', error);
    return NextResponse.json({ error: '配布区域の削除に失敗しました' }, { status: 500 });
  }
}