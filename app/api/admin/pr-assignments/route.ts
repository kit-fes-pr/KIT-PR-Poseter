import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

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

    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    if (!year) return NextResponse.json({ error: '年度が必要です' }, { status: 400 });

    const snap = await adminDb.collection('prAssignments').where('year', '==', parseInt(year)).get();
    const assignments = snap.docs.map(d => ({ assignmentId: d.id, ...d.data() }));
    return NextResponse.json({ assignments });
  } catch (e) {
    console.error('PR割り当て取得エラー:', e);
    return NextResponse.json({ error: 'PR割り当ての取得に失敗しました' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('PR Assignment POST: Starting');
    
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('PR Assignment POST: No auth header');
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }
    
    const idToken = authHeader.split('Bearer ')[1];
    console.log('PR Assignment POST: Verifying token');
    
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    console.log('PR Assignment POST: Token verified, role:', decodedToken.role);
    
    if (decodedToken.role !== 'admin') {
      console.log('PR Assignment POST: Insufficient permissions');
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 });
    }

    const body = await request.json();
    console.log('PR Assignment POST: Request body:', body);
    
    const { year, responseId, teamId } = body;
    if (!year || !responseId || !teamId) {
      console.log('PR Assignment POST: Missing required fields');
      return NextResponse.json({ error: 'year, responseId, teamId は必須です' }, { status: 400 });
    }

    console.log('PR Assignment POST: Creating assignment in Firestore');
    const y = parseInt(year);

    // 既存割り当てをチェック（year + responseId で一意）
    const existingSnap = await adminDb
      .collection('prAssignments')
      .where('year', '==', y)
      .where('responseId', '==', responseId)
      .limit(1)
      .get();

    // 決定的なドキュメントID（ユニーク制約の代替）
    const deterministicId = `${y}_${responseId}`;
    const targetRef = adminDb.collection('prAssignments').doc(deterministicId);

    const assignmentData = {
      year: y,
      responseId,
      teamId,
      assignedAt: new Date(),
      assignedBy: 'manual' as const,
    };

    console.log('PR Assignment POST: Upserting assignment with deterministic ID', deterministicId, assignmentData, 'existing:', !existingSnap.empty);
    // 先にターゲットIDにアップサート
    await targetRef.set(assignmentData, { merge: true });
    // 古いランダムIDでの既存があれば削除（移行時の二重データ防止）
    if (!existingSnap.empty && existingSnap.docs[0].id !== deterministicId) {
      await existingSnap.docs[0].ref.delete();
      console.log('PR Assignment POST: Removed legacy duplicate doc:', existingSnap.docs[0].id);
    }

    console.log('PR Assignment POST: Fetching updated assignments');
    const snap = await adminDb.collection('prAssignments').where('year', '==', parseInt(year)).get();
    const assignments = snap.docs.map(d => ({ assignmentId: d.id, ...d.data() }));
    console.log('PR Assignment POST: Found', assignments.length, 'assignments');
    
    return NextResponse.json({ success: true, assignments });
  } catch (e) {
    console.error('PR割り当て作成エラー:', e);
    return NextResponse.json({ error: 'PR割り当ての作成に失敗しました', details: String(e) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
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

    const { year, teamId, assignmentId } = await request.json();
    if (!year) return NextResponse.json({ error: '年度が必要です' }, { status: 400 });

    if (assignmentId) {
      // 個別削除
      const ref = adminDb.collection('prAssignments').doc(String(assignmentId));
      const doc = await ref.get();
      if (!doc.exists) return NextResponse.json({ error: '対象が見つかりません' }, { status: 404 });
      await ref.delete();
      return NextResponse.json({ success: true, deletedCount: 1 });
    }

    // 条件削除（年度必須、任意でteamId）
    let query = adminDb.collection('prAssignments').where('year', '==', parseInt(year));
    if (teamId) query = query.where('teamId', '==', teamId);

    const snap = await query.get();
    const batch = adminDb.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    return NextResponse.json({ success: true, deletedCount: snap.size });
  } catch (e) {
    console.error('PR割り当て削除エラー:', e);
    return NextResponse.json({ error: 'PR割り当ての削除に失敗しました' }, { status: 500 });
  }
}
