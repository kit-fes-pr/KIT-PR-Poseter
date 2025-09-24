import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { Team } from '@/types';

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

    if (decodedToken.role !== 'admin') {
      return NextResponse.json(
        { error: '管理者権限が必要です' },
        { status: 403 }
      );
    }

    const {
      teamCode,
      teamName,
      timeSlot,
      assignedArea,
      adjacentAreas,
      eventId,
      validStartDate,
      validEndDate
    } = await request.json();

    if (!teamCode || !teamName || !assignedArea || !eventId) {
      return NextResponse.json(
        { error: '必須フィールドが不足しています' },
        { status: 400 }
      );
    }

    // Check if team code already exists
    const existingTeam = await adminDb.collection('teams')
      .where('teamCode', '==', teamCode)
      .where('eventId', '==', eventId)
      .limit(1)
      .get();

    if (!existingTeam.empty) {
      return NextResponse.json(
        { error: 'このチームコードは既に使用されています' },
        { status: 400 }
      );
    }

    const teamRef = adminDb.collection('teams').doc();
    const teamData: Omit<Team, 'teamId'> = {
      teamCode,
      teamName,
      timeSlot: timeSlot || 'both', // フォームからの値を使用、未設定時は両方対応
      assignedArea,
      adjacentAreas: adjacentAreas || [],
      eventId,
      isActive: true,
      validStartDate: validStartDate ? new Date(validStartDate) : undefined,
      validEndDate: validEndDate ? new Date(validEndDate) : undefined,
      createdAt: new Date()
    };

    await teamRef.set({
      teamId: teamRef.id,
      ...teamData
    });

    return NextResponse.json({
      success: true,
      team: {
        id: teamRef.id,
        teamId: teamRef.id,
        ...teamData
      }
    });

  } catch (error) {
    console.error('Create team error:', error);
    return NextResponse.json(
      { error: 'チームの作成に失敗しました' },
      { status: 500 }
    );
  }
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

    if (decodedToken.role !== 'admin') {
      return NextResponse.json(
        { error: '管理者権限が必要です' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const eventIdParam = searchParams.get('eventId');
    const yearParam = searchParams.get('year');

    let targetEventId = eventIdParam || 'kohdai2025';
    if (!eventIdParam && yearParam) {
      const y = parseInt(yearParam);
      const evSnap = await adminDb.collection('distributionEvents').where('year', '==', y).limit(1).get();
      if (!evSnap.empty) targetEventId = evSnap.docs[0].id;
    }

    const teamsSnapshot = await adminDb.collection('teams')
      .where('eventId', '==', targetEventId)
      .where('isActive', '==', true)
      .get();

    const teams = teamsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json({ teams });

  } catch (error) {
    console.error('Get teams error:', error);
    return NextResponse.json(
      { error: 'チーム情報の取得に失敗しました' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
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

    const { teamId, validDate, validStartDate, validEndDate } = await request.json();
    if (!teamId) {
      return NextResponse.json({ error: 'teamId は必須です' }, { status: 400 });
    }

    const ref = adminDb.collection('teams').doc(String(teamId));
    const doc = await ref.get();
    if (!doc.exists) return NextResponse.json({ error: 'チームが見つかりません' }, { status: 404 });

    const update: Record<string, unknown> = { updatedAt: new Date() };
    // 後方互換: validDate が来たら単日として両端にセット
    if (validDate) {
      const d = new Date(validDate);
      if (isNaN(d.getTime())) return NextResponse.json({ error: 'validDate の形式が不正です' }, { status: 400 });
      update.validStartDate = d;
      update.validEndDate = d;
    }
    if (validStartDate) {
      const s = new Date(validStartDate);
      if (isNaN(s.getTime())) return NextResponse.json({ error: 'validStartDate の形式が不正です' }, { status: 400 });
      update.validStartDate = s;
    }
    if (validEndDate) {
      const e = new Date(validEndDate);
      if (isNaN(e.getTime())) return NextResponse.json({ error: 'validEndDate の形式が不正です' }, { status: 400 });
      update.validEndDate = e;
    }

    if (!('validStartDate' in update) && !('validEndDate' in update)) {
      return NextResponse.json({ error: '更新対象のフィールドがありません' }, { status: 400 });
    }

    await ref.update(update);
    const updated = await ref.get();
    return NextResponse.json({ success: true, team: { id: updated.id, ...(updated.data() as Record<string, unknown>) } });
  } catch (error) {
    console.error('Update team error:', error);
    return NextResponse.json({ error: 'チームの更新に失敗しました' }, { status: 500 });
  }
}
