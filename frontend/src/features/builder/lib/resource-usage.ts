import type { HardwareNode } from '../../../types';

export type ResourceUsage = {
  cpu: number;
  ramMb: number;
  storageGb: number;
};

export const getVmResourceUsage = (childVMs: HardwareNode[] = []): ResourceUsage =>
  childVMs.reduce<ResourceUsage>(
    (usage, vm) => {
      usage.cpu += Number(vm.details?.cpu) || 0;
      const ram = Number(vm.details?.ram) || 0;
      usage.ramMb += ram < 1000 ? ram * 1024 : ram;
      usage.storageGb += Number(vm.details?.storage) || 0;
      return usage;
    },
    { cpu: 0, ramMb: 0, storageGb: 0 },
  );
