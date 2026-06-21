import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { serializeEventDoc } from '@/lib/utils/events/events';
import {
  normalizeDistributionEventListYear,
  shouldBlockDistributionEventDeletion,
} from '@/lib/utils/events/events-api';
import {
  buildEventsCreatePayload,
  buildEventsUpdateLookup,
  buildEventsUpdatePayload,
  normalizeEventsAuthHeader,
} from '@/lib/utils/events/events-route';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const idToken = normalizeEventsAuthHeader(authHeader);
    if (!idToken) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    if (decodedToken.role !== 'admin') {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year');

    if (yearParam) {
      const year = normalizeDistributionEventListYear(yearParam);
      if (year === null) {
        return NextResponse.json({ data: null });
      }
      const snap = await adminDb
        .collection('distributionEvents')
        .where('year', '==', year)
        .limit(1)
        .get();
      if (snap.empty) return NextResponse.json({ data: null });
      const d = snap.docs[0];
      return NextResponse.json({
        data: serializeEventDoc(d.id, d.data() as Record<string, unknown>),
      });
    }

    const snap = await adminDb.collection('distributionEvents').orderBy('year', 'desc').get();
    const events = snap.docs.map((d) =>
      serializeEventDoc(d.id, d.data() as Record<string, unknown>),
    );
    const latest = events[0] || null;
    return NextResponse.json({ events, latest });
  } catch (error) {
    console.error('Get events error:', error);
    return NextResponse.json({ error: 'イベント一覧の取得に失敗しました' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const idToken = normalizeEventsAuthHeader(authHeader);
    if (!idToken) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    if (decodedToken.role !== 'admin') {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 });
    }

    const {
      year,
      eventName,
      distributionStartDate,
      distributionEndDate,
      distributionTimeZone,
      distributionAvailabilitySlots,
      eventId,
    } = await request.json();

    if (!year || !distributionStartDate) {
      return NextResponse.json(
        { error: '年度と配布日（開始日）を入力してください' },
        { status: 400 },
      );
    }

    const createPayload = buildEventsCreatePayload({
      year,
      eventName,
      distributionStartDate,
      distributionEndDate,
      distributionTimeZone,
      distributionAvailabilitySlots,
      eventId,
    });
    if ('error' in createPayload) {
      return NextResponse.json({ error: createPayload.error }, { status: 400 });
    }

    // 年度の重複チェック
    const existSnap = await adminDb
      .collection('distributionEvents')
      .where('year', '==', createPayload.year)
      .limit(1)
      .get();
    if (!existSnap.empty) {
      return NextResponse.json({ error: 'この年度のイベントは既に存在します' }, { status: 409 });
    }

    const docRef = adminDb.collection('distributionEvents').doc(createPayload.defaults.eventId);

    const payload = {
      eventId: createPayload.defaults.eventId,
      eventName: createPayload.defaults.eventName,
      distributionStartDate: createPayload.defaults.distributionStartDate,
      distributionEndDate: createPayload.defaults.distributionEndDate,
      distributionAvailabilitySlots: createPayload.defaults.distributionAvailabilitySlots,
      distributionTimeZone: createPayload.defaults.distributionTimeZone,
      year: createPayload.year,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await docRef.set(payload, { merge: false });
    return NextResponse.json({
      success: true,
      data: {
        id: createPayload.defaults.eventId,
        ...payload,
        createdAt: payload.createdAt.toISOString(),
        updatedAt: payload.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Create event error:', error);
    return NextResponse.json({ error: 'イベントの作成に失敗しました' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const idToken = normalizeEventsAuthHeader(authHeader);
    if (!idToken) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    if (decodedToken.role !== 'admin') {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 });
    }

    const {
      id,
      year,
      eventName,
      distributionStartDate,
      distributionEndDate,
      distributionTimeZone,
      distributionAvailabilitySlots,
      isActive,
    } = await request.json();

    const lookup = buildEventsUpdateLookup({ id, year });
    if (lookup.type === 'error') {
      return NextResponse.json({ error: lookup.error }, { status: 400 });
    }

    let docRef;
    if (lookup.type === 'id') {
      docRef = adminDb.collection('distributionEvents').doc(lookup.id);
    } else {
      const snap = await adminDb
        .collection('distributionEvents')
        .where('year', '==', lookup.year)
        .limit(1)
        .get();
      if (snap.empty)
        return NextResponse.json({ error: '対象の年度が見つかりません' }, { status: 404 });
      docRef = snap.docs[0].ref;
    }

    const updateDefaults = buildEventsUpdatePayload({
      eventName,
      distributionStartDate,
      distributionEndDate,
      distributionTimeZone,
      distributionAvailabilitySlots,
      isActive,
    });
    if (updateDefaults.error) {
      return NextResponse.json({ error: updateDefaults.error }, { status: 400 });
    }

    const update = updateDefaults.update;
    await docRef.update(update);
    const doc = await docRef.get();
    return NextResponse.json({
      success: true,
      data: serializeEventDoc(doc.id, doc.data() as Record<string, unknown>),
    });
  } catch (error) {
    console.error('Update event error:', error);
    return NextResponse.json({ error: 'イベントの更新に失敗しました' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const idToken = normalizeEventsAuthHeader(authHeader);
    if (!idToken) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    if (decodedToken.role !== 'admin') {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 });
    }

    const { id, year } = await request.json();
    const lookup = buildEventsUpdateLookup({ id, year });
    if (lookup.type === 'error') {
      return NextResponse.json({ error: lookup.error }, { status: 400 });
    }

    let docRef;
    if (lookup.type === 'id') {
      docRef = adminDb.collection('distributionEvents').doc(lookup.id);
    } else {
      const snap = await adminDb
        .collection('distributionEvents')
        .where('year', '==', lookup.year)
        .limit(1)
        .get();
      if (snap.empty)
        return NextResponse.json({ error: '対象の年度が見つかりません' }, { status: 404 });
      docRef = snap.docs[0].ref;
    }

    const doc = await docRef.get();
    if (!doc.exists)
      return NextResponse.json({ error: 'イベントが見つかりません' }, { status: 404 });
    const eid = doc.id;

    // 依存データがある場合は削除不可
    const storesSnap = await adminDb
      .collection('stores')
      .where('eventId', '==', eid)
      .limit(1)
      .get();
    const teamsSnap = await adminDb.collection('teams').where('eventId', '==', eid).limit(1).get();
    if (
      shouldBlockDistributionEventDeletion({
        storesExist: !storesSnap.empty,
        teamsExist: !teamsSnap.empty,
      })
    ) {
      return NextResponse.json(
        { error: '関連データ（stores/teams）が存在するため削除できません' },
        { status: 409 },
      );
    }

    await docRef.delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete event error:', error);
    return NextResponse.json({ error: 'イベントの削除に失敗しました' }, { status: 500 });
  }
}
