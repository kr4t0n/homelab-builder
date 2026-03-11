import { useMemo, useCallback, useState, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeTypes,
  type NodeProps,
  type OnNodesChange,
  Handle,
  Position,
  ReactFlowProvider,
  applyNodeChanges,
} from '@xyflow/react';
import {
  Shield,
  X,
  Server,
  Router,
  CircuitBoard,
  HardDrive,
  Wifi,
  Monitor,
  Cpu,
  Globe,
  Printer,
  Container,
  Box,
  Cloud,
} from 'lucide-react';
import { useBuilderStore } from '../store/builder-store';
import { isNetworkNode } from '../../../lib/hardware-config';
import { cn } from '../../../lib/utils';
import { Button } from '../../../components/ui/button';
import type { HardwareType, HardwareNode as HWNode, VirtualMachine } from '../../../types';

const ICON_MAP: Partial<Record<HardwareType, React.ElementType>> = {
  router: Router,
  switch: CircuitBoard,
  server: Server,
  nas: HardDrive,
  pc: Monitor,
  minipc: Monitor,
  sbc: Cpu,
  access_point: Wifi,
  iot: Printer,
  modem: Globe,
  internet: Cloud,
};

const COLOR_MAP: Partial<Record<HardwareType, string>> = {
  router: '#a855f7',
  switch: '#3b82f6',
  server: '#f97316',
  nas: '#22c55e',
  pc: '#06b6d4',
  minipc: '#0ea5e9',
  sbc: '#84cc16',
  access_point: '#eab308',
  iot: '#ca8a04',
  modem: '#2563eb',
  internet: '#14b8a6',
};

const VM_ICON: Record<string, React.ElementType> = {
  vm: Cpu,
  container: Container,
  lxc: Box,
};

type TsNodeData = {
  label: string;
  type: HardwareType;
  tailscaleIp: string;
  lanIp: string;
  vms: VirtualMachine[];
  accentColor: string;
};

