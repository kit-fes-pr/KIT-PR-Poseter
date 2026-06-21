import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { buildMinimalDashboardResponseData } from '../../lib/utils/availability/availability-route';

describe('availability route utils', () => {
  test('buildMinimalDashboardResponseData preserves minimal dashboard response shape', () => {
    const now = '2026-06-21T12:34:56.000Z';
    const result = buildMinimalDashboardResponseData(
      '2026',
      {
        event: {
          id: 'kohdai2026',
          distributionStartDate: '2026-06-01',
          distributionEndDate: '2026-06-30',
        },
        totalTeams: 8,
        totalMembers: 20,
        totalResponses: 18,
        availableResponses: 12,
        totalAreas: 4,
      },
      123,
      now,
    );

    assert.deepEqual(result.event, {
      id: 'kohdai2026',
      distributionStartDate: '2026-06-01',
      distributionEndDate: '2026-06-30',
    });
    assert.equal(result.stats.totalTeams, 8);
    assert.equal(result.stats.totalMembers, 20);
    assert.equal(result.stats.totalResponses, 18);
    assert.equal(result.stats.availableResponses, 12);
    assert.equal(result.stats.totalAreas, 4);
    assert.equal(result.stats.isMinimal, true);
    assert.deepEqual(result.teams, []);
    assert.equal(result.performance.responseTime, 123);
    assert.equal(result.performance.dataFreshnessTime, now);
    assert.equal(result.performance.isMinimalResponse, true);
    assert.equal(result.loadingStrategy.nextEndpoint, '/api/admin/dashboard/2026/progressive');
    assert.equal(result.loadingStrategy.chunkSize, 10);
    assert.equal(result.loadingStrategy.totalItems, 8);
  });
});
