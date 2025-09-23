import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

interface Participant {
  responseId: string;
  name: string;
  grade: number;
  section: string;
  availability: string;
}

interface Team {
  teamId: string;
  teamCode: string;
  teamName: string;
  timeSlot: 'morning' | 'afternoon' | 'both' | 'all' | 'pr' | 'other';
  assignedArea: string;
  adjacentAreas?: string[];
  maxMembers?: number;
  preferredGrades?: number[];
}

interface Assignment {
  responseId: string;
  teamId: string;
  assignedAt: Date;
  assignedBy: 'auto' | 'manual';
  timeSlot: 'morning' | 'afternoon';
}

interface PRAssignmentChoice {
  responseId: string;
  name: string;
  section: string;
  availability: string;
  choice?: 'morning' | 'afternoon' | 'none';
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

    const { year, formId, participants, teams, prChoices, includeOther } = await request.json();

    if (!year || !formId || !participants || !teams) {
      return NextResponse.json(
        { error: '必要なデータが不足しています' },
        { status: 400 }
      );
    }

    // PR割り当ては本アルゴリズムの対象外（UIの選択も無視）

    // 自動割り当てアルゴリズムを実行
    const assignments = performAutoAssignment(participants, teams, prChoices || [], Boolean(includeOther));

    // 割り当て結果をFirestoreに保存
    const batch = adminDb.batch();
    const assignmentCollection = adminDb.collection('assignments');

    assignments.forEach(assignment => {
      const docRef = assignmentCollection.doc();
      batch.set(docRef, {
        ...assignment,
        year: parseInt(year),
        formId,
      });
    });

    await batch.commit();

    return NextResponse.json({
      message: '自動割り当てが完了しました',
      assignments,
      stats: {
        total: participants.length,
        assigned: assignments.length,
        unassigned: participants.length - assignments.length,
      }
    });
  } catch (error) {
    console.error('自動割り当てエラー:', error);
    return NextResponse.json(
      { error: '自動割り当てに失敗しました' },
      { status: 500 }
    );
  }
}

function performAutoAssignment(
  participants: Participant[], 
  teams: Team[], 
  prChoices: PRAssignmentChoice[],
  includeOther: boolean
): Assignment[] {
  const assignments: Assignment[] = [];
  const usedParticipants = new Set<string>();
  
  // チーム分け（pr/other は除外）
  const morningTeams = teams.filter(t => t.timeSlot === 'morning');
  const afternoonTeams = teams.filter(t => t.timeSlot === 'afternoon');
  const allDayTeams = teams.filter(t => t.timeSlot === 'both' || t.timeSlot === 'all');
  const otherTeams = includeOther ? teams.filter(t => t.timeSlot === 'other') : [];

  // チーム毎の現在の割り当て数を追跡
  const teamAssignmentCount: Record<string, number> = {};
  teams.forEach(team => {
    teamAssignmentCount[team.teamId] = 0;
  });

  // チーム毎の上級生（3年生以上）の割り当て状況を追跡
  const teamSeniorCount: Record<string, number> = {};
  teams.forEach(team => {
    teamSeniorCount[team.teamId] = 0;
  });

  // セクション毎の午前・午後割り当て数を追跡（重複防止）
  const sectionTimeSlots: Record<string, { morning: number; afternoon: number }> = {};

  // チームごとのセクション・学年カウント
  const teamSectionCount: Record<string, Record<string, number>> = {};
  const teamGradeCount: Record<string, Record<number, number>> = {};
  teams.forEach(team => {
    teamSectionCount[team.teamId] = {};
    teamGradeCount[team.teamId] = {} as Record<number, number>;
  });

  // 参加者を処理順序でソート（3年生以上を優先）
  const sortedParticipants = [...participants].sort((a, b) => {
    const aIsSenior = a.grade >= 3;
    const bIsSenior = b.grade >= 3;
    
    // 上級生を優先
    if (aIsSenior && !bIsSenior) return -1;
    if (!aIsSenior && bIsSenior) return 1;
    
    // 制約の多い参加者を先に処理（午前のみ、午後のみ）
    if (a.availability !== 'both' && b.availability === 'both') return -1;
    if (a.availability === 'both' && b.availability !== 'both') return 1;
    
    return 0;
  });

  for (const participant of sortedParticipants) {
    if (usedParticipants.has(participant.responseId)) continue;

  const targetTimeSlot: 'morning' | 'afternoon' | 'both' = participant.availability as 'morning' | 'afternoon' | 'both';

    // PRは別アルゴリズムで扱うため、特別扱いなし

    // セクション情報を初期化
    if (!sectionTimeSlots[participant.section]) {
      sectionTimeSlots[participant.section] = { morning: 0, afternoon: 0 };
    }

    // 割り当て可能なチームを決定
    let candidateTeams: Team[] = [];
    let assignmentTimeSlot: 'morning' | 'afternoon';

    if (targetTimeSlot === 'morning' || targetTimeSlot === 'afternoon') {
      assignmentTimeSlot = targetTimeSlot;
      candidateTeams = targetTimeSlot === 'morning' 
        ? [...morningTeams, ...allDayTeams, ...otherTeams]
        : [...afternoonTeams, ...allDayTeams, ...otherTeams];
    } else if (targetTimeSlot === 'both') {
      // 両方参加可能な場合は一度だけ割り当て
      // セクションの重複を避けるため、より少ない時間帯を選択
      const sectionCount = sectionTimeSlots[participant.section];
      
      if (sectionCount.morning <= sectionCount.afternoon) {
        assignmentTimeSlot = 'morning';
        candidateTeams = [...morningTeams, ...allDayTeams, ...otherTeams];
      } else {
        assignmentTimeSlot = 'afternoon';
        candidateTeams = [...afternoonTeams, ...allDayTeams, ...otherTeams];
      }
    } else {
      continue; // 無効な可用性
    }
    // 候補がゼロの場合は割り当てなし（PR専用や不一致など）
    if (candidateTeams.length === 0) continue;
    // PR関連の制約は適用しない

    // 学年や定員を考慮してチームを選択
  const bestTeam = selectBalancedBestTeam(
      candidateTeams,
      participant,
      teamAssignmentCount,
      teamSeniorCount,
      teamSectionCount,
      teamGradeCount
    );

    if (bestTeam) {
      const assignment: Assignment = {
        responseId: participant.responseId,
        teamId: bestTeam.teamId,
        assignedAt: new Date(),
        assignedBy: 'auto',
        timeSlot: assignmentTimeSlot,
      };

      assignments.push(assignment);
      usedParticipants.add(participant.responseId);
      teamAssignmentCount[bestTeam.teamId]++;
      
      // 上級生（3年生以上）の場合は上級生カウントを更新
      if (participant.grade >= 3) {
        teamSeniorCount[bestTeam.teamId]++;
      }
      
      // セクション時間帯カウントを更新
      if (assignmentTimeSlot === 'morning') {
        sectionTimeSlots[participant.section].morning++;
      } else {
        sectionTimeSlots[participant.section].afternoon++;
      }

      // セクション・学年カウントを更新
      teamSectionCount[bestTeam.teamId][participant.section] = (teamSectionCount[bestTeam.teamId][participant.section] || 0) + 1;
      teamGradeCount[bestTeam.teamId][participant.grade] = (teamGradeCount[bestTeam.teamId][participant.grade] || 0) + 1;
    }
  }

  return assignments;
}

