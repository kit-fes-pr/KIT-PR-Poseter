/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { SurveyForm, FormCreateData } from '@/types/forms';

function serializeDate(value: unknown): string | unknown {
  if (!value) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return new Date(value).toISOString();
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return value;
}

function toMillis(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    const date = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }
  return 0;
}

function normalizeFormEventContext(eventId: unknown, year: unknown): { eventId: string; year: number } | null {
  const normalizedYear = typeof year === 'number'
    ? year
    : typeof year === 'string' && year.trim()
      ? Number(year)
      : Number.NaN;

  if (Number.isFinite(normalizedYear)) {
    return {
      eventId: `kodai${normalizedYear}`,
      year: normalizedYear,
    };
  }

  const normalizedEventId = typeof eventId === 'string' ? eventId.trim() : '';
  const matchedYear = normalizedEventId.match(/^kodai(\d{4})$/)?.[1];

  if (matchedYear) {
    return {
      eventId: normalizedEventId,
      year: Number(matchedYear),
    };
  }

  if (normalizedEventId) {
    return null;
  }

  return null;
}

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

    try {
      const decodedToken = await adminAuth.verifyIdToken(idToken);

      // 管理者のみフォーム一覧を取得可能
      if (decodedToken.role !== 'admin') {
        return NextResponse.json(
          { error: '管理者権限が必要です' },
          { status: 403 }
        );
      }
    } catch (authError) {
      console.error('認証エラー:', authError);
      return NextResponse.json(
        { error: '認証に失敗しました' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId') || 'kodai2025';

    // フォーム一覧を取得（非正規化されたカウンタを使用）
    const formsSnapshot = await adminDb
      .collection('forms')
      .where('eventId', '==', eventId)
      .get();

    const forms = formsSnapshot.docs.map((doc) => {
      const formData = doc.data() as SurveyForm & { responseCount?: number; lastResponseAt?: any };
      const createdAt = (formData.createdAt as any)?.toDate ? (formData.createdAt as any).toDate() : formData.createdAt;
      const updatedAt = (formData.updatedAt as any)?.toDate ? (formData.updatedAt as any).toDate() : formData.updatedAt;
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
    return NextResponse.json(
      { error: 'フォーム一覧の取得に失敗しました' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

    // 管理者のみフォーム作成可能
    if (decodedToken.role !== 'admin') {
      return NextResponse.json(
        { error: '管理者権限が必要です' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { title, description, fields, eventId, year }: FormCreateData & { eventId?: string; year?: number } = body;
    const normalizedEventContext = normalizeFormEventContext(eventId, year);

    if (!normalizedEventContext) {
      return NextResponse.json(
        { error: 'eventId と year を正しく指定してください' },
        { status: 400 }
      );
    }

    // バリデーション
    if (!title?.trim()) {
      return NextResponse.json(
        { error: 'フォームタイトルは必須です' },
        { status: 400 }
      );
    }

    if (!fields || fields.length === 0) {
      return NextResponse.json(
        { error: 'フォームフィールドを最低1つ設定してください' },
        { status: 400 }
      );
    }

    const existingFormSnapshot = await adminDb
      .collection('forms')
      .where('eventId', '==', normalizedEventContext.eventId)
      .limit(1)
      .get();

    if (!existingFormSnapshot.empty) {
      return NextResponse.json(
        { error: 'この年度には既にフォームが存在します' },
        { status: 409 }
      );
    }

    // フィールドのバリデーション
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];
      if (!field.label?.trim()) {
        return NextResponse.json(
          { error: `フィールド${i + 1}のラベルは必須です` },
          { status: 400 }
        );
      }
      if (!['text', 'select', 'radio', 'checkbox', 'textarea', 'number'].includes(field.type)) {
        return NextResponse.json(
          { error: `フィールド${i + 1}の種類が無効です` },
          { status: 400 }
        );
      }
      if (['select', 'radio', 'checkbox'].includes(field.type) && (!field.options || field.options.length === 0)) {
        return NextResponse.json(
          { error: `フィールド${i + 1}の選択肢を設定してください` },
          { status: 400 }
        );
      }
    }

    const now = new Date();
    const formData: Omit<SurveyForm, 'formId'> & { responseCount: number } = {
      title: title.trim(),
      description: description?.trim() || '',
      isActive: true,
      eventId: normalizedEventContext.eventId,
      year: normalizedEventContext.year,
      fields: fields.map((field, index) => ({
        ...field,
        fieldId: index === 0 ? 'availability' : 'remarks',
        label: field.label.trim(),
        order: index,
      })),
      createdBy: decodedToken.uid,
      createdAt: now,
      updatedAt: now,
      responseCount: 0,
    };

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
    return NextResponse.json(
      { error: 'フォームの作成に失敗しました' },
      { status: 500 }
    );
  }
}
