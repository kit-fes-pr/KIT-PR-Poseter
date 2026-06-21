import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { normalizeAdjacentAreas } from '@/lib/utils/area';

const FIRESTORE_SAFE_BATCH_SIZE = 450;

async function commitTeamUpdatesInChunks(
  updates: Array<{ ref: FirebaseFirestore.DocumentReference; data: Record<string, unknown> }>,
) {
  for (let index = 0; index < updates.length; index += FIRESTORE_SAFE_BATCH_SIZE) {
    const batch = adminDb.batch();
    const chunk = updates.slice(index, index + FIRESTORE_SAFE_BATCH_SIZE);
    chunk.forEach((update) => {
      batch.update(update.ref, update.data);
    });
    await batch.commit();
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ areaId: string }> },
) {
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
      return NextResponse.json(
        {
          error: 'areaCode, areaName は必須です',
        },
        { status: 400 },
      );
    }

    // 区域の存在確認
    const areaRef = adminDb.collection('areas').doc(areaId);
    const areaDoc = await areaRef.get();
    if (!areaDoc.exists) {
      return NextResponse.json({ error: '指定された配布区域が見つかりません' }, { status: 404 });
    }
    const currentArea = areaDoc.data() as Record<string, unknown>;

    // 区域コードは全体で一意にする
    const existingSnap = await adminDb.collection('areas').where('areaCode', '==', areaCode).get();

    const conflictDocs = existingSnap.docs.filter((doc) => doc.id !== areaId);
    if (conflictDocs.length > 0) {
      return NextResponse.json(
        {
          error: 'この区域コードは既に他の区域で使用されています',
        },
        { status: 400 },
      );
    }

    const nextAdjacentAreas =
      typeof adjacentAreas === 'string'
        ? normalizeAdjacentAreas(
            adjacentAreas
              .split(',')
              .map((area) => area.trim())
              .filter(Boolean),
          )
        : normalizeAdjacentAreas(adjacentAreas);
    const updateData = {
      areaCode,
      areaName,
      adjacentAreas: nextAdjacentAreas,
      description: description || '',
      updatedAt: new Date(),
    };

    await areaRef.update(updateData);

    const previousAreaCode = String(currentArea.areaCode || '');
    const previousAdjacentAreas = normalizeAdjacentAreas(currentArea.adjacentAreas).sort((a, b) =>
      a.localeCompare(b, 'ja'),
    );
    const sortedNextAdjacentAreas = [...nextAdjacentAreas].sort((a, b) => a.localeCompare(b, 'ja'));
    const adjacentChanged =
      JSON.stringify(previousAdjacentAreas) !== JSON.stringify(sortedNextAdjacentAreas);
    if (previousAreaCode !== areaCode || adjacentChanged) {
      const teamsSnap = await adminDb.collection('teams').get();
      const updates: Array<{
        ref: FirebaseFirestore.DocumentReference;
        data: Record<string, unknown>;
      }> = [];
      teamsSnap.docs.forEach((teamDoc) => {
        const teamData = teamDoc.data() as Record<string, unknown>;
        if (
          String(teamData.areaId || '') === areaId ||
          (previousAreaCode && String(teamData.assignedArea || '') === previousAreaCode)
        ) {
          updates.push({
            ref: teamDoc.ref,
            data: {
              areaId,
              assignedArea: areaCode,
              adjacentAreas: nextAdjacentAreas,
              updatedAt: new Date(),
            },
          });
        }
      });
      if (updates.length > 0) {
        await commitTeamUpdatesInChunks(updates);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('配布区域更新エラー:', error);
    return NextResponse.json({ error: '配布区域の更新に失敗しました' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ areaId: string }> },
) {
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
    const [linkedByAreaId, linkedByAssignedArea] = await Promise.all([
      adminDb.collection('teams').where('areaId', '==', areaId).limit(1).get(),
      currentArea.areaCode
        ? adminDb
            .collection('teams')
            .where('assignedArea', '==', String(currentArea.areaCode))
            .limit(1)
            .get()
        : Promise.resolve(null),
    ]);
    if (!linkedByAreaId.empty || (linkedByAssignedArea ? !linkedByAssignedArea.empty : false)) {
      return NextResponse.json(
        { error: 'この配布区域に紐づくチームがあるため削除できません' },
        { status: 400 },
      );
    }
    await areaRef.delete();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('配布区域削除エラー:', error);
    return NextResponse.json({ error: '配布区域の削除に失敗しました' }, { status: 500 });
  }
}