function TailscaleNode({ data }: NodeProps) {
  const d = data as unknown as TsNodeData;
  const Icon = ICON_MAP[d.type] ?? Server;

  return (
    <div className="relative group">
      <div
        className="rounded-xl border-2 bg-slate-900/95 backdrop-blur-sm shadow-lg shadow-blue-500/10 min-w-[200px] overflow-hidden"
        style={{ borderColor: `${d.accentColor}60` }}
      >
        {/* Header */}
        <div
          className="px-3 py-2 flex items-center gap-2 border-b border-slate-700/50"
          style={{ background: `linear-gradient(135deg, ${d.accentColor}15, transparent)` }}
        >
          <Icon className="h-4 w-4 shrink-0" style={{ color: d.accentColor }} />
          <span className="font-semibold text-sm text-slate-100 truncate flex-1">{d.label}</span>
          <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
            {d.type}
          </span>
        </div>

        {/* IPs */}
        <div className="px-3 py-2 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[11px] text-blue-400 font-medium">
              <Shield className="h-3 w-3" /> Tailscale
            </span>
            <span className="font-mono text-[13px] text-blue-300 font-semibold">
              {d.tailscaleIp}
            </span>
          </div>
          {d.lanIp && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-slate-500 font-medium">LAN</span>
              <span className="font-mono text-[11px] text-slate-400">{d.lanIp}</span>
            </div>
          )}

          {/* VMs with Tailscale IPs */}
          {d.vms.length > 0 && (
            <div className="pt-1.5 mt-1.5 border-t border-slate-700/50 space-y-1">
              <span className="text-[9px] uppercase tracking-wider text-slate-500 font-medium">
                {d.vms.length} VM{d.vms.length !== 1 ? 's' : ''} / Container{d.vms.length !== 1 ? 's' : ''}
              </span>
              {d.vms.map(vm => {
                const VmIcon = VM_ICON[vm.type] ?? Box;
                return (
                  <div
                    key={vm.id}
                    className="flex items-center gap-1.5 rounded border border-slate-700/50 bg-slate-800/50 px-2 py-1 text-[10px]"
                  >
                    <VmIcon className="h-2.5 w-2.5 text-slate-400 shrink-0" />
                    <span className="truncate text-slate-300 flex-1 max-w-[80px]" title={vm.name}>
                      {vm.name}
                    </span>
                    {vm.tailscale_ip ? (
                      <span className="font-mono text-blue-400 shrink-0">{vm.tailscale_ip}</span>
                    ) : vm.ip ? (
                      <span className="font-mono text-slate-500 shrink-0">{vm.ip}</span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!bg-blue-500 !border-blue-300 !w-2 !h-2"
      />
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-blue-500 !border-blue-300 !w-2 !h-2"
      />
    </div>
  );
}

const tsNodeTypes: NodeTypes = {
  tailscale: TailscaleNode,
};

function TailscaleViewInner() {
  const hardwareNodes = useBuilderStore(s => s.hardwareNodes);
  const setTailscaleViewActive = useBuilderStore(s => s.setTailscaleViewActive);

  const { initialNodes, tsEdges, enrolledCount, vmCount } = useMemo(() => {
    const enrolled = hardwareNodes.filter(
      (hn: HWNode) => isNetworkNode(hn.type) && hn.tailscale_ip,
    );

    const radius = Math.max(250, enrolled.length * 80);
    const cx = 400;
    const cy = 400;

    const nodes: Node[] = enrolled.map((hn, i) => {
      const angle = (2 * Math.PI * i) / enrolled.length - Math.PI / 2;
      return {
        id: hn.id,
        type: 'tailscale',
        position: {
          x: cx + radius * Math.cos(angle),
          y: cy + radius * Math.sin(angle),
        },
        data: {
          label: hn.name,
          type: hn.type,
          tailscaleIp: hn.tailscale_ip!,
          lanIp: hn.ip || '',
          vms: (hn.vms || []).filter(vm => vm.tailscale_ip || vm.ip),
          accentColor: COLOR_MAP[hn.type] || '#6b7280',
        } satisfies TsNodeData,
      };
    });

    const edges: Edge[] = [];
    for (let i = 0; i < enrolled.length; i++) {
      for (let j = i + 1; j < enrolled.length; j++) {
        edges.push({
          id: `ts-${enrolled[i].id}-${enrolled[j].id}`,
          source: enrolled[i].id,
          target: enrolled[j].id,
          type: 'default',
          animated: true,
          style: {
            stroke: '#3b82f6',
            strokeWidth: 1.5,
            strokeDasharray: '6 4',
            opacity: 0.35,
          },
        });
      }
    }

    const vms = enrolled.reduce(
      (sum, hn) => sum + (hn.vms?.filter(vm => vm.tailscale_ip).length || 0),
      0,
    );

    return { initialNodes: nodes, tsEdges: edges, enrolledCount: enrolled.length, vmCount: vms };
  }, [hardwareNodes]);

  const [tsNodes, setTsNodes] = useState<Node[]>(initialNodes);
  useEffect(() => setTsNodes(initialNodes), [initialNodes]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setTsNodes(nds => applyNodeChanges(changes, nds)),
    [],
  );

  const onClose = useCallback(() => setTailscaleViewActive(false), [setTailscaleViewActive]);

  return (
    <div className="absolute inset-0 z-50 bg-slate-950 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-blue-400">
            <Shield className="h-5 w-5" />
            <span className="font-semibold text-sm">Tailscale Network View</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700">
              {enrolledCount} device{enrolledCount !== 1 ? 's' : ''}
            </span>
            {vmCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700">
                {vmCount} VM{vmCount !== 1 ? 's' : ''}
              </span>
            )}
            <span className="px-2 py-0.5 rounded-full bg-blue-950 border border-blue-800 text-blue-400">
              Full Mesh
            </span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-100 hover:bg-slate-800 gap-1.5"
        >
          <X className="h-4 w-4" />
          Close
        </Button>
      </div>

      {/* ReactFlow canvas */}
      <div className="flex-1">
        <ReactFlow
          nodes={tsNodes}
          edges={tsEdges}
          onNodesChange={onNodesChange}
          nodeTypes={tsNodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          nodesDraggable={true}
          nodesConnectable={false}
          panOnDrag={true}
          zoomOnScroll={true}
          className="bg-slate-950"
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={30} size={1} color="#1e293b" style={{ opacity: 0.6 }} />
          <Controls
            className="[&>button]:!bg-slate-800 [&>button]:!border-slate-700 [&>button]:!text-slate-300 [&>button:hover]:!bg-slate-700"
          />
        </ReactFlow>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 px-4 py-2 border-t border-slate-800 bg-slate-900/80 text-[10px] text-slate-500 shrink-0">
        <span className="flex items-center gap-1.5">
          <span className="w-6 h-px bg-blue-500 opacity-40" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #3b82f6 0, #3b82f6 6px, transparent 6px, transparent 10px)' }} />
          WireGuard Tunnel
        </span>
        <span className="flex items-center gap-1.5">
          <Shield className="h-3 w-3 text-blue-400" />
          Tailscale IP (100.x.y.z)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          Mesh Connected
        </span>
      </div>
    </div>
  );
}

export function TailscaleView() {
  const tailscaleViewActive = useBuilderStore(s => s.tailscaleViewActive);
  const tailscaleEnabled = useBuilderStore(s => s.tailscaleEnabled);

  if (!tailscaleViewActive || !tailscaleEnabled) return null;

  return (
    <ReactFlowProvider>
      <TailscaleViewInner />
    </ReactFlowProvider>
  );
}

export function TailscaleStatusBadge() {
  const tailscaleEnabled = useBuilderStore(s => s.tailscaleEnabled);
  const hardwareNodes = useBuilderStore(s => s.hardwareNodes);

  if (!tailscaleEnabled) return null;

  const enrolledCount = hardwareNodes.filter(
    (hn: HWNode) => isNetworkNode(hn.type) && hn.tailscale_ip,
  ).length;

  return (
    <div className={cn(
      'absolute bottom-10 right-4 z-10 flex items-center gap-2 px-3 py-1.5 rounded-full',
      'bg-blue-950/80 border border-blue-500/30 text-blue-300 text-[11px]',
      'pointer-events-none select-none backdrop-blur-sm',
    )}>
      <Shield className="h-3.5 w-3.5" />
      <span className="font-medium">Tailscale</span>
      <span className="text-blue-400/70">{enrolledCount} device{enrolledCount !== 1 ? 's' : ''}</span>
    </div>
  );
}
