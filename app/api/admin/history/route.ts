import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { DistributionHistory } from '@/types';
import { Query, DocumentData } from 'firebase-admin/firestore';

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
    const year = searchParams.get('year');
    const eventId = searchParams.get('eventId');
    const teamCode = searchParams.get('teamCode');
    const areaCode = searchParams.get('areaCode');
    const timeSlot = searchParams.get('timeSlot');

    let query: Query<DocumentData> = adminDb.collection('distributionHistory');

    // フィルター適用
    if (year) {
      query = query.where('year', '==', parseInt(year));
    }
    if (eventId) {
      query = query.where('eventId', '==', eventId);
    }

    // 結果を取得し、年度の降順でソート
    const snapshot = await query.orderBy('year', 'desc').get();

    let histories = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as unknown as DistributionHistory[];

    // クライアントサイドフィルター（Firestoreの制限回避）
    if (teamCode || areaCode || timeSlot) {
      histories = histories.filter(history => {
        if (teamCode && !history.teams.some(team => team.teamCode === teamCode)) {
          return false;
        }
        if (areaCode && !history.areas.some(area => area.areaCode === areaCode)) {
          return false;
        }
        if (timeSlot && !history.teams.some(team => team.timeSlot === timeSlot)) {
          return false;
        }
        return true;
      });
    }

    return NextResponse.json({ histories });

  } catch (error) {
    console.error('Get distribution history error:', error);
    return NextResponse.json(
      { error: '配布履歴の取得に失敗しました' },
      { status: 500 }
    );
  }
}

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

    const { eventId } = await request.json();

    if (!eventId) {
      return NextResponse.json(
        { error: 'イベントIDが必要です' },
        { status: 400 }
      );
    }

    // イベント情報を取得
    const eventDoc = await adminDb.collection('distributionEvents').doc(eventId).get();
    if (!eventDoc.exists) {
      return NextResponse.json(
        { error: 'イベントが見つかりません' },
        { status: 404 }
      );
    }

    const eventData = eventDoc.data();

    // 現在のデータを集計してアーカイブ
    const historyData = await generateDistributionHistory(eventId, eventData as Record<string, unknown>);

    const historyRef = adminDb.collection('distributionHistory').doc();
    await historyRef.set({
      historyId: historyRef.id,
      ...historyData,
      archivedAt: new Date()
    });

    return NextResponse.json({
      success: true,
      historyId: historyRef.id,
      message: '配布履歴がアーカイブされました'
    });

  } catch (error) {
    console.error('Archive distribution history error:', error);
    return NextResponse.json(
      { error: '配布履歴のアーカイブに失敗しました' },
      { status: 500 }
    );
  }
}

async function generateDistributionHistory(eventId: string, eventData: Record<string, unknown>) {
  // チーム情報を取得
  const teamsSnapshot = await adminDb.collection('teams')
    .where('eventId', '==', eventId)
    .get();

  // 店舗情報を取得
  const storesSnapshot = await adminDb.collection('stores')
    .where('eventId', '==', eventId)
    .get();

  // メンバー情報を取得
  const membersSnapshot = await adminDb.collection('members')
    .get();

  const teams = teamsSnapshot.docs.map(doc => doc.data());
  const stores = storesSnapshot.docs.map(doc => doc.data());
  const members = membersSnapshot.docs.map(doc => doc.data());

  // 統計を計算
  const totalStores = stores.length;
  const completedStores = stores.filter(store => store.distributionStatus === 'completed').length;
  const failedStores = stores.filter(store => store.distributionStatus === 'failed').length;
  const completionRate = totalStores > 0 ? (completedStores / totalStores) * 100 : 0;

  // チーム履歴を生成
  const teamHistories = teams.map(team => {
    const teamStores = stores.filter(store => store.distributedBy === team.teamCode);
    const teamCompleted = teamStores.filter(store => store.distributionStatus === 'completed').length;
    const teamTotal = teamStores.length;
    const teamRate = teamTotal > 0 ? (teamCompleted / teamTotal) * 100 : 0;

    const teamMembers = members.filter(member => member.teamId === team.teamId);

    return {
      teamId: team.teamId,
      teamCode: team.teamCode,
      teamName: team.teamName,
      timeSlot: team.timeSlot,
      assignedArea: team.assignedArea,
      adjacentAreas: team.adjacentAreas,
      members: teamMembers.map((member: Record<string, unknown>) => ({
        memberId: member.memberId,
        name: member.name,
        section: member.section,
        grade: member.grade,
        joinedAt: member.createdAt
      })),
      totalStores: teamTotal,
      completedStores: teamCompleted,
      completionRate: teamRate,
      distributedStores: teamStores.map((store: Record<string, unknown>) => ({
        storeId: store.storeId,
        storeName: store.storeName,
        address: store.address,
        areaCode: store.areaCode,
        distributionStatus: store.distributionStatus,
        failureReason: store.failureReason,
        distributedCount: store.distributedCount,
        distributedBy: store.distributedBy,
        distributedAt: store.distributedAt,
        teamMembers: teamMembers.map((m: Record<string, unknown>) => m.name)
      }))
    };
  });

  // 区域履歴を生成
  const areaHistories = [...new Set(stores.map((store: Record<string, unknown>) => store.areaCode))].map(areaCode => {
    const areaStores = stores.filter((store: Record<string, unknown>) => store.areaCode === areaCode);
    const areaCompleted = areaStores.filter((store: Record<string, unknown>) => store.distributionStatus === 'completed').length;
    const areaTotal = areaStores.length;
    const areaRate = areaTotal > 0 ? (areaCompleted / areaTotal) * 100 : 0;

    const assignedTeams = teams
      .filter((team: Record<string, unknown>) => team.assignedArea === areaCode || (team.adjacentAreas as unknown[]).includes(areaCode))
      .map((team: Record<string, unknown>) => team.teamCode);

    return {
      areaId: `area-${areaCode}`,
      areaCode,
      areaName: `${areaCode}区域`,
      timeSlot: String(areaCode).includes('午前') ? 'morning' : 'afternoon',
      totalStores: areaTotal,
      completedStores: areaCompleted,
      completionRate: areaRate,
      assignedTeams
    };
  });

  return {
    eventId,
    year: eventData.year,
    eventName: eventData.eventName,
    distributionDate: eventData.distributionDate,
    totalStores,
    completedStores,
    failedStores,
    completionRate,
    teams: teamHistories,
    areas: areaHistories,
    createdAt: new Date()
  };
}