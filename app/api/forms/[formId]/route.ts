/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { SurveyForm, FormUpdateData } from '@/types/forms';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  try {
    const resolvedParams = await params;
    
    // 公開されたフォームは認証なしでアクセス可能
    const formDoc = await adminDb.collection('forms').doc(resolvedParams.formId).get();
    
    if (!formDoc.exists) {
      return NextResponse.json(
        { error: 'フォームが見つかりません' },
        { status: 404 }
      );
    }

    const formData = formDoc.data() as SurveyForm;
    
    // フォームが非アクティブの場合は管理者のみアクセス可能
    if (!formData.isActive) {
      const authHeader = request.headers.get('authorization');
      
      if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json(
          { error: 'このフォームは現在利用できません' },
          { status: 403 }
        );
      }

      const idToken = authHeader.split('Bearer ')[1];
      const decodedToken = await adminAuth.verifyIdToken(idToken);

      if (decodedToken.role !== 'admin') {
        return NextResponse.json(
          { error: 'このフォームは現在利用できません' },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({
      ...formData,
      formId: formDoc.id,
      createdAt: (formData.createdAt as any)?.toDate ? (formData.createdAt as any).toDate() : formData.createdAt,
      updatedAt: (formData.updatedAt as any)?.toDate ? (formData.updatedAt as any).toDate() : formData.updatedAt,
    });
  } catch (error) {
    console.error('フォーム取得エラー:', error);
    return NextResponse.json(
      { error: 'フォームの取得に失敗しました' },
      { status: 500 }
    );
  }
}


export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
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

    // 管理者のみフォーム更新可能
    if (decodedToken.role !== 'admin') {
      return NextResponse.json(
        { error: '管理者権限が必要です' },
        { status: 403 }
      );
    }

    const resolvedParams = await params;
    const updateData: FormUpdateData = await request.json();

    // フォームの存在確認
    const formDoc = await adminDb.collection('forms').doc(resolvedParams.formId).get();
    
    if (!formDoc.exists) {
      return NextResponse.json(
        { error: 'フォームが見つかりません' },
        { status: 404 }
      );
    }

    // 更新データの準備
    const now = new Date();
    const updateFields: Record<string, unknown> = {
      updatedAt: now,
    };

    if (updateData.title !== undefined) {
      if (!updateData.title.trim()) {
        return NextResponse.json(
          { error: 'フォームタイトルは必須です' },
          { status: 400 }
        );
      }
      updateFields.title = updateData.title.trim();
    }

    if (updateData.description !== undefined) {
      updateFields.description = updateData.description.trim();
    }

    if (updateData.isActive !== undefined) {
      updateFields.isActive = updateData.isActive;
    }

    if (updateData.fields !== undefined) {
      // フィールドのバリデーション
      for (let i = 0; i < updateData.fields.length; i++) {
        const field = updateData.fields[i];
        if (!field.label?.trim()) {
          return NextResponse.json(
            { error: `フィールド${i + 1}のラベルは必須です` },
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
      updateFields.fields = updateData.fields.map((field, index) => ({
        ...field,
        fieldId: field.fieldId || `field_${index + 1}`,
        order: index,
      }));
    }

    // フォームを更新
    await adminDb.collection('forms').doc(resolvedParams.formId).update(updateFields);

    // 更新されたフォームを取得
    const updatedFormDoc = await adminDb.collection('forms').doc(resolvedParams.formId).get();
    const updatedFormData = updatedFormDoc.data() as SurveyForm;

    return NextResponse.json({
      message: 'フォームが更新されました',
      form: {
        ...updatedFormData,
        formId: updatedFormDoc.id,
      },
    });
  } catch (error) {
    console.error('フォーム更新エラー:', error);
    return NextResponse.json(
      { error: 'フォームの更新に失敗しました' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
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

    // 管理者のみフォーム削除可能
    if (decodedToken.role !== 'admin') {
      return NextResponse.json(
        { error: '管理者権限が必要です' },
        { status: 403 }
      );
    }

    const resolvedParams = await params;
    
    // フォームの存在確認
    const formDoc = await adminDb.collection('forms').doc(resolvedParams.formId).get();
    
    if (!formDoc.exists) {
      return NextResponse.json(
        { error: 'フォームが見つかりません' },
        { status: 404 }
      );
    }

    // 回答が存在する場合は削除を拒否
    const responsesSnapshot = await adminDb
      .collection('forms')
      .doc(resolvedParams.formId)
      .collection('responses')
      .limit(1)
      .get();

    if (!responsesSnapshot.empty) {
      return NextResponse.json(
        { error: '回答が存在するフォームは削除できません' },
        { status: 400 }
      );
    }

    // フォームを削除
    await adminDb.collection('forms').doc(resolvedParams.formId).delete();

    return NextResponse.json({
      message: 'フォームが削除されました',
    });
  } catch (error) {
    console.error('フォーム削除エラー:', error);
    return NextResponse.json(
      { error: 'フォームの削除に失敗しました' },
      { status: 500 }
    );
  }
}
