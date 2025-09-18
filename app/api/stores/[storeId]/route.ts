import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string }> }
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

    const {
      distributionStatus,
      failureReason,
      distributedCount
    } = await request.json();

    const resolvedParams = await params;
    const storeRef = adminDb.collection('stores').doc(resolvedParams.storeId);
    const storeDoc = await storeRef.get();

    if (!storeDoc.exists) {
      return NextResponse.json(
        { error: '店舗が見つかりません' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {
      distributionStatus,
      distributedBy: decodedToken.teamCode || '',
      updatedAt: new Date()
    };

    if (distributionStatus === 'completed') {
      updateData.distributedAt = new Date();
      updateData.distributedCount = distributedCount || 0;
    } else if (distributionStatus === 'failed' && failureReason) {
      updateData.failureReason = failureReason;
    }

    await storeRef.update(updateData);

    const updatedDoc = await storeRef.get();
    const updatedStore = {
      id: updatedDoc.id,
      ...updatedDoc.data()
    };

    return NextResponse.json({
      success: true,
      store: updatedStore
    });

  } catch (error) {
    console.error('Update store error:', error);
    return NextResponse.json(
      { error: '店舗情報の更新に失敗しました' },
      { status: 500 }
    );
  }
}