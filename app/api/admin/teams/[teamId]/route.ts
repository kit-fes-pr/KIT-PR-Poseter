import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { normalizeAdjacentAreas } from '@/lib/utils/area';
import { buildAvailabilitySlotChoices, normalizeAvailabilitySlots } from '@/lib/utils/availability';

const TEAM_TIME_SLOT_PATTERN = /^\d{4}-\d{2}-\d{2}_(am|pm)$/;

async function loadEventAvailabilitySlots(eventId: string): Promise<string[]> {
  const snap = await adminDb.collection('distributionEvents').doc(eventId).get();
  if (!snap.exists) return [];
  const data = snap.data() as Record<string, unknown>;
  const stored = normalizeAvailabilitySlots(data.distributionAvailabilitySlots);
  if (stored.length > 0) return stored;
  return buildAvailabilitySlotChoices(data.distributionStartDate, data.distributionEndDate).map((choice) => choice.key);
}

async function loadAreaForTeam(areaId: unknown, assignedArea: unknown) {
  if (typeof areaId === 'string' && areaId) {
    const doc = await adminDb.collection('areas').doc(areaId).get();
    if (doc.exists) return { areaId: doc.id, ...(doc.data() as Record<string, unknown>) };
  }
  if (typeof assignedArea === 'string' && assignedArea) {
    const snap = await adminDb.collection('areas').where('areaCode', '==', assignedArea).limit(1).get();
    if (!snap.empty) {
      const doc = snap.docs[0];
      return { areaId: doc.id, ...(doc.data() as Record<string, unknown>) };
    }
  }
  return null;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await context.params;
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);

    if (decodedToken.role !== 'admin') {
      return NextResponse.json(
        { error: '管理者権限が必要です' },
        { status: 403 }
      );
    }

    const ref = adminDb.collection('teams').doc(String(teamId));
    const doc = await ref.get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: 'チームが見つかりません' },
        { status: 404 }
      );
    }

    const team = { teamId: doc.id, ...doc.data() };
    return NextResponse.json({ team });
  } catch (error) {
    console.error('チーム取得エラー:', error);
    return NextResponse.json(
      { error: 'チームの取得に失敗しました' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await context.params;
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);

    if (decodedToken.role !== 'admin') {
      return NextResponse.json(
        { error: '管理者権限が必要です' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const ref = adminDb.collection('teams').doc(String(teamId));
    const doc = await ref.get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: 'チームが見つかりません' },
        { status: 404 }
      );
    }

    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof body.teamName === 'string') update.teamName = body.teamName;
    if (typeof body.teamCode === 'string') update.teamCode = body.teamCode;
    if (typeof body.assignedArea === 'string' || typeof body.areaId === 'string') {
      const area = await loadAreaForTeam(body.areaId, body.assignedArea);
      if (!area) {
        return NextResponse.json({ error: '配布区域が見つかりません' }, { status: 400 });
      }
      update.areaId = String((area as Record<string, unknown>).areaId || body.areaId || '');
      update.assignedArea = String((area as Record<string, unknown>).areaCode || body.assignedArea || '');
      update.adjacentAreas = normalizeAdjacentAreas((area as Record<string, unknown>).adjacentAreas);
    }
    if (typeof body.timeSlot === 'string') {
      if (!TEAM_TIME_SLOT_PATTERN.test(body.timeSlot)) {
        return NextResponse.json({ error: 'timeSlot は YYYY-MM-DD_am または YYYY-MM-DD_pm 形式で指定してください' }, { status: 400 });
      }
      const eventId = (doc.data() as Record<string, unknown>).eventId;
      const eventAvailabilitySlots = typeof eventId === 'string'
        ? await loadEventAvailabilitySlots(eventId)
        : [];
      if (eventAvailabilitySlots.length > 0 && !eventAvailabilitySlots.includes(body.timeSlot)) {
        return NextResponse.json(
          { error: 'timeSlot は配布枠キーから選択してください' },
          { status: 400 }
        );
      }
      update.timeSlot = body.timeSlot;
    }
    if (typeof body.isActive === 'boolean') update.isActive = body.isActive;

    await ref.update(update);
    const updated = await ref.get();
    return NextResponse.json({ success: true, team: { teamId: updated.id, ...updated.data() } });
  } catch (error) {
    console.error('チーム更新エラー:', error);
    return NextResponse.json(
      { error: 'チームの更新に失敗しました' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await context.params;
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);

    if (decodedToken.role !== 'admin') {
      return NextResponse.json(
        { error: '管理者権限が必要です' },
        { status: 403 }
      );
    }

    const ref = adminDb.collection('teams').doc(String(teamId));
    const doc = await ref.get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: 'チームが見つかりません' },
        { status: 404 }
      );
    }

    const teamData = doc.data();

    // バッチ処理で削除ログとチーム削除を実行
    const batch = adminDb.batch();
    
    // 削除ログを保存
    const deletedLogRef = adminDb.collection('deletedTeams').doc();
    batch.set(deletedLogRef, {
      teamId: teamId,
      teamCode: teamData?.teamCode,
      teamName: teamData?.teamName,
      year: teamData?.year,
      deletedAt: new Date(),
      deletedBy: decodedToken.uid
    });
    
    // チームを削除
    batch.delete(ref);
    
    await batch.commit();

    return NextResponse.json({ success: true, message: 'チームを削除しました' });
  } catch (error) {
    console.error('チーム削除エラー:', error);
    return NextResponse.json(
      { error: 'チームの削除に失敗しました' },
      { status: 500 }
    );
  }
}
