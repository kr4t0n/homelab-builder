import { memo, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Handle, Position, useUpdateNodeInternals, type NodeProps } from '@xyflow/react';
import {
  Server,
  Router,
  CircuitBoard,
  HardDrive,
  Wifi,
  Monitor,
  Cpu,
  Layers,
  Plug,
  Battery,
  AlertTriangle,
  Printer,
  Globe,
  Cloud,
  Smartphone,
  Tablet,
  Tv,
} from 'lucide-react';
import { Card } from '../../../components/ui/card';
import { cn } from '../../../lib/utils';
import type {
  HardwareType,
  HardwareComponent,
  HardwareSpec,
  HardwareNodeValidationIssue,
} from '../../../types';
import { isComputeNode, nodeHasDynamicPorts, isNetworkNode } from '../../../lib/hardware-config';
import { useBuilderStore } from '../store/builder-store';
import type { K8sMember, K8sCluster } from '../../../types';
import { getNodePortCount } from '../lib/port-count';

type HardwareNodeData = {
  label: string;
  type: HardwareType;
  ip?: string;
  tailscale_ip?: string;
  site?: string;
  internal_components?: HardwareComponent[];
  status?: 'online' | 'offline' | 'warning';
  details?: HardwareSpec;
  parent_id?: string;
};

// ─── Per-type icon + color ─────────────────────────────────────────────────────
const TYPE_CONFIG: Partial<
  Record<
    HardwareType,
    { icon: React.ElementType; border: string; bg: string; iconColor: string; color: string }
  >
> = {
  router: {
    icon: Router,
    border: 'border-border',
    bg: 'bg-purple-500',
    iconColor: 'text-purple-400',
    color: '#a855f7',
  },
  switch: {
    icon: CircuitBoard,
    border: 'border-border',
    bg: 'bg-blue-500',
    iconColor: 'text-blue-400',
    color: '#3b82f6',
  },
  server: {
    icon: Server,
    border: 'border-border',
    bg: 'bg-orange-500',
    iconColor: 'text-orange-400',
    color: '#f97316',
  },
  nas: {
    icon: HardDrive,
    border: 'border-border',
    bg: 'bg-green-500',
    iconColor: 'text-green-400',
    color: '#22c55e',
  },
  pc: {
    icon: Monitor,
    border: 'border-border',
    bg: 'bg-cyan-500',
    iconColor: 'text-cyan-400',
    color: '#06b6d4',
  },
  minipc: {
    icon: Monitor,
    border: 'border-border',
    bg: 'bg-sky-500',
    iconColor: 'text-sky-400',
    color: '#0ea5e9',
  },
  sbc: {
    icon: Cpu,
    border: 'border-border',
    bg: 'bg-lime-500',
    iconColor: 'text-lime-400',
    color: '#84cc16',
  },
  access_point: {
    icon: Wifi,
    border: 'border-border',
    bg: 'bg-yellow-500',
    iconColor: 'text-yellow-400',
    color: '#eab308',
  },
  gpu: {
    icon: Layers,
    border: 'border-border',
    bg: 'bg-pink-500',
    iconColor: 'text-pink-400',
    color: '#ec4899',
  },
  hba: {
    icon: Plug,
    border: 'border-border',
    bg: 'bg-indigo-500',
    iconColor: 'text-indigo-400',
    color: '#6366f1',
  },
  disk: {
    icon: HardDrive,
    border: 'border-border',
    bg: 'bg-gray-500',
    iconColor: 'text-gray-400',
    color: '#6b7280',
  },
  ups: {
    icon: Battery,
    border: 'border-border',
    bg: 'bg-emerald-500',
    iconColor: 'text-emerald-400',
    color: '#10b981',
  },
  pcie: {
    icon: Plug,
    border: 'border-border',
    bg: 'bg-violet-500',
    iconColor: 'text-violet-400',
    color: '#8b5cf6',
  },
  pdu: {
    icon: Plug,
    border: 'border-border',
    bg: 'bg-rose-500',
    iconColor: 'text-rose-400',
    color: '#f43f5e',
  },
  iot: {
    icon: Printer,
    border: 'border-border',
    bg: 'bg-yellow-600',
    iconColor: 'text-yellow-600',
    color: '#ca8a04',
  },
  modem: {
    icon: Globe,
    border: 'border-border',
    bg: 'bg-blue-600',
    iconColor: 'text-blue-600',
    color: '#2563eb',
  },
  phone: {
    icon: Smartphone,
    border: 'border-border',
    bg: 'bg-rose-500',
    iconColor: 'text-rose-500',
    color: '#f43f5e',
  },
  pad: {
    icon: Tablet,
    border: 'border-border',
    bg: 'bg-fuchsia-500',
    iconColor: 'text-fuchsia-500',
    color: '#d946ef',
  },
  tv: {
    icon: Tv,
    border: 'border-border',
    bg: 'bg-amber-500',
    iconColor: 'text-amber-500',
    color: '#f59e0b',
  },
  internet: {
    icon: Cloud,
    border: 'border-border',
    bg: 'bg-teal-500',
    iconColor: 'text-teal-400',
    color: '#14b8a6',
  },
};
const FALLBACK_CONFIG = {
  icon: Server,
  border: 'border-border',
  bg: 'bg-gray-500',
  iconColor: 'text-gray-400',
  color: '#6b7280',
};

