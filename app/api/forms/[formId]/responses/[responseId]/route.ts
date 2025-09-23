/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { FormAnswer, SurveyForm } from '@/types/forms';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ formId: string; responseId: string }> }
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

    // 管理者のみ回答を更新可能
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

    const formData = formDoc.data() as SurveyForm;

    // 回答の存在確認
    const responseRef = adminDb
      .collection('forms')
      .doc(resolvedParams.formId)
      .collection('responses')
      .doc(resolvedParams.responseId);

    const responseDoc = await responseRef.get();
    
    if (!responseDoc.exists) {
      return NextResponse.json(
        { error: '回答が見つかりません' },
        { status: 404 }
      );
    }

    const { answers, participantData } = await request.json();

    // 回答データのバリデーション
    if (!answers || !Array.isArray(answers)) {
      return NextResponse.json(
        { error: '回答データが正しくありません' },
        { status: 400 }
      );
    }

    // 参加者データのバリデーション
    if (participantData) {
      const participantValidationErrors: string[] = [];
      
      if (!participantData.name || typeof participantData.name !== 'string' || participantData.name.trim() === '') {
        participantValidationErrors.push('お名前は必須です');
      }
      
      if (!participantData.section || typeof participantData.section !== 'string' || participantData.section.trim() === '') {
        participantValidationErrors.push('所属セクションは必須です');
      }
      
      const gradeNum = parseInt(participantData.grade);
      if (!participantData.grade || isNaN(gradeNum) || gradeNum < 1 || gradeNum > 4) {
        participantValidationErrors.push('学年は1-4の範囲で選択してください');
      }
      
      if (!participantData.availableTime || !['morning', 'afternoon', 'both'].includes(participantData.availableTime)) {
        participantValidationErrors.push('参加可能時間帯は必須です');
      }
      
      if (participantValidationErrors.length > 0) {
        return NextResponse.json(
          { error: '参加者情報の入力エラーがあります', details: participantValidationErrors },
          { status: 400 }
        );
      }
    }

    // 各フィールドのバリデーション
    const validationErrors: string[] = [];
    
    for (const field of formData.fields) {
      const answer = answers.find((a: FormAnswer) => a.fieldId === field.fieldId);
      
      // 必須フィールドのチェック
      if (field.required) {
        if (!answer || !answer.value || 
            (Array.isArray(answer.value) && answer.value.length === 0) ||
            (typeof answer.value === 'string' && answer.value.trim() === '')) {
          validationErrors.push(`${field.label}は必須です`);
          continue;
        }
      }

      if (answer && answer.value) {
        // 型別バリデーション
        switch (field.type) {
          case 'text':
          case 'textarea':
            if (typeof answer.value !== 'string') {
              validationErrors.push(`${field.label}は文字列で入力してください`);
            } else {
              if (field.validation?.minLength && answer.value.length < field.validation.minLength) {
                validationErrors.push(`${field.label}は${field.validation.minLength}文字以上で入力してください`);
              }
              if (field.validation?.maxLength && answer.value.length > field.validation.maxLength) {
                validationErrors.push(`${field.label}は${field.validation.maxLength}文字以下で入力してください`);
              }
              if (field.validation?.pattern) {
                const regex = new RegExp(field.validation.pattern);
                if (!regex.test(answer.value)) {
                  validationErrors.push(`${field.label}の形式が正しくありません`);
                }
              }
            }
            break;

          case 'number':
            const numValue = Number(answer.value);
            if (isNaN(numValue)) {
              validationErrors.push(`${field.label}は数値で入力してください`);
            } else {
              if (field.validation?.min !== undefined && numValue < field.validation.min) {
                validationErrors.push(`${field.label}は${field.validation.min}以上で入力してください`);
              }
              if (field.validation?.max !== undefined && numValue > field.validation.max) {
                validationErrors.push(`${field.label}は${field.validation.max}以下で入力してください`);
              }
            }
            break;

          case 'select':
          case 'radio':
            if (typeof answer.value !== 'string' || !field.options?.includes(answer.value)) {
              validationErrors.push(`${field.label}の選択肢が正しくありません`);
            }
            break;

          case 'checkbox':
            if (!Array.isArray(answer.value)) {
              validationErrors.push(`${field.label}は配列で入力してください`);
            } else {
              for (const val of answer.value) {
                if (typeof val !== 'string' || !field.options?.includes(val)) {
                  validationErrors.push(`${field.label}の選択肢が正しくありません`);
                  break;
                }
              }
            }
            break;
        }
      }
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: '入力エラーがあります', details: validationErrors },
        { status: 400 }
      );
    }

    // 回答データを更新
    const now = new Date();
    
    // 更新データを構築
    let updateData: { [key: string]: any };
    
    if (participantData) {
      updateData = {
        answers: answers.map((answer: FormAnswer) => ({
          fieldId: answer.fieldId,
          value: answer.value,
        })),
        updatedAt: now,
        participantData: {
          name: participantData.name,
          section: participantData.section,
          grade: parseInt(participantData.grade),
          availableTime: participantData.availableTime,
        },
      };
    } else {
      updateData = {
        answers: answers.map((answer: FormAnswer) => ({
          fieldId: answer.fieldId,
          value: answer.value,
        })),
        updatedAt: now,
      };
    }

    await responseRef.update(updateData);

    return NextResponse.json({
      message: '回答を更新しました',
      responseId: resolvedParams.responseId,
    });
  } catch (error) {
    console.error('回答更新エラー:', error);
    return NextResponse.json(
      { error: '回答の更新に失敗しました' },
      { status: 500 }
    );
  }
}
