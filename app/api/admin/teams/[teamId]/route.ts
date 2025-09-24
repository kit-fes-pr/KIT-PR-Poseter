import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

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
    if (typeof body.assignedArea === 'string') update.assignedArea = body.assignedArea;
    if (typeof body.timeSlot === 'string') update.timeSlot = body.timeSlot;
    if (typeof body.isActive === 'boolean') update.isActive = body.isActive;
    if (Array.isArray(body.adjacentAreas)) update.adjacentAreas = body.adjacentAreas;
    if (typeof body.adjacentAreas === 'string') update.adjacentAreas = body.adjacentAreas.split(',').map((s: string) => s.trim());
    // validStartDate / validEndDate に対応（後方互換で validDate が来たら両端に同じ日を設定）
    if (body.validDate) {
      const d = new Date(body.validDate);
      if (isNaN(d.getTime())) return NextResponse.json({ error: 'validDate の形式が不正です' }, { status: 400 });
      update.validStartDate = d;
      update.validEndDate = d;
    }
    if (body.validStartDate) {
      const s = new Date(body.validStartDate);
      if (isNaN(s.getTime())) return NextResponse.json({ error: 'validStartDate の形式が不正です' }, { status: 400 });
      update.validStartDate = s;
    }
    if (body.validEndDate) {
      const e = new Date(body.validEndDate);
      if (isNaN(e.getTime())) return NextResponse.json({ error: 'validEndDate の形式が不正です' }, { status: 400 });
      update.validEndDate = e;
    }

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