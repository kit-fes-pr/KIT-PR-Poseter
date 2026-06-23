import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import {
  buildManualAssignmentRecord,
  normalizeAssignmentYear,
} from '@/lib/utils/assignment/assignment-api';
import {
  normalizeAssignmentAuthHeader,
  parseAssignmentListQuery,
  parseAssignmentMutationPayload,
} from '@/lib/utils/assignment/assignment-route';
import { FirestoreCache } from '@/lib/utils/server-cache';

export async function GET(request: NextRequest) {
  try {
    const idToken = normalizeAssignmentAuthHeader(request.headers.get('authorization'));
    if (!idToken) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }
    const decodedToken = await adminAuth.verifyIdToken(idToken);

    if (decodedToken.role !== 'admin') {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const parsedQuery = parseAssignmentListQuery(searchParams);
    if ('error' in parsedQuery) {
      return NextResponse.json({ error: parsedQuery.error }, { status: 400 });
    }

    let query = adminDb.collection('assignments').where('year', '==', parsedQuery.year);

    if (parsedQuery.formId) {
      query = query.where('formId', '==', parsedQuery.formId);
    }

    const assignmentsSnapshot = await query.get();

    const assignments = assignmentsSnapshot.docs.map((doc) => ({
      assignmentId: doc.id,
      ...doc.data(),
      assignedAt: doc.data().assignedAt?.toDate
        ? doc.data().assignedAt.toDate()
        : doc.data().assignedAt,
    }));

    return NextResponse.json({ assignments });
  } catch (error) {
    console.error('割り当て取得エラー:', error);
    return NextResponse.json({ error: '割り当ての取得に失敗しました' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const idToken = normalizeAssignmentAuthHeader(request.headers.get('authorization'));
    if (!idToken) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }
    const decodedToken = await adminAuth.verifyIdToken(idToken);

    if (decodedToken.role !== 'admin') {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 });
    }

    const parsedPayload = parseAssignmentMutationPayload(await request.json());
    if ('error' in parsedPayload) {
      return NextResponse.json({ error: parsedPayload.error }, { status: 400 });
    }

    const manualAssignment = buildManualAssignmentRecord({
      year: parsedPayload.year,
      formId: parsedPayload.formId,
      responseId: parsedPayload.responseId,
      teamId: parsedPayload.teamId,
      timeSlot: parsedPayload.timeSlot,
      assignedAt: new Date(),
    });
    if (!manualAssignment) {
      return NextResponse.json(
        { error: 'year, formId, responseId, teamId, timeSlot が必要です' },
        { status: 400 },
      );
    }

    // 既存の同一参加者の割り当てを削除（同一年度・フォーム内で一意に）
    const query = await adminDb
      .collection('assignments')
      .where('year', '==', manualAssignment.year)
      .where('formId', '==', manualAssignment.formId)
      .where('responseId', '==', manualAssignment.responseId)
      .get();
    const batch = adminDb.batch();
    query.docs.forEach((doc) => batch.delete(doc.ref));

    // 新しい割り当てを追加
    const docRef = adminDb.collection('assignments').doc();
    batch.set(docRef, {
      ...manualAssignment,
    });

    await batch.commit();

    if (manualAssignment.year) {
      FirestoreCache.invalidateYear(Number(manualAssignment.year));
    }

    return NextResponse.json({ success: true, assignmentId: docRef.id });
  } catch (error) {
    console.error('割り当て作成エラー:', error);
    return NextResponse.json({ error: '割り当ての作成に失敗しました' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const idToken = normalizeAssignmentAuthHeader(request.headers.get('authorization'));
    if (!idToken) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }
    const decodedToken = await adminAuth.verifyIdToken(idToken);

    if (decodedToken.role !== 'admin') {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 });
    }

    const { year, formId } = await request.json();

    const normalizedYear = normalizeAssignmentYear(year);
    if (!normalizedYear) {
      return NextResponse.json({ error: '年度が必要です' }, { status: 400 });
    }

    let query = adminDb.collection('assignments').where('year', '==', normalizedYear);

    if (formId) {
      query = query.where('formId', '==', formId);
    }

    const assignmentsSnapshot = await query.get();

    const batch = adminDb.batch();
    assignmentsSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    if (normalizedYear) {
      FirestoreCache.invalidateYear(normalizedYear);
    }

    return NextResponse.json({
      message: '割り当てが削除されました',
      deletedCount: assignmentsSnapshot.size,
    });
  } catch (error) {
    console.error('割り当て削除エラー:', error);
    return NextResponse.json({ error: '割り当ての削除に失敗しました' }, { status: 500 });
  }
}
