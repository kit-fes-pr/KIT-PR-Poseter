/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { SurveyForm, FormCreateData } from '@/types/forms';
import { serializeDate, toMillis } from '@/lib/utils/forms';
import { buildFormsCreatePayload, normalizeFormsRouteAuthHeader, parseFormsListEventId } from '@/lib/utils/forms-route';

export async function GET(request: NextRequest) {
  try {
    const idToken = normalizeFormsRouteAuthHeader(request.headers.get('authorization'));
    if (!idToken) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    try {
      const decodedToken = await adminAuth.verifyIdToken(idToken);

      // 管理者のみフォーム一覧を取得可能
      if (decodedToken.role !== 'admin') {
        return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 });
      }
    } catch (authError) {
      console.error('認証エラー:', authError);
      return NextResponse.json({ error: '認証に失敗しました' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const eventId = parseFormsListEventId(searchParams.get('eventId'));

    // フォーム一覧を取得（非正規化されたカウンタを使用）
    const formsSnapshot = await adminDb.collection('forms').where('eventId', '==', eventId).get();

    const forms = formsSnapshot.docs.map((doc) => {
      const formData = doc.data() as SurveyForm & { responseCount?: number; lastResponseAt?: any };
      const createdAt = (formData.createdAt as any)?.toDate
        ? (formData.createdAt as any).toDate()
        : formData.createdAt;
      const updatedAt = (formData.updatedAt as any)?.toDate
        ? (formData.updatedAt as any).toDate()
        : formData.updatedAt;
      const lastResponseAt = (formData.lastResponseAt as any)?.toDate
        ? (formData.lastResponseAt as any).toDate()
        : formData.lastResponseAt;
      return {
        ...formData,
        formId: doc.id,
        responseCount: formData.responseCount || 0,
        lastResponseAt: serializeDate(lastResponseAt),
        createdAt: serializeDate(createdAt),
        updatedAt: serializeDate(updatedAt),
      };
    });

    // createdAtでソート（新しい順）
    forms.sort((a, b) => {
      const aTime = toMillis(a.createdAt);
      const bTime = toMillis(b.createdAt);
      return bTime - aTime;
    });

    return NextResponse.json({ forms });
  } catch (error) {
    console.error('フォーム一覧取得エラー:', error);
    return NextResponse.json({ error: 'フォーム一覧の取得に失敗しました' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const idToken = normalizeFormsRouteAuthHeader(request.headers.get('authorization'));
    if (!idToken) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }
    const decodedToken = await adminAuth.verifyIdToken(idToken);

    // 管理者のみフォーム作成可能
    if (decodedToken.role !== 'admin') {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 });
    }

    const body = await request.json();
    const { title, description, fields, eventId, year }: FormCreateData & {
      eventId?: string;
      year?: number;
    } = body;

    const created = buildFormsCreatePayload({
      title,
      description,
      fields,
      eventId,
      year,
      createdBy: decodedToken.uid,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    if ('error' in created) {
      return NextResponse.json({ error: created.error }, { status: 400 });
    }

    const existingFormSnapshot = await adminDb
      .collection('forms')
      .where('eventId', '==', created.data.eventId)
      .limit(1)
      .get();

    if (!existingFormSnapshot.empty) {
      return NextResponse.json({ error: 'この年度には既にフォームが存在します' }, { status: 409 });
    }

    const formData = created.data;

    // Firestoreに保存
    const docRef = await adminDb.collection('forms').add(formData);

    return NextResponse.json({
      message: 'フォームが作成されました',
      formId: docRef.id,
      form: {
        ...formData,
        formId: docRef.id,
        createdAt: serializeDate(formData.createdAt),
        updatedAt: serializeDate(formData.updatedAt),
      },
    });
  } catch (error) {
    console.error('フォーム作成エラー:', error);
    return NextResponse.json({ error: 'フォームの作成に失敗しました' }, { status: 500 });
  }
}
