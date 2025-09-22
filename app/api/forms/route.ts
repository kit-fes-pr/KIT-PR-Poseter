import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { SurveyForm, FormCreateData } from '@/types/forms';

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
    const eventId = searchParams.get('eventId') || 'kohdai2025';

    // フォーム一覧を取得（インデックスエラーを避けるため、orderByなしで取得してからソート）
    const formsSnapshot = await adminDb
      .collection('forms')
      .where('eventId', '==', eventId)
      .get();

    const forms = [];
    for (const doc of formsSnapshot.docs) {
      const formData = doc.data() as SurveyForm;
      
      // 回答数を取得
      const responsesSnapshot = await adminDb
        .collection('forms')
        .doc(doc.id)
        .collection('responses')
        .get();
      
      const responseCount = responsesSnapshot.size;
      let lastResponseAt: Date | undefined;
      
      if (responseCount > 0) {
        const lastResponse = responsesSnapshot.docs
          .sort((a, b) => b.data().submittedAt.toDate().getTime() - a.data().submittedAt.toDate().getTime())[0];
        lastResponseAt = lastResponse.data().submittedAt.toDate();
      }

      forms.push({
        ...formData,
        formId: doc.id,
        responseCount,
        lastResponseAt,
      });
    }

    // createdAtでソート（新しい順）
    forms.sort((a, b) => {
      const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
      const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
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
    const formData: Omit<SurveyForm, 'formId'> = {
      title: title.trim(),
      description: description?.trim() || '',
      isActive: true,
      eventId: eventId || 'kohdai2025',
      year: year || 2025,
      fields: fields.map((field, index) => ({
        ...field,
        fieldId: index === 0 ? 'availability' : 'remarks',
        label: field.label.trim(),
        order: index,
      })),
      createdBy: decodedToken.uid,
      createdAt: now,
      updatedAt: now,
    };

    // Firestoreに保存
    const docRef = await adminDb.collection('forms').add(formData);

    return NextResponse.json({
      message: 'フォームが作成されました',
      formId: docRef.id,
      form: {
        ...formData,
        formId: docRef.id,
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