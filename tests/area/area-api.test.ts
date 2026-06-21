import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  buildAreaCreateData,
  buildAreaUpdateData,
  shouldBlockAreaDeletion,
  shouldRefreshTeamAfterAreaChange,
} from '../../lib/utils/area/area-api';

describe('area api utils', () => {
  test('buildAreaCreateData and buildAreaUpdateData normalize payloads', () => {
    assert.deepEqual(
      buildAreaCreateData({
        areaCode: ' A-01 ',
        areaName: ' 1号館 ',
        adjacentAreas: 'A-02, A-03,',
        description: 123,
      }),
      {
        areaCode: 'A-01',
        areaName: '1号館',
        adjacentAreas: ['A-02', 'A-03'],
        description: '',
      },
    );
    assert.deepEqual(
      buildAreaUpdateData({
        areaCode: 'A-02',
        areaName: '2号館',
        adjacentAreas: [' A-01 ', '', 'A-03'],
        description: '説明',
      }),
      {
        areaCode: 'A-02',
        areaName: '2号館',
        adjacentAreas: ['A-01', 'A-03'],
        description: '説明',
      },
    );
  });

  test('shouldRefreshTeamAfterAreaChange and shouldBlockAreaDeletion match route behavior', () => {
    assert.equal(
      shouldRefreshTeamAfterAreaChange({
        team: { areaId: 'area-1', assignedArea: '' },
        areaId: 'area-1',
        previousAreaCode: '',
      }),
      true,
    );
    assert.equal(
      shouldRefreshTeamAfterAreaChange({
        team: { areaId: 'area-2', assignedArea: 'A-01' },
        areaId: 'area-1',
        previousAreaCode: 'A-01',
      }),
      true,
    );
    assert.equal(
      shouldRefreshTeamAfterAreaChange({
        team: { areaId: 'area-2', assignedArea: '' },
        areaId: 'area-1',
        previousAreaCode: '',
      }),
      false,
    );

    assert.equal(
      shouldBlockAreaDeletion({
        linkedByAreaIdExists: true,
        linkedByAssignedAreaExists: false,
      }),
      true,
    );
    assert.equal(
      shouldBlockAreaDeletion({
        linkedByAreaIdExists: false,
        linkedByAssignedAreaExists: false,
      }),
      false,
    );
  });
});
