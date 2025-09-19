import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
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

    const { teamId } = await params;
    const doc = await adminDb.collection('teams').doc(teamId).get();
    if (!doc.exists) return NextResponse.json({ error: 'チームが見つかりません' }, { status: 404 });
    return NextResponse.json({ team: { id: doc.id, ...(doc.data() as any) } });
  } catch (error) {
    console.error('Get team error:', error);
    return NextResponse.json({ error: 'チーム情報の取得に失敗しました' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
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

    const { teamId } = await params;
    const body = await request.json();
    const ref = adminDb.collection('teams').doc(teamId);
    const doc = await ref.get();
    if (!doc.exists) return NextResponse.json({ error: 'チームが見つかりません' }, { status: 404 });

    const update: Record<string, any> = { updatedAt: new Date() };
    if (typeof body.teamName === 'string') update.teamName = body.teamName;
    if (typeof body.timeSlot === 'string') update.timeSlot = body.timeSlot;
    if (typeof body.assignedArea === 'string') update.assignedArea = body.assignedArea;
    if (typeof body.isActive === 'boolean') update.isActive = body.isActive;
    if (Array.isArray(body.adjacentAreas)) update.adjacentAreas = body.adjacentAreas;
    if (typeof body.adjacentAreas === 'string') update.adjacentAreas = body.adjacentAreas.split(',').map((s: string) => s.trim());
    if (body.validDate) {
      const d = new Date(body.validDate);
      if (isNaN(d.getTime())) return NextResponse.json({ error: 'validDate の形式が不正です' }, { status: 400 });
      update.validDate = d;
    }

    await ref.update(update);
    const updated = await ref.get();
    return NextResponse.json({ success: true, team: { id: updated.id, ...(updated.data() as any) } });
  } catch (error) {
    console.error('Update team error:', error);
    return NextResponse.json({ error: 'チーム情報の更新に失敗しました' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
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

    const { teamId } = await params;
    const ref = adminDb.collection('teams').doc(teamId);
    const doc = await ref.get();
    if (!doc.exists) return NextResponse.json({ error: 'チームが見つかりません' }, { status: 404 });
    const team = doc.data() as any;

    // 依存チェック: stores.distributedBy == team.teamCode
    const depStores = await adminDb.collection('stores').where('distributedBy', '==', team.teamCode).limit(1).get();
    if (!depStores.empty) return NextResponse.json({ error: '関連する配布記録があるため削除できません' }, { status: 409 });

    await ref.delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete team error:', error);
    return NextResponse.json({ error: 'チームの削除に失敗しました' }, { status: 500 });
  }
}

