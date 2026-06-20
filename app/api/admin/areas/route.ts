import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

function normalizeAdjacentAreas(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

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

    const snap = await adminDb.collection('areas').get();
    const areas = snap.docs.map((doc) => ({
      areaId: doc.id,
      ...(doc.data() as { areaCode?: string; areaName?: string; adjacentAreas?: string[]; description?: string; createdAt?: { toDate?: () => Date } | Date }),
      createdAt: doc.data().createdAt?.toDate() || new Date()
    })).sort((a, b) => String(a.areaCode || '').localeCompare(String(b.areaCode || ''), 'ja'));

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

    const { areaCode, areaName, adjacentAreas, description } = await request.json();

    if (!areaCode || !areaName) {
      return NextResponse.json({
        error: 'areaCode, areaName は必須です'
      }, { status: 400 });
    }

    // 区域コードが重複していないかチェック
    const existingSnap = await adminDb.collection('areas')
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
      adjacentAreas: normalizeAdjacentAreas(adjacentAreas),
      description: description || '',
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
