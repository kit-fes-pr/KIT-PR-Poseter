/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { normalizeAvailableTime } from '@/lib/utils/availability';

type Member = {
  memberId: string; // responseId を流用
  name: string;
  section: string;
  grade: number;
  availableTime: 'morning' | 'afternoon' | 'both' | 'pr' | 'other';
  source: 'form';
  teamId?: string;
  createdAt: Date;
};

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
    const yearStr = searchParams.get('year');
    if (!yearStr) return NextResponse.json({ error: 'year が必要です' }, { status: 400 });
    const year = parseInt(yearStr, 10);
    if (Number.isNaN(year)) return NextResponse.json({ error: 'year の形式が不正です' }, { status: 400 });

    // 通常割り当てを取得（responseId, formId, teamId, timeSlot）
    const assignmentsSnap = await adminDb
      .collection('assignments')
      .where('year', '==', year)
      .get();
    const assignments = assignmentsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Array<{
      responseId: string;
      formId: string;
      teamId: string;
      timeSlot: 'morning' | 'afternoon';
    }>;

    // PR割り当て（teamIdのみ、formIdは不明）
    const prSnap = await adminDb
      .collection('prAssignments')
      .where('year', '==', year)
      .get();
    const prAssignments = prSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Array<{
      responseId: string;
      teamId: string;
    }>;

    // formIdごとに responseId をまとめて responses をバルク取得
    const byForm: Record<string, Set<string>> = {};
    for (const a of assignments) {
      if (a.formId && a.responseId) {
        byForm[a.formId] = byForm[a.formId] || new Set<string>();
        byForm[a.formId].add(a.responseId);
      }
    }

    const responseMap: Record<string, { formId: string; data: any } | undefined> = {};

    const getAllChunked = async (refs: FirebaseFirestore.DocumentReference[]) => {
      const out: FirebaseFirestore.DocumentSnapshot[] = [];
      const size = 300;
      for (let i = 0; i < refs.length; i += size) {
        const chunk = refs.slice(i, i + size);
        const snaps = await adminDb.getAll(...chunk);
        out.push(...snaps);
      }
      return out;
    };

    for (const [formId, idSet] of Object.entries(byForm)) {
      const refs = Array.from(idSet).map((rid) => adminDb
        .collection('forms').doc(formId).collection('responses').doc(rid)
      );
      const snaps = await getAllChunked(refs);
      for (const s of snaps) if (s.exists) responseMap[s.id] = { formId, data: s.data() };
    }

    // PR側の responseId を解決（eventId のフォームを横断し、未解決のIDだけを直接参照）
    const unresolved = Array.from(new Set(prAssignments.map(a => a.responseId).filter(rid => !responseMap[rid])));
    if (unresolved.length > 0) {
      const eventId = `kohdai${year}`;
      const formsSnap = await adminDb.collection('forms').where('eventId', '==', eventId).get();
      const formIds = formsSnap.docs.map(d => d.id);
      for (const formId of formIds) {
        const still = unresolved.filter(rid => !responseMap[rid]);
        if (still.length === 0) break;
        const refs = still.map((rid) => adminDb.collection('forms').doc(formId).collection('responses').doc(rid));
        const snaps = await getAllChunked(refs);
        for (const s of snaps) if (s.exists) responseMap[s.id] = { formId, data: s.data() };
      }
    }

    // レコード生成（responseIdベースで重複排除）
    const memberMap = new Map<string, Member>();

    // 通常割り当て
    for (const a of assignments) {
      const rec = responseMap[a.responseId];
      if (!rec) continue;
      const pd = rec.data?.participantData || {};
      const submittedAt = rec.data?.submittedAt?.toDate ? rec.data.submittedAt.toDate() : (rec.data?.submittedAt ? new Date(rec.data.submittedAt) : new Date());
      memberMap.set(a.responseId, {
        memberId: a.responseId,
        name: pd.name || '-',
        section: pd.section || '-',
        grade: typeof pd.grade === 'number' ? pd.grade : parseInt(pd.grade) || 0,
        availableTime: normalizeAvailableTime(pd.availableTime, undefined),
        source: 'form',
        teamId: a.teamId,
        createdAt: submittedAt,
      });
    }

    // PR割り当て（未登録の responseId のみ追加）
    for (const a of prAssignments) {
      if (memberMap.has(a.responseId)) continue;
      const rec = responseMap[a.responseId];
      if (!rec) continue;
      const pd = rec.data?.participantData || {};
      const submittedAt = rec.data?.submittedAt?.toDate ? rec.data.submittedAt.toDate() : (rec.data?.submittedAt ? new Date(rec.data.submittedAt) : new Date());
      memberMap.set(a.responseId, {
        memberId: a.responseId,
        name: pd.name || '-',
        section: pd.section || '-',
        grade: typeof pd.grade === 'number' ? pd.grade : parseInt(pd.grade) || 0,
        // PRは時間帯がないため 'pr' を既定に（pd.availableTime があれば正規化）
        availableTime: normalizeAvailableTime(pd.availableTime, undefined, 'pr'),
        source: 'form',
        teamId: a.teamId,
        createdAt: submittedAt,
      });
    }

    const members = Array.from(memberMap.values());
    return NextResponse.json({ members });
  } catch (error) {
    console.error('メンバー一覧取得エラー:', error);
    return NextResponse.json({ error: 'メンバー一覧の取得に失敗しました' }, { status: 500 });
  }
}
