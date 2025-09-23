import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);

    if (decodedToken.role !== 'admin') {
      return NextResponse.json(
        { error: '管理者権限が必要です' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const formId = searchParams.get('formId');

    if (!year) {
      return NextResponse.json(
        { error: '年度が必要です' },
        { status: 400 }
      );
    }

    let query = adminDb.collection('assignments').where('year', '==', parseInt(year));
    
    if (formId) {
      query = query.where('formId', '==', formId);
    }

    const assignmentsSnapshot = await query.get();

    const assignments = assignmentsSnapshot.docs.map(doc => ({
      assignmentId: doc.id,
      ...doc.data(),
      assignedAt: doc.data().assignedAt?.toDate ? doc.data().assignedAt.toDate() : doc.data().assignedAt,
    }));

    return NextResponse.json({ assignments });
  } catch (error) {
    console.error('割り当て取得エラー:', error);
    return NextResponse.json(
      { error: '割り当ての取得に失敗しました' },
      { status: 500 }
    );
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
      return NextResponse.json(
        { error: '管理者権限が必要です' },
        { status: 403 }
      );
    }

    const { year, formId, responseId, teamId, timeSlot } = await request.json();

    if (!year || !formId || !responseId || !teamId) {
      return NextResponse.json(
        { error: 'year, formId, responseId, teamId は必須です' },
        { status: 400 }
      );
    }

    if (!['morning', 'afternoon'].includes(timeSlot)) {
      return NextResponse.json(
        { error: 'timeSlot は morning/afternoon のいずれかが必要です' },
        { status: 400 }
      );
    }

    // 既存の同一参加者の割り当てを削除（同一年度・フォーム内で一意に）
    const query = await adminDb.collection('assignments')
      .where('year', '==', parseInt(year))
      .where('formId', '==', formId)
      .where('responseId', '==', responseId)
      .get();
    const batch = adminDb.batch();
    query.docs.forEach(doc => batch.delete(doc.ref));

    // 新しい割り当てを追加
    const docRef = adminDb.collection('assignments').doc();
    batch.set(docRef, {
      responseId,
      teamId,
      assignedAt: new Date(),
      assignedBy: 'manual',
      timeSlot,
      year: parseInt(year),
      formId,
    });

    await batch.commit();

    return NextResponse.json({ success: true, assignmentId: docRef.id });
  } catch (error) {
    console.error('割り当て作成エラー:', error);
    return NextResponse.json(
      { error: '割り当ての作成に失敗しました' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);

    if (decodedToken.role !== 'admin') {
      return NextResponse.json(
        { error: '管理者権限が必要です' },
        { status: 403 }
      );
    }

    const { year, formId } = await request.json();

    if (!year) {
      return NextResponse.json(
        { error: '年度が必要です' },
        { status: 400 }
      );
    }

    let query = adminDb.collection('assignments').where('year', '==', parseInt(year));
    
    if (formId) {
      query = query.where('formId', '==', formId);
    }

    const assignmentsSnapshot = await query.get();
    
    const batch = adminDb.batch();
    assignmentsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    return NextResponse.json({ 
      message: '割り当てが削除されました',
      deletedCount: assignmentsSnapshot.size 
    });
  } catch (error) {
    console.error('割り当て削除エラー:', error);
    return NextResponse.json(
      { error: '割り当ての削除に失敗しました' },
      { status: 500 }
    );
  }
}