// ─── Validation tooltip ─────────────────────────────────────────────────────────
function ValidationTooltip({
  nodeIssues,
  hasResourceWarning,
  hasIpError,
  cpuWarning,
  ramWarning,
  usedCpu,
  totalCpu,
  usedRam,
  totalRamMB,
  maxResourceUsage,
}: {
  nodeIssues: HardwareNodeValidationIssue[];
  hasResourceWarning: boolean;
  hasIpError: boolean;
  cpuWarning: boolean;
  ramWarning: boolean;
  usedCpu: number;
  totalCpu: number;
  usedRam: number;
  totalRamMB: number;
  maxResourceUsage: number;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const isError = hasResourceWarning || hasIpError;

  const handleEnter = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 6, left: rect.right });
    }
    setOpen(true);
  };

  return (
    <div
      ref={triggerRef}
      onMouseEnter={handleEnter}
      onMouseLeave={() => setOpen(false)}
    >
      <AlertTriangle
        className={cn(
          'h-3.5 w-3.5 shrink-0 cursor-help',
          isError ? 'text-destructive animate-pulse' : 'text-orange-500',
        )}
      />
      {open && createPortal(
        <div
          className="fixed z-[9999] w-56 rounded-lg border bg-popover p-2.5 shadow-xl text-popover-foreground animate-in fade-in zoom-in-95 duration-100 pointer-events-auto"
          style={{ top: pos.top, left: pos.left, transform: 'translateX(-100%)' }}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          <p className={cn(
            'text-[10px] font-bold uppercase tracking-wider mb-1.5',
            isError ? 'text-destructive' : 'text-orange-500',
          )}>
            {isError ? 'Validation Errors' : 'Warnings'}
          </p>

          <div className="space-y-1.5">
            {(hasResourceWarning || maxResourceUsage >= 0.8) && (
              <div className="rounded border border-orange-500/20 bg-orange-500/5 px-2 py-1.5 space-y-0.5">
                <p className="text-[10px] font-semibold text-orange-400">
                  {hasResourceWarning ? 'Resource Limit Exceeded' : 'High Resource Usage'}
                </p>
                {(cpuWarning || (totalCpu > 0 && maxResourceUsage >= 0.8)) && (
                  <p className="text-[9px] text-muted-foreground">
                    CPU: {usedCpu} / {totalCpu} cores
                  </p>
                )}
                {(ramWarning || (totalRamMB > 0 && maxResourceUsage >= 0.8)) && (
                  <p className="text-[9px] text-muted-foreground">
                    RAM: {Math.round(usedRam / 1024)}GB / {Math.round(totalRamMB / 1024)}GB
                  </p>
                )}
              </div>
            )}

            {nodeIssues.map((issue, idx) => (
              <div
                key={idx}
                className={cn(
                  'rounded border px-2 py-1.5',
                  issue.type === 'error'
                    ? 'border-destructive/20 bg-destructive/5'
                    : 'border-orange-500/20 bg-orange-500/5',
                )}
              >
                <div className="flex items-start gap-1.5">
                  <span className={cn(
                    'mt-0.5 text-[8px] font-bold uppercase px-1 py-0.5 rounded shrink-0',
                    issue.type === 'error'
                      ? 'bg-destructive/20 text-destructive'
                      : 'bg-orange-500/20 text-orange-500',
                  )}>
                    {issue.type}
                  </span>
                  <p className="text-[10px] text-muted-foreground leading-tight break-words">
                    {issue.message}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

function ComponentChip({ component }: { component: HardwareComponent }) {
  const cfg = TYPE_CONFIG[component.type] ?? FALLBACK_CONFIG;
  const Icon = cfg.icon;

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded border px-1.5 py-1 text-[10px] bg-muted/30 border-border/50 text-muted-foreground',
      )}
    >
      <Icon className={cn('h-2.5 w-2.5 shrink-0', cfg.iconColor)} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold max-w-22.5" title={component.name}>
          {component.name}
        </div>
        {component.details?.model && (
          <div className="text-[9px] opacity-70 truncate">{component.details.model}</div>
        )}
      </div>
    </div>
  );
}

// ─── Main node card ────────────────────────────────────────────────────────────

export const HardwareNode = memo(({ id, data, selected }: NodeProps) => {
  const nodeData = data as unknown as HardwareNodeData;
  const cfg = TYPE_CONFIG[nodeData.type] ?? FALLBACK_CONFIG;
  const Icon = cfg.icon;
  const tailscaleEnabled = useBuilderStore(s => s.tailscaleEnabled);
  const k8sMembers = useBuilderStore(s => s.k8sMembers);
  const k8sClusters = useBuilderStore(s => s.k8sClusters);
  const components = nodeData.internal_components ?? [];
  const isVM = !!nodeData.parent_id;

  const nodeK8s = k8sMembers.find((m: K8sMember) => m.node_id === id);
  const nodeK8sCluster = nodeK8s ? k8sClusters.find((c: K8sCluster) => c.id === nodeK8s.cluster_id) : null;
  const hasComponents = components.length > 0;
  const isCompute = isComputeNode(nodeData.type);

  // For host nodes: count child VMs for resource calculation
  const hardwareNodes = useBuilderStore(s => s.hardwareNodes);
  const childVMs = hardwareNodes.filter(n => n.parent_id === id);
  const childVMCount = childVMs.length;

  const validationIssues = useBuilderStore(s => s.validationIssues);
  const nodeIssues = validationIssues.filter((i: HardwareNodeValidationIssue) => i.node_id === id);
  const hasIpError = nodeIssues.some((i: HardwareNodeValidationIssue) => i.type === 'error');
  const hasIpWarning = nodeIssues.some((i: HardwareNodeValidationIssue) => i.type === 'warning');

  const updateNodeInternals = useUpdateNodeInternals();
  const numPorts = !isVM && nodeHasDynamicPorts(nodeData.type)
      ? Math.max(1, getNodePortCount(nodeData.type, nodeData.details?.ports) - 1)
      : isVM ? 0 : 1;

  // Resource calculations for host nodes
  const usedCpu = childVMs.reduce((acc, vm) => acc + (Number(vm.details?.cpu) || 0), 0);
  const usedRam = childVMs.reduce((acc, vm) => {
    const ram = Number(vm.details?.ram) || 0;
    return acc + (ram < 1000 ? ram * 1024 : ram);
  }, 0);

  const totalCpu = Number(nodeData.details?.cpu) || 0;
  const totalRamGB = Number(nodeData.details?.ram) || 0;
  const totalRamMB = totalRamGB < 1000 ? totalRamGB * 1024 : totalRamGB;

  const cpuWarning = !isVM && totalCpu > 0 && usedCpu > totalCpu;
  const ramWarning = !isVM && totalRamMB > 0 && usedRam > totalRamMB;
  const hasResourceWarning = cpuWarning || ramWarning;

  const cpuUsageRatio = totalCpu > 0 ? usedCpu / totalCpu : 0;
  const ramUsageRatio = totalRamMB > 0 ? usedRam / totalRamMB : 0;
  const maxResourceUsage = isVM ? 0 : Math.max(cpuUsageRatio, ramUsageRatio);

  const hasWarning = hasResourceWarning || maxResourceUsage >= 0.8 || hasIpError || hasIpWarning;

  let lightColor = 'bg-green-500';
  let pingColor = 'bg-green-400 animate-ping';

  if (nodeData.status === 'offline') {
    lightColor = 'bg-gray-500';
    pingColor = 'hidden';
  } else if (
    maxResourceUsage >= 1 ||
    hasResourceWarning ||
    nodeIssues.some((i: HardwareNodeValidationIssue) => i.type === 'error')
  ) {
    lightColor = 'bg-red-500';
    pingColor = 'bg-red-400 animate-ping';
  } else if (
    maxResourceUsage >= 0.8 ||
    nodeIssues.some((i: HardwareNodeValidationIssue) => i.type === 'warning') ||
    nodeData.status === 'warning'
  ) {
    lightColor = 'bg-orange-500';
    pingColor = 'bg-orange-400 animate-ping';
  } else if (maxResourceUsage >= 0.6) {
    lightColor = 'bg-yellow-500';
    pingColor = 'bg-yellow-400 animate-ping';
  }

  let tooltipLabel = '';
  if (hasResourceWarning) {
    tooltipLabel += `Resource limit exceeded!\nCPU: ${usedCpu}/${totalCpu}\nRAM: ${Math.round(usedRam / 1024)}GB/${Math.round(totalRamMB / 1024)}GB\n`;
  } else if (maxResourceUsage >= 0.8) {
    tooltipLabel += `High resource usage\nCPU: ${usedCpu}/${totalCpu}\nRAM: ${Math.round(usedRam / 1024)}GB/${Math.round(totalRamMB / 1024)}GB\n`;
  }
  if (nodeIssues.length > 0) {
    tooltipLabel += nodeIssues
      .map((i: HardwareNodeValidationIssue) => `${i.type.toUpperCase()}: ${i.message}`)
      .join('\n');
  }

  const connectedEdgeCount = useBuilderStore(s =>
    s.edges.reduce((n, e) => n + (e.source === id || e.target === id ? 1 : 0), 0),
  );

  useEffect(() => {
    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => {
        updateNodeInternals(id);
      });
      return () => cancelAnimationFrame(raf2);
    });
    return () => cancelAnimationFrame(raf1);
  }, [id, numPorts, connectedEdgeCount, updateNodeInternals, hasComponents, hasWarning, childVMCount]);

  const dynamicMinWidth = !isVM && nodeHasDynamicPorts(nodeData.type) ? numPorts * 16 : 0;

  return (
    <div className="relative group">
      {selected && (
        <div
          className="absolute -inset-1 -z-10 rounded-2xl pointer-events-none node-selected-ring"
          style={{ '--node-accent': cfg.color } as React.CSSProperties}
        />
      )}

      <Card
        className={cn(
          'transition-[border-color,box-shadow,background-color,transform,opacity] duration-200 ease-out border shadow-none bg-card overflow-hidden border-t-2',
          isVM ? 'w-44' : hasComponents ? 'w-56' : 'w-48',
          isVM ? 'border-dashed border-violet-500/50' : '',
          hasResourceWarning || hasIpError
            ? 'border-destructive shadow-[0_0_10px_rgba(239,68,68,0.3)]'
            : maxResourceUsage >= 0.8 || hasIpWarning
              ? 'border-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.3)]'
              : isVM ? '' : 'border-border',
          hasIpError ? 'bg-destructive/5' : '',
          selected ? 'scale-[1.02]' : 'hover:border-primary/50',
        )}
        style={{
          borderTopColor: isVM ? undefined : (selected ? undefined : cfg.color),
          ...(dynamicMinWidth > 192 ? { minWidth: `${dynamicMinWidth}px` } : {}),
        }}
      >
        {/* Header */}
        <div
          className={cn(
            'px-3 py-2 flex items-center gap-2 border-b border-border bg-card',
            hasResourceWarning || hasIpError
              ? 'bg-destructive/10'
              : maxResourceUsage >= 0.8 || hasIpWarning
                ? 'bg-orange-500/10'
                : selected
                  ? 'bg-primary/5'
                  : '',
          )}
        >
          <Icon className={cn('h-4 w-4 shrink-0', cfg.iconColor)} />
          <span className="font-semibold text-sm truncate flex-1" title={nodeData.label}>
            {nodeData.label}
          </span>

          {isVM && (
            <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-400 shrink-0">
              VM
            </span>
          )}

          {hasWarning && (
            <ValidationTooltip
              nodeIssues={nodeIssues}
              hasResourceWarning={hasResourceWarning}
              hasIpError={hasIpError}
              cpuWarning={cpuWarning}
              ramWarning={ramWarning}
              usedCpu={usedCpu}
              totalCpu={totalCpu}
              usedRam={usedRam}
              totalRamMB={totalRamMB}
              maxResourceUsage={maxResourceUsage}
            />
          )}

          <span className="relative flex h-2 w-2 shrink-0">
            <span
              className={cn(
                'absolute inline-flex h-full w-full rounded-full opacity-75',
                pingColor,
              )}
            />
            <span className={cn('relative inline-flex rounded-full h-2 w-2', lightColor)} />
          </span>
        </div>

        {/* Body */}
        {(nodeData.details?.model ||
          !isNetworkNode(nodeData.type) ||
          hasComponents ||
          nodeData.details?.cpu ||
          nodeData.details?.ram) && (
          <div className="p-2.5 bg-card space-y-1.5">
            {nodeData.details?.model && (
              <p className="text-[9px] text-muted-foreground/70 truncate -mt-0.5">
                {nodeData.details.model}
              </p>
            )}

            {isNetworkNode(nodeData.type) && (
              <div className="flex items-center justify-between gap-2 pt-1 px-1">
                <span className="text-[11px] text-muted-foreground tracking-wide font-medium">
                  IP:
                </span>
                <span
                  className={cn(
                    'font-mono text-[12px]',
                    nodeData.ip ? 'text-foreground' : 'italic opacity-40 text-muted-foreground',
                  )}
                >
                  {nodeData.ip || 'unassigned'}
                </span>
              </div>
            )}

            {tailscaleEnabled && isNetworkNode(nodeData.type) && (
              <div className="flex items-center justify-between gap-2 px-1">
                <span className="text-[10px] text-blue-400 tracking-wide font-medium">
                  TS:
                </span>
                <span
                  className={cn(
                    'font-mono text-[11px]',
                    nodeData.tailscale_ip ? 'text-blue-400' : 'italic opacity-30 text-muted-foreground',
                  )}
                >
                  {nodeData.tailscale_ip || 'not enrolled'}
                </span>
              </div>
            )}

            {nodeK8sCluster && nodeK8s && (
              <div className="flex items-center gap-1.5 px-1">
                <div
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: nodeK8sCluster.color }}
                />
                <span
                  className="text-[9px] font-semibold uppercase tracking-wider"
                  style={{ color: nodeK8sCluster.color }}
                >
                  K8s {nodeK8s.role}
                </span>
                <span className="text-[9px] text-muted-foreground truncate">
                  {nodeK8sCluster.name}
                </span>
              </div>
            )}

            {nodeData.site && (
              <div className="flex items-center gap-1.5 px-1 opacity-70">
                <Globe className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />
                <span className="text-[10px] text-blue-400 truncate" title={nodeData.site}>
                  {nodeData.site.replace(/^https?:\/\//, '')}
                </span>
              </div>
            )}

            {(nodeData.details?.cpu || nodeData.details?.ram || nodeData.details?.storage) && (
              <div className="flex flex-wrap gap-1 pt-0.5">
                {nodeData.details.cpu && (
                  <span
                    className="text-[9px] bg-muted/60 rounded px-1 py-0.5 truncate max-w-full"
                    title={`${nodeData.details.cpu} Cores`}
                  >
                    {nodeData.details.cpu} Core{Number(nodeData.details.cpu) !== 1 ? 's' : ''}
                  </span>
                )}
                {nodeData.details.ram && (
                  <span
                    className="text-[9px] bg-muted/60 rounded px-1 py-0.5 truncate max-w-full"
                    title={`${nodeData.details.ram} GB RAM`}
                  >
                    {Number(nodeData.details.ram) >= 1000 &&
                    Number(nodeData.details.ram) % 1000 === 0
                      ? `${Number(nodeData.details.ram) / 1000}TB`
                      : `${nodeData.details.ram}GB`}{' '}
                    {nodeData.type === 'gpu' ? 'VRAM' : 'RAM'}
                  </span>
                )}
                {nodeData.details.storage && (
                  <span
                    className="text-[9px] bg-muted/60 rounded px-1 py-0.5 truncate max-w-full"
                    title={`${nodeData.details.storage} GB Storage`}
                  >
                    {Number(nodeData.details.storage) >= 1000 &&
                    Number(nodeData.details.storage) % 1000 === 0
                      ? `${Number(nodeData.details.storage) / 1000}TB`
                      : `${nodeData.details.storage}GB`}{' '}
                    Disk
                  </span>
                )}
              </div>
            )}

            {hasComponents && (
              <div className="space-y-1 pt-2 border-t border-border">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-1">
                  Components
                </p>
                <div className="space-y-1">
                  {components.map(comp => (
                    <ComponentChip key={comp.id} component={comp} />
                  ))}
                </div>
              </div>
            )}

            {/* VM count for host nodes */}
            {!isVM && isCompute && childVMCount > 0 && (
              <div className="pt-2 border-t border-border">
                <p className="text-[10px] uppercase tracking-wider text-violet-400 font-medium px-1">
                  {childVMCount} VM{childVMCount !== 1 ? 's' : ''}
                </p>
              </div>
            )}

            {isCompute && !isVM && childVMCount === 0 && !hasComponents && (
              <p className="text-[9px] text-muted-foreground/40 italic text-center py-0.5">
                drop components here
              </p>
            )}
          </div>
        )}
      </Card>

      {isVM ? (
        /* VM nodes: invisible handles so virtual edges can connect */
        <Handle
          type="target"
          position={Position.Top}
          id="target-0"
          className="!w-0 !h-0 !min-w-0 !min-h-0 !border-0 !bg-transparent !opacity-0"
          isConnectable={false}
        />
      ) : (
        <>
          <Handle
            type="target"
            position={Position.Top}
            id="target-0"
            className="bg-muted-foreground! w-3 h-1.5 border! border-background! rounded-sm! hover:bg-primary! hover:scale-125 transition-all"
          />

          {nodeHasDynamicPorts(nodeData.type) ? (
            (() => {
              const portSpacing = 100 / (numPorts + 1);
              return Array.from({ length: numPorts }).map((_, i) => (
                <Handle
                  key={`port-eth${i}`}
                  id={`eth${i}`}
                  type="source"
                  position={Position.Bottom}
                  style={{ left: `${portSpacing * (i + 1)}%` }}
                  className="bg-muted-foreground! w-2 h-2 border! border-background! rounded-sm! hover:bg-primary! hover:scale-125 transition-all"
                  title={`eth${i}`}
                />
              ));
            })()
          ) : (
            <Handle
              id="eth0"
              type="source"
              position={Position.Bottom}
              className="bg-muted-foreground! w-3 h-3 border-2! border-background! rounded-sm! hover:bg-primary! hover:scale-125 transition-all"
              title="eth0"
            />
          )}
        </>
      )}
    </div>
  );
});

HardwareNode.displayName = 'HardwareNode';
