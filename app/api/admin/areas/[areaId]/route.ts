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

export async function PUT(request: NextRequest, { params }: { params: Promise<{ areaId: string }> }) {
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

    const resolvedParams = await params;
    const { areaId } = resolvedParams;
    const { areaCode, areaName, adjacentAreas, description } = await request.json();

    if (!areaCode || !areaName) {
      return NextResponse.json({
        error: 'areaCode, areaName は必須です'
      }, { status: 400 });
    }

    // 区域の存在確認
    const areaRef = adminDb.collection('areas').doc(areaId);
    const areaDoc = await areaRef.get();
    if (!areaDoc.exists) {
      return NextResponse.json({ error: '指定された配布区域が見つかりません' }, { status: 404 });
    }
    const currentArea = areaDoc.data() as Record<string, unknown>;

    // 区域コードは全体で一意にする
    const existingSnap = await adminDb.collection('areas')
      .where('areaCode', '==', areaCode)
      .get();

    const conflictDocs = existingSnap.docs.filter(doc => doc.id !== areaId);
    if (conflictDocs.length > 0) {
      return NextResponse.json({ 
        error: 'この区域コードは既に他の区域で使用されています' 
      }, { status: 400 });
    }

    const nextAdjacentAreas = normalizeAdjacentAreas(adjacentAreas);
    const updateData = {
      areaCode,
      areaName,
      adjacentAreas: nextAdjacentAreas,
      description: description || '',
      updatedAt: new Date()
    };

    await areaRef.update(updateData);

    const previousAreaCode = String(currentArea.areaCode || '');
    const previousAdjacentAreas = normalizeAdjacentAreas(currentArea.adjacentAreas).sort((a, b) => a.localeCompare(b, 'ja'));
    const sortedNextAdjacentAreas = [...nextAdjacentAreas].sort((a, b) => a.localeCompare(b, 'ja'));
    const adjacentChanged = JSON.stringify(previousAdjacentAreas) !== JSON.stringify(sortedNextAdjacentAreas);
    if (previousAreaCode !== areaCode || adjacentChanged) {
      const teamsSnap = await adminDb.collection('teams').get();
      const batch = adminDb.batch();
      let touched = 0;
      teamsSnap.docs.forEach((teamDoc) => {
        const teamData = teamDoc.data() as Record<string, unknown>;
        if (String(teamData.areaId || '') === areaId || String(teamData.assignedArea || '') === previousAreaCode) {
          batch.update(teamDoc.ref, {
            areaId,
            assignedArea: areaCode,
            adjacentAreas: nextAdjacentAreas,
            updatedAt: new Date(),
          });
          touched++;
        }
      });
      if (touched > 0) {
        await batch.commit();
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('配布区域更新エラー:', error);
    return NextResponse.json({ error: '配布区域の更新に失敗しました' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ areaId: string }> }) {
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

    const resolvedParams = await params;
    const { areaId } = resolvedParams;

    // 区域の存在確認
    const areaRef = adminDb.collection('areas').doc(areaId);
    const areaDoc = await areaRef.get();
    if (!areaDoc.exists) {
      return NextResponse.json({ error: '指定された配布区域が見つかりません' }, { status: 404 });
    }

    const currentArea = areaDoc.data() as Record<string, unknown>;
    const teamsSnap = await adminDb.collection('teams').get();
    const linkedTeams = teamsSnap.docs.filter((teamDoc) => {
      const teamData = teamDoc.data() as Record<string, unknown>;
      return String(teamData.areaId || '') === areaId || String(teamData.assignedArea || '') === String(currentArea.areaCode || '');
    });
    if (linkedTeams.length > 0) {
      return NextResponse.json({ error: 'この配布区域に紐づくチームがあるため削除できません' }, { status: 400 });
    }
    await areaRef.delete();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('配布区域削除エラー:', error);
    return NextResponse.json({ error: '配布区域の削除に失敗しました' }, { status: 500 });
  }
}
