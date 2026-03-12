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
  Network,
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
  Crown,
  Cog,
} from 'lucide-react';
import { useBuilderStore } from '../store/builder-store';
import { cn } from '../../../lib/utils';
import { Button } from '../../../components/ui/button';
import type { HardwareType, K8sCluster, K8sMember } from '../../../types';

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

type K8sNodeData = {
  label: string;
  type: HardwareType;
  role: 'master' | 'worker';
  ip: string;
  clusterColor: string;
  clusterName: string;
  isVm: boolean;
  vmType?: string;
};

const VM_ICON: Record<string, React.ElementType> = {
  vm: Cpu,
  container: Container,
  lxc: Box,
};

function K8sNode({ data }: NodeProps) {
  const d = data as unknown as K8sNodeData;
  const Icon = d.isVm
    ? (VM_ICON[d.vmType || 'vm'] ?? Box)
    : (ICON_MAP[d.type] ?? Server);
  const isMaster = d.role === 'master';

  return (
    <div className="relative group">
      <div
        className="rounded-xl border-2 bg-slate-900/95 backdrop-blur-sm shadow-lg min-w-[180px] overflow-hidden"
        style={{
          borderColor: `${d.clusterColor}60`,
          boxShadow: isMaster ? `0 0 20px ${d.clusterColor}20` : undefined,
        }}
      >
        <div
          className="px-3 py-2 flex items-center gap-2 border-b border-slate-700/50"
          style={{ background: `linear-gradient(135deg, ${d.clusterColor}15, transparent)` }}
        >
          <Icon className="h-4 w-4 shrink-0" style={{ color: d.clusterColor }} />
          <span className="font-semibold text-sm text-slate-100 truncate flex-1">{d.label}</span>
          {isMaster ? (
            <Crown className="h-3.5 w-3.5 shrink-0" style={{ color: d.clusterColor }} />
          ) : (
            <Cog className="h-3.5 w-3.5 shrink-0 text-slate-500" />
          )}
        </div>

        <div className="px-3 py-2 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: `${d.clusterColor}20`,
                color: d.clusterColor,
              }}
            >
              {d.role}
            </span>
            <span className="text-[9px] text-slate-500">{d.isVm ? 'VM' : d.type}</span>
          </div>
          {d.ip && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-slate-500">IP</span>
              <span className="font-mono text-[11px] text-slate-300">{d.ip}</span>
            </div>
          )}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="w-2! h-2!"
        style={{ backgroundColor: d.clusterColor, borderColor: d.clusterColor }}
      />
      <Handle
        type="target"
        position={Position.Left}
        className="w-2! h-2!"
        style={{ backgroundColor: d.clusterColor, borderColor: d.clusterColor }}
      />
    </div>
  );
}

const k8sNodeTypes: NodeTypes = {
  k8s: K8sNode,
};

