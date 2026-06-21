import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { buildAvailabilitySlotChoices } from '@/lib/utils/availability/availability';
import {
  effectiveSlotCount,
  getMatchingTeamSlots,
  resolveParticipantSlotKeys,
} from '@/lib/utils/assignment/assignment';
import { normalizeGrade } from '@/lib/utils/grade/grade';

interface Participant {
  responseId: string;
  name: string;
  grade: number;
  section: string;
  availableSlots: string[];
}

interface Team {
  teamId: string;
  teamCode: string;
  teamName: string;
  timeSlot: string;
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
  timeSlot: string;
}

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

    const { year, formId, participants, teams } = await request.json();

    if (!year || !formId || !participants || !teams) {
      return NextResponse.json({ error: '必要なデータが不足しています' }, { status: 400 });
    }

    const eventSlotChoices = await loadEventSlotChoices(year);
    if (eventSlotChoices.length === 0) {
      return NextResponse.json(
        { error: '配布枠が未設定です。先に配布設定で登録してください。' },
        { status: 400 },
      );
    }

    const assignmentResult = performAutoAssignment(participants, teams, eventSlotChoices);

    // 既存の自動/手動割り当てを同一年度・フォーム内で一度クリアしてから再作成する
    const existingAssignments = await adminDb
      .collection('assignments')
      .where('year', '==', parseInt(year, 10))
      .where('formId', '==', formId)
      .get();

    const batch = adminDb.batch();
    existingAssignments.docs.forEach((doc) => batch.delete(doc.ref));

    // 割り当て結果をFirestoreに保存
    const assignmentCollection = adminDb.collection('assignments');

    assignmentResult.assignments.forEach((assignment) => {
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
      assignments: assignmentResult.assignments,
      stats: {
        total: participants.length,
        assigned: assignmentResult.assignments.length,
        unassigned: participants.length - assignmentResult.assignments.length,
        skippedUnavailable: assignmentResult.skippedUnavailable,
        skippedNoMatchingTeam: assignmentResult.skippedNoMatchingTeam,
        skippedFull: assignmentResult.skippedFull,
      },
    });
  } catch (error) {
    console.error('自動割り当てエラー:', error);
    return NextResponse.json({ error: '自動割り当てに失敗しました' }, { status: 500 });
  }
}

function performAutoAssignment(
  participants: Participant[],
  teams: Team[],
  eventSlotKeys: string[],
): {
  assignments: Assignment[];
  skippedUnavailable: number;
  skippedNoMatchingTeam: number;
  skippedFull: number;
} {
  const assignments: Assignment[] = [];
  const usedParticipants = new Set<string>();
  let skippedUnavailable = 0;
  let skippedNoMatchingTeam = 0;
  let skippedFull = 0;

  // チーム毎の現在の割り当て数を追跡
  const teamAssignmentCount: Record<string, number> = {};
  teams.forEach((team) => {
    teamAssignmentCount[team.teamId] = 0;
  });

  // チーム毎の上級生（3年生以上）の割り当て状況を追跡
  const teamSeniorCount: Record<string, number> = {};
  teams.forEach((team) => {
    teamSeniorCount[team.teamId] = 0;
  });

  // チームごとのセクション・学年カウント
  const teamSectionCount: Record<string, Record<string, number>> = {};
  const teamGradeCount: Record<string, Record<number, number>> = {};
  teams.forEach((team) => {
    teamSectionCount[team.teamId] = {};
    teamGradeCount[team.teamId] = {} as Record<number, number>;
  });

  const normalizedParticipants = participants.map((participant) => ({
    ...participant,
    grade: normalizeGrade(participant.grade),
  }));
  const normalizedTeams = teams.map((team) => ({
    ...team,
    preferredGrades: Array.isArray(team.preferredGrades)
      ? team.preferredGrades.map((grade) => normalizeGrade(grade)).filter((grade) => grade > 0)
      : undefined,
  }));

  // 参加者を処理順序でソート（3年生以上を優先）
  const sortedParticipants = [...normalizedParticipants].sort((a, b) => {
    const aIsSenior = a.grade >= 3;
    const bIsSenior = b.grade >= 3;

    // 上級生を優先
    if (aIsSenior && !bIsSenior) return -1;
    if (!aIsSenior && bIsSenior) return 1;

    // 制約の多い参加者を先に処理
    if (
      effectiveSlotCount(a.availableSlots, eventSlotKeys) <
      effectiveSlotCount(b.availableSlots, eventSlotKeys)
    )
      return -1;
    if (
      effectiveSlotCount(a.availableSlots, eventSlotKeys) >
      effectiveSlotCount(b.availableSlots, eventSlotKeys)
    )
      return 1;

    return 0;
  });

  for (const participant of sortedParticipants) {
    if (usedParticipants.has(participant.responseId)) continue;

    const participantSlotKeys = resolveParticipantSlotKeys(
      participant.availableSlots,
      eventSlotKeys,
    );
    if (participantSlotKeys.length === 0) {
      skippedUnavailable++;
      continue;
    }

    const candidateTeams = normalizedTeams.filter((team) => {
      return getMatchingTeamSlots(team, eventSlotKeys).some((slot) =>
        participantSlotKeys.includes(slot),
      );
    });

    if (candidateTeams.length === 0) {
      skippedNoMatchingTeam++;
      continue;
    }

    const bestTeam = selectBalancedBestTeam(
      candidateTeams,
      participant,
      teamAssignmentCount,
      teamSeniorCount,
      teamSectionCount,
      teamGradeCount,
    );

    if (bestTeam) {
      const teamSlotKeys = getMatchingTeamSlots(bestTeam, eventSlotKeys);
      const assignmentTimeSlot =
        teamSlotKeys.find((slot) => participantSlotKeys.includes(slot)) || participantSlotKeys[0];
      if (!assignmentTimeSlot) {
        skippedNoMatchingTeam++;
        continue;
      }

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

      // セクション・学年カウントを更新
      teamSectionCount[bestTeam.teamId][participant.section] =
        (teamSectionCount[bestTeam.teamId][participant.section] || 0) + 1;
      teamGradeCount[bestTeam.teamId][participant.grade] =
        (teamGradeCount[bestTeam.teamId][participant.grade] || 0) + 1;
    }
  }

  const skippedByCapacity =
    participants.length - usedParticipants.size - skippedUnavailable - skippedNoMatchingTeam;
  if (skippedByCapacity > 0) {
    skippedFull += skippedByCapacity;
  }

  return {
    assignments,
    skippedUnavailable,
    skippedNoMatchingTeam,
    skippedFull,
  };
}

