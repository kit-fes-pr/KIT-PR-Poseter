import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  buildAreaRouteCreateData,
  buildAreaRouteUpdateData,
  hasRequiredAreaPayload,
  normalizeAreaAuthHeader,
} from '../../lib/utils/area/area-route';

describe('area route utils', () => {
  test('normalizeAreaAuthHeader accepts bearer tokens only', () => {
    assert.equal(normalizeAreaAuthHeader('Bearer token-1'), 'token-1');
    assert.equal(normalizeAreaAuthHeader('Bearer   token-1'), 'token-1');
    assert.equal(normalizeAreaAuthHeader('Basic token-1'), null);
    assert.equal(normalizeAreaAuthHeader(null), null);
  });

  test('hasRequiredAreaPayload validates required fields', () => {
    assert.equal(hasRequiredAreaPayload({ areaCode: 'A-01', areaName: '1号館' }), true);
    assert.equal(hasRequiredAreaPayload({ areaCode: '  ', areaName: '1号館' }), false);
    assert.equal(hasRequiredAreaPayload({ areaCode: 'A-01', areaName: '' }), false);
  });

  test('buildAreaRouteCreateData and update data preserve route defaults', () => {
    assert.deepEqual(
      buildAreaRouteCreateData({
        areaCode: ' A-01 ',
        areaName: ' 1号館 ',
        adjacentAreas: 'A-02, A-03,',
        description: '説明',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
      {
        areaCode: 'A-01',
        areaName: '1号館',
        adjacentAreas: ['A-02', 'A-03'],
        description: '説明',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    );
    assert.deepEqual(
      buildAreaRouteUpdateData({
        areaCode: 'A-02',
        areaName: '2号館',
        adjacentAreas: ['A-01', '', 'A-03'],
        description: '',
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      }),
      {
        areaCode: 'A-02',
        areaName: '2号館',
        adjacentAreas: ['A-01', 'A-03'],
        description: '',
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      },
    );
  });
});
