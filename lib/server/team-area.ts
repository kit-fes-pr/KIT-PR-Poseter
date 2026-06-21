import { adminDb } from '@/lib/firebase-admin';

export interface ResolvedAreaRef {
  areaId: string;
  areaCode: string;
  areaName: string;
}

export async function resolveAreaRef(params: {
  eventId?: string;
  areaId?: string;
  assignedArea?: string;
}): Promise<ResolvedAreaRef | null> {
  const { areaId, assignedArea } = params;

  if (areaId) {
    const areaDoc = await adminDb.collection('areas').doc(areaId).get();
    if (!areaDoc.exists) return null;
    const data = areaDoc.data() as Record<string, unknown>;
    return {
      areaId: areaDoc.id,
      areaCode: String(data.areaCode || ''),
      areaName: String(data.areaName || ''),
    };
  }

  if (assignedArea) {
    const snap = await adminDb
      .collection('areas')
      .where('areaCode', '==', assignedArea)
      .limit(1)
      .get();

    if (snap.empty) return null;

    const areaDoc = snap.docs[0];
    const data = areaDoc.data() as Record<string, unknown>;
    return {
      areaId: areaDoc.id,
      areaCode: String(data.areaCode || assignedArea),
      areaName: String(data.areaName || ''),
    };
  }

  return null;
}

export async function loadAreaMap() {
  const snap = await adminDb.collection('areas').get();
  const byCode = new Map<string, ResolvedAreaRef>();
  const byId = new Map<string, ResolvedAreaRef>();

  snap.docs.forEach((doc) => {
    const data = doc.data() as Record<string, unknown>;
    const area = {
      areaId: doc.id,
      areaCode: String(data.areaCode || ''),
      areaName: String(data.areaName || ''),
    };
    if (area.areaCode) byCode.set(area.areaCode, area);
    byId.set(area.areaId, area);
  });

  return {
    areas: snap.docs.map((doc) => ({ areaId: doc.id, ...(doc.data() as Record<string, unknown>) })),
    byCode,
    byId,
  };
}