function K8sOverlayInner() {
  const hardwareNodes = useBuilderStore(s => s.hardwareNodes);
  const k8sClusters = useBuilderStore(s => s.k8sClusters);
  const k8sMembers = useBuilderStore(s => s.k8sMembers);
  const setK8sOverlayActive = useBuilderStore(s => s.setK8sOverlayActive);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setK8sOverlayActive(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setK8sOverlayActive]);

  const { initialNodes, k8sEdges, clusterStats } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const stats: { cluster: K8sCluster; masters: number; workers: number }[] = [];

    let clusterOffsetX = 0;

    for (const cluster of k8sClusters) {
      const members = k8sMembers.filter((m: K8sMember) => m.cluster_id === cluster.id);
      if (members.length === 0) {
        stats.push({ cluster, masters: 0, workers: 0 });
        continue;
      }

      const masters = members.filter(m => m.role === 'master');
      const workers = members.filter(m => m.role === 'worker');
      stats.push({ cluster, masters: masters.length, workers: workers.length });

      const cx = clusterOffsetX + 400;
      const cy = 400;
      const radius = Math.max(200, members.length * 70);

      const masterIds: string[] = [];

      members.forEach((member, i) => {
        const hw = hardwareNodes.find(n => n.id === member.node_id);
        if (!hw) return;

        const isVm = !!member.vm_id;
        const vm = isVm ? hw.vms?.find(v => v.id === member.vm_id) : null;
        const nodeId = member.vm_id ? `${member.node_id}-${member.vm_id}` : member.node_id;

        const angle = (2 * Math.PI * i) / members.length - Math.PI / 2;
        const isMaster = member.role === 'master';

        if (isMaster) masterIds.push(nodeId);

        const x = isMaster ? cx : cx + radius * Math.cos(angle);
        const y = isMaster ? cy + (masterIds.length - 1) * 120 : cy + radius * Math.sin(angle);

        nodes.push({
          id: nodeId,
          type: 'k8s',
          position: { x, y },
          data: {
            label: isVm ? (vm?.name || 'VM') : hw.name,
            type: hw.type,
            role: member.role,
            ip: isVm ? (vm?.ip || '') : (hw.ip || ''),
            clusterColor: cluster.color,
            clusterName: cluster.name,
            isVm,
            vmType: vm?.type,
          } satisfies K8sNodeData,
        });
      });

      // Star topology: connect all workers to all masters
      for (const masterId of masterIds) {
        for (const member of workers) {
          const hw = hardwareNodes.find(n => n.id === member.node_id);
          if (!hw) continue;
          const workerId = member.vm_id ? `${member.node_id}-${member.vm_id}` : member.node_id;
          edges.push({
            id: `k8s-${masterId}-${workerId}`,
            source: masterId,
            target: workerId,
            type: 'default',
            animated: true,
            style: {
              stroke: cluster.color,
              strokeWidth: 1.5,
              strokeDasharray: '6 4',
              opacity: 0.4,
            },
          });
        }
      }

      clusterOffsetX += radius * 2 + 300;
    }

    return { initialNodes: nodes, k8sEdges: edges, clusterStats: stats };
  }, [hardwareNodes, k8sClusters, k8sMembers]);

  const [overlayNodes, setOverlayNodes] = useState<Node[]>(initialNodes);
  useEffect(() => setOverlayNodes(initialNodes), [initialNodes]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setOverlayNodes(nds => applyNodeChanges(changes, nds)),
    [],
  );

  const totalMembers = k8sMembers.length;

  return (
    <div className="absolute inset-0 z-50 bg-slate-950 flex flex-col">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-violet-400">
            <Network className="h-5 w-5" />
            <span className="font-semibold text-sm">Kubernetes Cluster View</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700">
              {k8sClusters.length} cluster{k8sClusters.length !== 1 ? 's' : ''}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700">
              {totalMembers} node{totalMembers !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {clusterStats.map(({ cluster, masters, workers }) => (
              <span
                key={cluster.id}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px]"
                style={{
                  borderColor: `${cluster.color}40`,
                  color: cluster.color,
                  backgroundColor: `${cluster.color}10`,
                }}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cluster.color }} />
                {cluster.name}
                <span className="text-slate-500">
                  {masters}M / {workers}W
                </span>
              </span>
            ))}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setK8sOverlayActive(false)}
          className="text-slate-400 hover:text-slate-100 hover:bg-slate-800 gap-1.5"
        >
          <X className="h-4 w-4" />
          Close
        </Button>
      </div>

      <div className="flex-1">
        <ReactFlow
          nodes={overlayNodes}
          edges={k8sEdges}
          onNodesChange={onNodesChange}
          nodeTypes={k8sNodeTypes}
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
            className="[&>button]:bg-slate-800! [&>button]:border-slate-700! [&>button]:text-slate-300! [&>button:hover]:bg-slate-700!"
          />
        </ReactFlow>
      </div>

      <div className="flex items-center justify-center gap-6 px-4 py-2 border-t border-slate-800 bg-slate-900/80 text-[10px] text-slate-500 shrink-0">
        <span className="flex items-center gap-1.5">
          <Crown className="h-3 w-3 text-violet-400" />
          Master Node
        </span>
        <span className="flex items-center gap-1.5">
          <Cog className="h-3 w-3 text-slate-400" />
          Worker Node
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-6 h-px opacity-40" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #8b5cf6 0, #8b5cf6 6px, transparent 6px, transparent 10px)' }} />
          Control Plane Link
        </span>
      </div>
    </div>
  );
}

export function K8sClusterOverlay() {
  const k8sOverlayActive = useBuilderStore(s => s.k8sOverlayActive);
  const k8sClusters = useBuilderStore(s => s.k8sClusters);

  if (!k8sOverlayActive || k8sClusters.length === 0) return null;

  return (
    <ReactFlowProvider>
      <K8sOverlayInner />
    </ReactFlowProvider>
  );
}

export function K8sStatusBadge() {
  const k8sClusters = useBuilderStore(s => s.k8sClusters);
  const k8sMembers = useBuilderStore(s => s.k8sMembers);
  const setK8sOverlayActive = useBuilderStore(s => s.setK8sOverlayActive);

  if (k8sClusters.length === 0) return null;

  return (
    <button
      onClick={() => setK8sOverlayActive(true)}
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-full',
        'bg-violet-950/80 border border-violet-500/30 text-violet-300 text-[11px]',
        'select-none backdrop-blur-sm cursor-pointer',
        'hover:bg-violet-900/80 hover:border-violet-400/50 transition-colors',
      )}
    >
      <Network className="h-3.5 w-3.5" />
      <span className="font-medium">K8s</span>
      <span className="text-violet-400/70">
        {k8sClusters.length} cluster{k8sClusters.length !== 1 ? 's' : ''}
        {k8sMembers.length > 0 && ` / ${k8sMembers.length} node${k8sMembers.length !== 1 ? 's' : ''}`}
      </span>
    </button>
  );
}
