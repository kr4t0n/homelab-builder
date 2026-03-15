import { describe, expect, it } from 'vitest';

import type { HardwareNode } from '../../../types';
import { getVmResourceUsage } from './resource-usage';

const makeChildVM = (overrides: Partial<HardwareNode> = {}): HardwareNode => ({
  id: overrides.id ?? 'vm-1',
  name: overrides.name ?? 'workload',
  type: overrides.type ?? 'server',
  ip: overrides.ip ?? '',
  x: 0,
  y: 0,
  parent_id: overrides.parent_id ?? 'host-1',
  details: overrides.details ?? {},
});

describe('getVmResourceUsage', () => {
  it('sums cpu and ram from child VM details', () => {
    const usage = getVmResourceUsage([
      makeChildVM({ id: 'vm-1', details: { cpu: 2, ram: 2048 } }),
      makeChildVM({ id: 'vm-2', details: { cpu: 4, ram: 4096 } }),
    ]);

    expect(usage).toEqual({ cpu: 6, ramMb: 6144, storageGb: 0 });
  });

  it('returns zero when there are no child VMs', () => {
    const usage = getVmResourceUsage([]);

    expect(usage).toEqual({ cpu: 0, ramMb: 0, storageGb: 0 });
  });

  it('handles missing details gracefully', () => {
    const usage = getVmResourceUsage([
      makeChildVM({ id: 'vm-1', details: {} }),
    ]);

    expect(usage).toEqual({ cpu: 0, ramMb: 0, storageGb: 0 });
  });

  it('includes storage from details', () => {
    const usage = getVmResourceUsage([
      makeChildVM({ id: 'vm-1', details: { cpu: 1, ram: 1024, storage: 50 } }),
    ]);

    expect(usage).toEqual({ cpu: 1, ramMb: 1024, storageGb: 50 });
  });

  it('converts small ram values (< 1000) from GB to MB', () => {
    const usage = getVmResourceUsage([
      makeChildVM({ id: 'vm-1', details: { cpu: 1, ram: 8 } }),
    ]);

    expect(usage).toEqual({ cpu: 1, ramMb: 8192, storageGb: 0 });
  });
});
