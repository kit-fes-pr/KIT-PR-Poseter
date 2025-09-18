import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { Team } from '@/types';

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

    const {
      teamCode,
      teamName,
      timeSlot,
      assignedArea,
      adjacentAreas,
      eventId,
      validDate
    } = await request.json();

    if (!teamCode || !teamName || !assignedArea || !eventId) {
      return NextResponse.json(
        { error: '必須フィールドが不足しています' },
        { status: 400 }
      );
    }

    // Check if team code already exists
    const existingTeam = await adminDb.collection('teams')
      .where('teamCode', '==', teamCode)
      .where('eventId', '==', eventId)
      .limit(1)
      .get();

    if (!existingTeam.empty) {
      return NextResponse.json(
        { error: 'このチームコードは既に使用されています' },
        { status: 400 }
      );
    }

    const teamRef = adminDb.collection('teams').doc();
    const teamData: Omit<Team, 'teamId'> = {
      teamCode,
      teamName,
      timeSlot,
      assignedArea,
      adjacentAreas: adjacentAreas || [],
      eventId,
      isActive: true,
      validDate: new Date(validDate),
      createdAt: new Date()
    };

    await teamRef.set({
      teamId: teamRef.id,
      ...teamData
    });

    return NextResponse.json({
      success: true,
      team: {
        id: teamRef.id,
        teamId: teamRef.id,
        ...teamData
      }
    });

  } catch (error) {
    console.error('Create team error:', error);
    return NextResponse.json(
      { error: 'チームの作成に失敗しました' },
      { status: 500 }
    );
  }
}

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

    const teamsSnapshot = await adminDb.collection('teams')
      .where('eventId', '==', 'kohdai2025')
      .where('isActive', '==', true)
      .get();

    const teams = teamsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json({ teams });

  } catch (error) {
    console.error('Get teams error:', error);
    return NextResponse.json(
      { error: 'チーム情報の取得に失敗しました' },
      { status: 500 }
    );
  }
}