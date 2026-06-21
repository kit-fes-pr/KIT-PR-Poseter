import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  buildDashboardAreaStats,
  buildDashboardEventData,
  buildDashboardMemberStats,
  buildDashboardTeamStats,
  type DashboardMemberStats,
} from '../lib/utils/dashboard-route';

describe('dashboard route utils', () => {
  test('buildDashboardEventData serializes timestamp-like fields', () => {
    const event = buildDashboardEventData({
      id: 'event-1',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      distributionStartDate: {
        toDate: () => new Date('2026-06-01T00:00:00.000Z'),
      },
      distributionEndDate: '2026-06-02',
    });

    assert.equal(event.createdAt, '2026-01-01T00:00:00.000Z');
    assert.equal(event.distributionStartDate, '2026-06-01T00:00:00.000Z');
    assert.equal(event.distributionEndDate, '2026-06-02');
  });

  test('buildDashboardMemberStats groups members by team', () => {
    const stats = buildDashboardMemberStats([
      {
        teamId: 'team-1',
        name: 'Alice',
        studentId: 'S1',
        grade: '3',
        department: 'PR',
      },
      {
        teamId: 'team-1',
        displayName: 'Bob',
        studentId: 'S2',
        grade: 2,
        department: 'Web',
      },
      {
        teamId: 'team-2',
        name: 'Carol',
        studentId: 'S3',
        grade: '1',
        department: '企画',
      },
    ]);

    assert.equal(stats.totalMembers, 3);
    assert.equal(stats.byTeam['team-1'].count, 2);
    assert.deepEqual(stats.byTeam['team-1'].members, [
      {
        name: 'Alice',
        studentId: 'S1',
        grade: '3',
        department: 'PR',
      },
      {
        name: 'Bob',
        studentId: 'S2',
        grade: '2',
        department: 'Web',
      },
    ]);
    assert.equal(stats.byTeam['team-2'].count, 1);
  });

  test('buildDashboardTeamStats and areaStats attach member counts', () => {
    const memberStats: DashboardMemberStats['byTeam'] = {
      teamA: {
        count: 2,
        members: [{ name: 'Alice', studentId: 'S1', grade: '3', department: 'PR' }],
      },
      teamB: {
        count: 1,
        members: [{ name: 'Bob', studentId: 'S2', grade: '2', department: 'Web' }],
      },
    };

    const teams: Array<{ teamId: string; teamCode: string; assignedArea: string }> = [
      { teamId: 'teamA', teamCode: 'A-01', assignedArea: 'A-01' },
      { teamId: 'teamB', teamCode: 'A-02', assignedArea: '' },
    ];

    const teamStats = buildDashboardTeamStats({
      teams,
      memberStatsByTeam: memberStats,
    });

    assert.equal(teamStats[0].memberCount, 2);
    assert.deepEqual(teamStats[0].members, memberStats.teamA.members);
    assert.equal(teamStats[1].memberCount, 1);

    const areaStats = buildDashboardAreaStats({
      teams,
      memberStatsByTeam: memberStats,
    });

    assert.equal(areaStats['A-01'].teamCount, 1);
    assert.equal(areaStats['A-01'].memberCount, 2);
    assert.equal(areaStats['未設定'].teamCount, 1);
    assert.equal(areaStats['未設定'].memberCount, 1);
  });
});
