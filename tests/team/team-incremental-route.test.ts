import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  buildTeamIncrementalDeletedTeamView,
  buildTeamIncrementalTeamView,
  normalizeTeamIncrementalAuthHeader,
  parseTeamIncrementalQuery,
} from '../../lib/utils/team/team-incremental-route';

describe('team incremental route utils', () => {
  test('normalizeTeamIncrementalAuthHeader accepts bearer tokens only', () => {
    assert.equal(normalizeTeamIncrementalAuthHeader('Bearer token-1'), 'token-1');
    assert.equal(normalizeTeamIncrementalAuthHeader('Bearer   token-1'), 'token-1');
    assert.equal(normalizeTeamIncrementalAuthHeader('Basic token-1'), null);
    assert.equal(normalizeTeamIncrementalAuthHeader(null), null);
  });

  test('parseTeamIncrementalQuery parses filters and flags', () => {
    const parsed = parseTeamIncrementalQuery({
      year: '2026',
      lastUpdated: '2026-06-01T00:00:00.000Z',
      includeDeleted: 'true',
    });

    assert.equal(parsed.year, '2026');
    assert.equal(parsed.yearNum, 2026);
    assert.equal(parsed.lastUpdated, '2026-06-01T00:00:00.000Z');
    assert.equal(parsed.includeDeleted, true);
    assert.equal(parsed.lastUpdatedDate?.toISOString(), '2026-06-01T00:00:00.000Z');
  });

  test('buildTeamIncrementalTeamView serializes date-like values', () => {
    const view = buildTeamIncrementalTeamView({
      teamId: 'team-1',
      data: {
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: {
          toDate: () => new Date('2026-02-01T00:00:00.000Z'),
        },
        validStartDate: '2026-03-01',
        validEndDate: 1740787200000,
        validDate: null,
      },
    });

    assert.equal(view.teamId, 'team-1');
    assert.equal(view.createdAt, '2026-01-01T00:00:00.000Z');
    assert.equal(view.updatedAt, '2026-02-01T00:00:00.000Z');
    assert.equal(view.validStartDate, '2026-03-01');
    assert.equal(view.validEndDate, '2025-03-01T00:00:00.000Z');
    assert.equal(view.validDate, null);
  });

  test('buildTeamIncrementalDeletedTeamView marks deleted docs', () => {
    const deleted = buildTeamIncrementalDeletedTeamView({
      teamId: 'team-1',
      data: {
        deletedAt: {
          toDate: () => new Date('2026-06-01T00:00:00.000Z'),
        },
      },
    });

    assert.equal(deleted.teamId, 'team-1');
    assert.equal(deleted.deleted, true);
    assert.equal(deleted.deletedAt, '2026-06-01T00:00:00.000Z');
  });
});
