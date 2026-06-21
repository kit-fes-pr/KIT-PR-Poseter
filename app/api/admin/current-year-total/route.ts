import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import {
  buildCurrentYearTotalPayload,
  buildCurrentYearTotalStoreView,
  normalizeCurrentYearTotalAuthHeader,
  resolveCurrentYearTotalTargetEventId,
} from '@/lib/utils/current-year-total-route';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = normalizeCurrentYearTotalAuthHeader(authHeader);
    if (!token) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    if (decodedToken.role !== 'admin') {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 });
    }

    const body = await request.json();
    const resolved = resolveCurrentYearTotalTargetEventId({
      eventIdBody: body?.eventId,
      yearBody: body?.year,
    });
    let targetEventId = resolved.targetEventId;
    if (!body?.eventId && Number.isFinite(resolved.targetYear)) {
      const evSnap = await adminDb
        .collection('distributionEvents')
        .where('year', '==', resolved.targetYear)
        .limit(1)
        .get();
      if (!evSnap.empty) targetEventId = evSnap.docs[0].id;
    }

    // イベント情報取得（あれば年度を使う）
    const eventDoc = await adminDb.collection('distributionEvents').doc(targetEventId).get();
    const eventData = eventDoc.exists ? (eventDoc.data() as Record<string, unknown>) : null;
    const year =
      typeof eventData?.year === 'number'
        ? eventData.year
        : typeof eventData?.year === 'string' && eventData.year.trim()
          ? Number(eventData.year)
          : new Date().getFullYear();

    const storesSnapshot = await adminDb
      .collection('stores')
      .where('eventId', '==', targetEventId)
      .get();

    const stores = storesSnapshot.docs.map((d) => d.data()) as Record<string, unknown>[];
    const payload = buildCurrentYearTotalPayload({
      eventId: targetEventId,
      year,
      stores,
      updatedAt: new Date(),
    });

    const docRef = adminDb.collection('currentYearTotals').doc(String(year));
    await docRef.set(payload, { merge: true });

    return NextResponse.json({ success: true, data: payload });
  } catch (error) {
    console.error('Update current-year-total error:', error);
    return NextResponse.json({ error: '今年度総店舗履歴の更新に失敗しました' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = normalizeCurrentYearTotalAuthHeader(authHeader);
    if (!token) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    if (decodedToken.role !== 'admin') {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year');
    const eventId = searchParams.get('eventId') || 'kodai2025';
    const includeStores = ['1', 'true', 'yes'].includes(
      (searchParams.get('includeStores') || '').toLowerCase(),
    );

    let year = yearParam ? parseInt(yearParam) : undefined;
    if (!year) {
      const eventDoc = await adminDb.collection('distributionEvents').doc(eventId).get();
      if (eventDoc.exists) {
        const eventData = eventDoc.data() as Record<string, unknown>;
        year = eventData.year as number;
      }
    }

    let doc;
    if (year) {
      doc = await adminDb.collection('currentYearTotals').doc(String(year)).get();
    } else {
      const snap = await adminDb
        .collection('currentYearTotals')
        .orderBy('year', 'desc')
        .limit(1)
        .get();
      doc = snap.docs[0];
    }

    // ドキュメントが無い場合でも、includeStores 指定時は店舗一覧を返す
    if (!doc || !doc.exists) {
      if (includeStores) {
        let eid = eventId;
        if (year) {
          const evSnap = await adminDb
            .collection('distributionEvents')
            .where('year', '==', year)
            .limit(1)
            .get();
          if (!evSnap.empty) eid = evSnap.docs[0].id;
        }
        const storesSnapshot = await adminDb.collection('stores').where('eventId', '==', eid).get();
        const stores = storesSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

        const teamsSnapshot = await adminDb.collection('teams').where('eventId', '==', eid).get();
        const teamsByCode: Record<string, string> = {};
        const teamsByArea: Record<string, Array<{ code: string; name: string }>> = {};
        teamsSnapshot.docs.forEach((doc) => {
          const t = doc.data() as Record<string, unknown>;
          if (t.teamCode)
            teamsByCode[t.teamCode as string] = (t.teamName as string) || (t.teamCode as string);
          if (t.assignedArea) {
            if (!teamsByArea[t.assignedArea as string]) teamsByArea[t.assignedArea as string] = [];
            teamsByArea[t.assignedArea as string].push({
              code: t.teamCode as string,
              name: (t.teamName as string) || (t.teamCode as string),
            });
          }
          if (Array.isArray(t.adjacentAreas)) {
            t.adjacentAreas.forEach((area: string) => {
              if (!teamsByArea[area]) teamsByArea[area] = [];
              teamsByArea[area].push({
                code: t.teamCode as string,
                name: (t.teamName as string) || (t.teamCode as string),
              });
            });
          }
        });

        const storesWithNames = buildCurrentYearTotalStoreView({
          stores,
          teamsByCode,
          teamsByArea,
        });
        return NextResponse.json({ data: null, stores: storesWithNames, teamsByCode });
      }
      return NextResponse.json({ data: null });
    }

    const base = { id: doc.id, ...(doc.data() as Record<string, unknown>) } as Record<
      string,
      unknown
    >;

    if (includeStores) {
      const eid = base.eventId || eventId;
      const storesSnapshot = await adminDb.collection('stores').where('eventId', '==', eid).get();
      const stores = storesSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

      // チーム名の解決用に teams を取得
      const teamsSnapshot = await adminDb.collection('teams').where('eventId', '==', eid).get();
      const teamsByCode: Record<string, string> = {};
      const teamsByArea: Record<string, Array<{ code: string; name: string }>> = {};
      teamsSnapshot.docs.forEach((doc) => {
        const t = doc.data() as Record<string, unknown>;
        if (t.teamCode)
          teamsByCode[t.teamCode as string] = (t.teamName as string) || (t.teamCode as string);
        if (t.assignedArea) {
          if (!teamsByArea[t.assignedArea as string]) teamsByArea[t.assignedArea as string] = [];
          teamsByArea[t.assignedArea as string].push({
            code: t.teamCode as string,
            name: (t.teamName as string) || (t.teamCode as string),
          });
        }
        if (Array.isArray(t.adjacentAreas)) {
          t.adjacentAreas.forEach((area: string) => {
            if (!teamsByArea[area]) teamsByArea[area] = [];
            teamsByArea[area].push({
              code: t.teamCode as string,
              name: (t.teamName as string) || (t.teamCode as string),
            });
          });
        }
      });

      const storesWithNames = buildCurrentYearTotalStoreView({
        stores,
        teamsByCode,
        teamsByArea,
      });
      return NextResponse.json({ data: base, stores: storesWithNames, teamsByCode });
    }

    return NextResponse.json({ data: base });
  } catch (error) {
    console.error('Get current-year-total error:', error);
    return NextResponse.json({ error: '今年度総店舗履歴の取得に失敗しました' }, { status: 500 });
  }
}
