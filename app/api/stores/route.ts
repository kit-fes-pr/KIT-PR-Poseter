import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { Store } from '@/types';

function generateKana(text: string): string {
  return text;
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
    const decodedToken = await adminAuth.verifyIdToken(idToken);

    const { searchParams } = new URL(request.url);
    const area = searchParams.get('area');
    const status = searchParams.get('status');
    const q = searchParams.get('q');

    let query = adminDb.collection('stores')
      .where('eventId', '==', 'kohdai2025');

    if (area && decodedToken.role === 'team') {
      const teamDoc = await adminDb.collection('teams').doc(decodedToken.teamId).get();
      const teamData = teamDoc.data();
      
      if (teamData) {
        const allowedAreas = [teamData.assignedArea, ...teamData.adjacentAreas];
        query = query.where('areaCode', 'in', allowedAreas);
      }
    } else if (area) {
      query = query.where('areaCode', '==', area);
    }

    if (status) {
      query = query.where('distributionStatus', '==', status);
    }

    const snapshot = await query.get();
    let stores = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as unknown as Store[];

    if (q) {
      const searchTerm = q.toLowerCase();
      stores = stores.filter(store => 
        store.storeName.toLowerCase().includes(searchTerm) ||
        store.address.toLowerCase().includes(searchTerm)
      );
    }

    stores.sort((a, b) => {
      const nameCompare = a.storeNameKana.localeCompare(b.storeNameKana, 'ja');
      if (nameCompare !== 0) return nameCompare;
      return a.addressKana.localeCompare(b.addressKana, 'ja');
    });

    return NextResponse.json({ stores });

  } catch (error) {
    console.error('Get stores error:', error);
    return NextResponse.json(
      { error: '店舗情報の取得に失敗しました' },
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

    const {
      storeName,
      address,
      distributionStatus,
      failureReason,
      distributedCount,
      areaCode
    } = await request.json();

    if (!storeName || !address) {
      return NextResponse.json(
        { error: '店名と住所は必須です' },
        { status: 400 }
      );
    }

    const storeRef = adminDb.collection('stores').doc();
    const storeData: Omit<Store, 'storeId'> = {
      storeName,
      storeNameKana: generateKana(storeName),
      address,
      addressKana: generateKana(address),
      areaCode: areaCode || decodedToken.teamCode?.split('-')[0] || 'unknown',
      distributionStatus: distributionStatus || 'pending',
      ...(failureReason && { failureReason }),
      distributedCount: distributedCount || 0,
      distributedBy: decodedToken.teamCode || '',
      ...(distributionStatus === 'completed' && { distributedAt: new Date() }),
      registrationMethod: 'manual',
      eventId: 'kohdai2025',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await storeRef.set({
      storeId: storeRef.id,
      ...storeData
    });

    return NextResponse.json({
      success: true,
      store: {
        id: storeRef.id,
        storeId: storeRef.id,
        ...storeData
      }
    });

  } catch (error) {
    console.error('Create store error:', error);
    return NextResponse.json(
      { error: '店舗の登録に失敗しました' },
      { status: 500 }
    );
  }
}