async function loadEventSlotChoices(year: string) {
  const yearNum = parseInt(year, 10);
  if (Number.isNaN(yearNum)) return [];

  const eventSnap = await adminDb
    .collection('distributionEvents')
    .where('year', '==', yearNum)
    .limit(1)
    .get();

  if (eventSnap.empty) return [];

  const eventData = eventSnap.docs[0].data() as Record<string, unknown>;
  const storedSlots = Array.isArray(eventData.distributionAvailabilitySlots)
    ? (eventData.distributionAvailabilitySlots as unknown[]).filter(
        (slot): slot is string => typeof slot === 'string',
      )
    : [];

  if (storedSlots.length > 0) {
    return storedSlots;
  }

  return buildAvailabilitySlotChoices(
    eventData.distributionStartDate,
    eventData.distributionEndDate,
  ).map((choice) => choice.key);
}

function selectBalancedBestTeam(
  candidateTeams: Team[],
  participant: Participant,
  teamAssignmentCount: Record<string, number>,
  teamSeniorCount: Record<string, number>,
  teamSectionCount: Record<string, Record<string, number>>,
  teamGradeCount: Record<string, Record<number, number>>,
): Team | null {
  if (candidateTeams.length === 0) return null;

  // 定員に空きがあるチームのみ対象
  const availableTeams = candidateTeams.filter(
    (team) => teamAssignmentCount[team.teamId] < (team.maxMembers || 10),
  );
  if (availableTeams.length === 0) return null;

  // 1) 現在の割り当て人数が最小のチームに限定（人数の均等化）
  const minCount = Math.min(...availableTeams.map((t) => teamAssignmentCount[t.teamId]));
  let bestTeams = availableTeams.filter((t) => teamAssignmentCount[t.teamId] === minCount);

  // 2) セクション重複が少ないチームを優先
  const section = participant.section;
  const minSectionDup = Math.min(...bestTeams.map((t) => teamSectionCount[t.teamId][section] || 0));
  bestTeams = bestTeams.filter((t) => (teamSectionCount[t.teamId][section] || 0) === minSectionDup);

  // 3) 学年重複が少ないチームを優先
  const grade = participant.grade;
  const minGradeDup = Math.min(...bestTeams.map((t) => teamGradeCount[t.teamId][grade] || 0));
  bestTeams = bestTeams.filter((t) => (teamGradeCount[t.teamId][grade] || 0) === minGradeDup);

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
