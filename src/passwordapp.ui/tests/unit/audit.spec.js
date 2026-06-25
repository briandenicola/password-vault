import { describe, it, expect } from 'vitest';
import audit from '../../src/components/audit/audit.js';

function makeGroups(count) {
  return Array.from({ length: count }, (_, i) => ({
    count: 2,
    accounts: [
      { id: `${i}-a`, accountName: `account-${i}-a`, siteName: 'example.com' },
      { id: `${i}-b`, accountName: `account-${i}-b`, siteName: 'example.com' },
    ],
  }));
}

describe('SecurityAudit pagination', () => {
  it('shows only the active reused-password group page', () => {
    const vm = {
      ...audit.data(),
      groups: makeGroups(12),
      reusedFirst: 5,
      reusedRows: 5,
    };

    expect(audit.computed.pagedGroups.call(vm)).toHaveLength(5);
    expect(audit.computed.reusedRangeStart.call(vm)).toBe(6);
    expect(audit.computed.reusedRangeEnd.call(vm)).toBe(10);
    expect(audit.computed.showReusedPaginator.call(vm)).toBe(true);
  });

  it('resets the reused-password page when a new report runs', async () => {
    const vm = {
      ...audit.data(),
      reusedFirst: 10,
      fetchDecryptedEntries: async () => ({
        total: 4,
        failedCount: 0,
        entries: [
          { id: '1', accountName: 'a', siteName: 'x', password: 'shared' },
          { id: '2', accountName: 'b', siteName: 'y', password: 'shared' },
          { id: '3', accountName: 'c', siteName: 'z', password: 'unique' },
        ],
      }),
    };

    await audit.methods.runReport.call(vm);

    expect(vm.reusedFirst).toBe(0);
    expect(vm.groups).toHaveLength(1);
    expect(vm.reusedAccounts).toBe(2);
  });
});
