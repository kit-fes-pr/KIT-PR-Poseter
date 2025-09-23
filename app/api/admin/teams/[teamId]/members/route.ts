/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

type MemberItem = {
  responseId: string;
  name: string;
  grade: number;
  section: string;
  timeSlot: 'morning' | 'afternoon' | 'pr';
  formId: string;
};

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

    const { searchParams } = new URL(request.url);
    const yearStr = searchParams.get('year');
    if (!yearStr) {
      return NextResponse.json({ error: 'year が必要です' }, { status: 400 });
    }
    const year = parseInt(yearStr, 10);
    if (Number.isNaN(year)) {
      return NextResponse.json({ error: 'year の形式が不正です' }, { status: 400 });
    }

    const { teamId } = await params;

    // 1) 通常の割り当て（assignments）
    const assignmentsSnap = await adminDb
      .collection('assignments')
      .where('year', '==', year)
      .where('teamId', '==', teamId)
      .get();

    const normalAssignments = assignmentsSnap.docs.map(d => ({ assignmentId: d.id, ...d.data() })) as Array<{
      responseId: string;
      formId: string;
      timeSlot: 'morning' | 'afternoon';
    }>;

    // 2) PR割り当て（prAssignments）
    const prSnap = await adminDb
      .collection('prAssignments')
      .where('year', '==', year)
      .where('teamId', '==', teamId)
      .get();
    const prAssignments = prSnap.docs.map(d => ({ assignmentId: d.id, ...d.data() })) as Array<{
      responseId: string;
    }>;

    // 3) 回答ドキュメントをまとめて取得
    // 3-1) 通常割り当ては formId があるのでダイレクト参照で取得
    const byForm: Record<string, Set<string>> = {};
    for (const a of normalAssignments) {
      if (!a.formId || !a.responseId) continue;
      byForm[a.formId] = byForm[a.formId] || new Set<string>();
      byForm[a.formId].add(a.responseId);
    }

    const responseMap: Record<string, { formId: string; data: any } | undefined> = {};

    const getAllChunked = async (refs: FirebaseFirestore.DocumentReference[]) => {
      const out: FirebaseFirestore.DocumentSnapshot[] = [];
      const size = 300; // safety chunk size
      for (let i = 0; i < refs.length; i += size) {
        const chunk = refs.slice(i, i + size);
        const snaps = await adminDb.getAll(...chunk);
        out.push(...snaps);
      }
      return out;
    };

    // Fetch normal assignment responses
    for (const [formId, idSet] of Object.entries(byForm)) {
      const refs = Array.from(idSet).map((rid) =>
        adminDb.collection('forms').doc(formId).collection('responses').doc(rid)
      );
      const snaps = await getAllChunked(refs);
      for (const s of snaps) {
        if (s.exists) {
          responseMap[s.id] = { formId, data: s.data() };
        }
      }
    }

    // 3-2) PR割り当ては formId が不明の可能性があるため、イベント内の全フォームを対象に探索
    // イベントIDは既存仕様に合わせて kohdai{year}
    const eventId = `kohdai${year}`;
    if (prAssignments.length > 0) {
      const prIds = Array.from(new Set(prAssignments.map(a => a.responseId).filter(Boolean)));
      if (prIds.length > 0) {
        const formsSnap = await adminDb.collection('forms').where('eventId', '==', eventId).get();
        const formIds = formsSnap.docs.map(d => d.id);
        // 各フォームに対して、該当 responseId のドキュメントを直接参照で試行
        for (const formId of formIds) {
          // 未解決のIDだけを試す
          const unresolved = prIds.filter(rid => !responseMap[rid]);
          if (unresolved.length === 0) break;
          const refs = unresolved.map((rid) => adminDb.collection('forms').doc(formId).collection('responses').doc(rid));
          const snaps = await getAllChunked(refs);
          for (const s of snaps) {
            if (s.exists) {
              responseMap[s.id] = { formId, data: s.data() };
            }
          }
        }
      }
    }

    // 4) メンバー配列を構築
    const members: MemberItem[] = [];
    const pushMember = (a: { responseId: string; formId?: string; timeSlot?: string }, isPR = false) => {
      const rec = responseMap[a.responseId];
      if (!rec) return;
      const pd = rec.data?.participantData || {};
      members.push({
        responseId: a.responseId,
        name: pd.name || '-',
        grade: typeof pd.grade === 'number' ? pd.grade : parseInt(pd.grade) || 0,
        section: pd.section || '-',
        timeSlot: (isPR ? 'pr' : (a.timeSlot as 'morning' | 'afternoon')) || 'pr',
        formId: rec.formId || a.formId || 'unknown',
      });
    };

    normalAssignments.forEach(a => pushMember(a, false));
    prAssignments.forEach(a => pushMember(a, true));

    return NextResponse.json({ members });
  } catch (error) {
    console.error('チームメンバー取得エラー:', error);
    return NextResponse.json({ error: 'チームメンバーの取得に失敗しました' }, { status: 500 });
  }
}

