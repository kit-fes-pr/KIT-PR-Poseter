import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const eventIdBody = body?.eventId as string | undefined;
    const yearBody = body?.year as number | undefined;
    let targetEventId = eventIdBody || 'kohdai2025';
    if (!eventIdBody && yearBody) {
      const evSnap = await adminDb.collection('distributionEvents').where('year', '==', yearBody).limit(1).get();
      if (!evSnap.empty) targetEventId = evSnap.docs[0].id;
    }

    // イベント情報取得（あれば年度を使う）
    const eventDoc = await adminDb.collection('distributionEvents').doc(targetEventId).get();
    const eventData = eventDoc.exists ? eventDoc.data() as any : null;
    const year = eventData?.year || new Date().getFullYear();

    const storesSnapshot = await adminDb
      .collection('stores')
      .where('eventId', '==', targetEventId)
      .get();

    const stores = storesSnapshot.docs.map(d => d.data()) as any[];
    const totalStores = stores.length;
    const completedStores = stores.filter(s => s.distributionStatus === 'completed').length;
    const failedStores = stores.filter(s => s.distributionStatus === 'failed').length;
    const revisitStores = stores.filter(s => s.distributionStatus === 'revisit').length;
    const pendingStores = stores.filter(s => s.distributionStatus === 'pending').length;
    const totalDistributedCount = stores.reduce((sum, s) => sum + (s.distributedCount || 0), 0);

    const payload = {
      eventId: targetEventId,
      year,
      totalStores,
      completedStores,
      failedStores,
      revisitStores,
      pendingStores,
      totalDistributedCount,
      updatedAt: new Date(),
    };

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
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    if (decodedToken.role !== 'admin') {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year');
    const eventId = searchParams.get('eventId') || 'kohdai2025';
    const includeStores = ['1', 'true', 'yes'].includes((searchParams.get('includeStores') || '').toLowerCase());

    let year = yearParam ? parseInt(yearParam) : undefined;
    if (!year) {
      const eventDoc = await adminDb.collection('distributionEvents').doc(eventId).get();
      if (eventDoc.exists) {
        const eventData = eventDoc.data() as any;
        year = eventData.year;
      }
    }

    let doc;
    if (year) {
      doc = await adminDb.collection('currentYearTotals').doc(String(year)).get();
    } else {
      const snap = await adminDb.collection('currentYearTotals').orderBy('year', 'desc').limit(1).get();
      doc = snap.docs[0];
    }

    // ドキュメントが無い場合でも、includeStores 指定時は店舗一覧を返す
    if (!doc || !doc.exists) {
      if (includeStores) {
        let eid = eventId;
        if (year) {
          const evSnap = await adminDb.collection('distributionEvents').where('year', '==', year).limit(1).get();
          if (!evSnap.empty) eid = evSnap.docs[0].id;
        }
        const storesSnapshot = await adminDb
          .collection('stores')
          .where('eventId', '==', eid)
          .get();
        const stores = storesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        const teamsSnapshot = await adminDb
          .collection('teams')
          .where('eventId', '==', eid)
          .get();
        const teamsByCode: Record<string, string> = {};
        const teamsByArea: Record<string, Array<{ code: string; name: string }>> = {};
        teamsSnapshot.docs.forEach(doc => {
          const t = doc.data() as any;
          if (t.teamCode) teamsByCode[t.teamCode] = t.teamName || t.teamCode;
          if (t.assignedArea) {
            if (!teamsByArea[t.assignedArea]) teamsByArea[t.assignedArea] = [];
            teamsByArea[t.assignedArea].push({ code: t.teamCode, name: t.teamName || t.teamCode });
          }
          if (Array.isArray(t.adjacentAreas)) {
            t.adjacentAreas.forEach((area: string) => {
              if (!teamsByArea[area]) teamsByArea[area] = [];
              teamsByArea[area].push({ code: t.teamCode, name: t.teamName || t.teamCode });
            });
          }
        });

        const storesWithNames = stores.map((s: any) => {
          const distributedByName = s.distributedBy ? (teamsByCode[s.distributedBy] || null) : null;
          const assignedTeams = s.areaCode && teamsByArea[s.areaCode]
            ? teamsByArea[s.areaCode].map(t => `${t.name}（${t.code}）`)
            : [];
          return {
            ...s,
            distributedByName,
            assignedTeams,
          };
        });
        return NextResponse.json({ data: null, stores: storesWithNames, teamsByCode });
      }
      return NextResponse.json({ data: null });
    }

    const base = { id: doc.id, ...(doc.data() as any) } as any;

    if (includeStores) {
      const eid = base.eventId || eventId;
      const storesSnapshot = await adminDb
        .collection('stores')
        .where('eventId', '==', eid)
        .get();
      const stores = storesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

      // チーム名の解決用に teams を取得
      const teamsSnapshot = await adminDb
        .collection('teams')
        .where('eventId', '==', eid)
        .get();
      const teamsByCode: Record<string, string> = {};
      const teamsByArea: Record<string, Array<{ code: string; name: string }>> = {};
      teamsSnapshot.docs.forEach(doc => {
        const t = doc.data() as any;
        if (t.teamCode) teamsByCode[t.teamCode] = t.teamName || t.teamCode;
        if (t.assignedArea) {
          if (!teamsByArea[t.assignedArea]) teamsByArea[t.assignedArea] = [];
          teamsByArea[t.assignedArea].push({ code: t.teamCode, name: t.teamName || t.teamCode });
        }
        if (Array.isArray(t.adjacentAreas)) {
          t.adjacentAreas.forEach((area: string) => {
            if (!teamsByArea[area]) teamsByArea[area] = [];
            teamsByArea[area].push({ code: t.teamCode, name: t.teamName || t.teamCode });
          });
        }
      });

      const storesWithNames = stores.map((s: any) => {
        const distributedByName = s.distributedBy ? (teamsByCode[s.distributedBy] || null) : null;
        const assignedTeams = s.areaCode && teamsByArea[s.areaCode]
          ? teamsByArea[s.areaCode].map(t => `${t.name}（${t.code}）`)
          : [];
        return {
          ...s,
          distributedByName,
          assignedTeams,
        };
      });
      return NextResponse.json({ data: base, stores: storesWithNames, teamsByCode });
    }

    return NextResponse.json({ data: base });
  } catch (error) {
    console.error('Get current-year-total error:', error);
    return NextResponse.json({ error: '今年度総店舗履歴の取得に失敗しました' }, { status: 500 });
  }
}