function selectBalancedBestTeam(
  candidateTeams: Team[],
  participant: Participant,
  teamAssignmentCount: Record<string, number>,
  teamSeniorCount: Record<string, number>,
  teamSectionCount: Record<string, Record<string, number>>,
  teamGradeCount: Record<string, Record<number, number>>
): Team | null {
  if (candidateTeams.length === 0) return null;

  // 定員に空きがあるチームのみ対象
  const availableTeams = candidateTeams.filter(team => 
    teamAssignmentCount[team.teamId] < (team.maxMembers || 10)
  );
  if (availableTeams.length === 0) return null;

  // 1) 現在の割り当て人数が最小のチームに限定（人数の均等化）
  const minCount = Math.min(...availableTeams.map(t => teamAssignmentCount[t.teamId]));
  let bestTeams = availableTeams.filter(t => teamAssignmentCount[t.teamId] === minCount);

  // 2) セクション重複が少ないチームを優先
  const section = participant.section;
  const minSectionDup = Math.min(...bestTeams.map(t => (teamSectionCount[t.teamId][section] || 0)));
  bestTeams = bestTeams.filter(t => (teamSectionCount[t.teamId][section] || 0) === minSectionDup);

  // 3) 学年重複が少ないチームを優先
  const grade = participant.grade;
  const minGradeDup = Math.min(...bestTeams.map(t => (teamGradeCount[t.teamId][grade] || 0)));
  bestTeams = bestTeams.filter(t => (teamGradeCount[t.teamId][grade] || 0) === minGradeDup);

  // 4) 上級生配置のバランス（チームに上級生がいない場合は上級生を優先）
  const isSenior = grade >= 3;
  const withSeniorPreference = bestTeams.sort((a, b) => {
    const aNeedSenior = teamSeniorCount[a.teamId] === 0 ? 1 : 0;
    const bNeedSenior = teamSeniorCount[b.teamId] === 0 ? 1 : 0;
    if (aNeedSenior !== bNeedSenior) {
      // チームに上級生がいない場合、上級生ならそのチームを優先
      if (isSenior) return bNeedSenior - aNeedSenior; // need=1 を先
    }
    return 0;
  });

  // 5) preferredGrades を軽く考慮
  const preferredFirst = withSeniorPreference.sort((a, b) => {
    const aPref = a.preferredGrades?.includes(grade) ? 1 : 0;
    const bPref = b.preferredGrades?.includes(grade) ? 1 : 0;
    return bPref - aPref;
  });

  // 6) 安定性のため teamId で最終タイブレーク
  preferredFirst.sort((a, b) => a.teamId.localeCompare(b.teamId));

  return preferredFirst[0] || null;
}
