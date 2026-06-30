import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { hasAdminPrivileges } from '../../lib/utils/admin/auth';

describe('admin auth utils', () => {
  test('hasAdminPrivileges accepts role admin and isAdmin true', () => {
    assert.equal(hasAdminPrivileges({ role: 'admin' }), true);
    assert.equal(hasAdminPrivileges({ isAdmin: true }), true);
    assert.equal(hasAdminPrivileges({ role: 'admin', isAdmin: true }), true);
  });

  test('hasAdminPrivileges rejects non-admin claims', () => {
    assert.equal(hasAdminPrivileges({ role: 'user' }), false);
    assert.equal(hasAdminPrivileges({ isAdmin: false }), false);
    assert.equal(hasAdminPrivileges({}), false);
    assert.equal(hasAdminPrivileges(null), false);
  });
});
