import { useBuilderStore } from '../store/builder-store';
import { useViewport } from '@xyflow/react';
import { isNetworkNode } from '../../../lib/hardware-config';
import { Shield } from 'lucide-react';

export function TailscaleMeshOverlay() {
  const tailscaleViewActive = useBuilderStore(s => s.tailscaleViewActive);
  const tailscaleEnabled = useBuilderStore(s => s.tailscaleEnabled);
  const hardwareNodes = useBuilderStore(s => s.hardwareNodes);
  const nodes = useBuilderStore(s => s.nodes);
  const { x: vpX, y: vpY, zoom } = useViewport();

  if (!tailscaleViewActive || !tailscaleEnabled) return null;

  const tsNodes = hardwareNodes.filter(
    hn => isNetworkNode(hn.type) && hn.tailscale_ip,
  );

  if (tsNodes.length < 2) return null;

  const rfNodeMap = new Map(nodes.map(n => [n.id, n]));

  const positions = tsNodes
    .map(hn => {
      const rfn = rfNodeMap.get(hn.id);
      if (!rfn) return null;
      return {
        id: hn.id,
        tsIp: hn.tailscale_ip!,
        x: rfn.position.x,
        y: rfn.position.y,
        w: rfn.measured?.width ?? 192,
        h: rfn.measured?.height ?? 80,
      };
    })
    .filter(Boolean) as { id: string; tsIp: string; x: number; y: number; w: number; h: number }[];

  const lines: { x1: number; y1: number; x2: number; y2: number; key: string }[] = [];
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const a = positions[i];
      const b = positions[j];
      lines.push({
        x1: a.x + a.w / 2,
        y1: a.y + a.h / 2,
        x2: b.x + b.w / 2,
        y2: b.y + b.h / 2,
        key: `${a.id}-${b.id}`,
      });
    }
  }

  return (
    <svg
      className="absolute inset-0 pointer-events-none z-[1]"
      style={{
        width: '100%',
        height: '100%',
        overflow: 'visible',
      }}
    >
      <defs>
        <linearGradient id="ts-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.5" />
          <stop offset="50%" stopColor="#60a5fa" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.5" />
        </linearGradient>
      </defs>
      <g transform={`translate(${vpX}, ${vpY}) scale(${zoom})`}>
        {lines.map(l => (
          <line
            key={l.key}
            x1={l.x1}
            y1={l.y1}
            x2={l.x2}
            y2={l.y2}
            stroke="url(#ts-gradient)"
            strokeWidth={1.5 / zoom}
            strokeDasharray={`${6 / zoom} ${4 / zoom}`}
            opacity={0.6}
          />
        ))}

        {positions.map(p => (
          <g key={`ts-badge-${p.id}`} transform={`translate(${p.x + p.w / 2}, ${p.y - 12})`}>
            <rect
              x={-32}
              y={-8}
              width={64}
              height={16}
              rx={4}
              fill="#1e3a5f"
              fillOpacity={0.9}
              stroke="#3b82f6"
              strokeWidth={0.5}
            />
            <text
              x={0}
              y={4}
              textAnchor="middle"
              fontSize={8}
              fill="#60a5fa"
              fontFamily="ui-monospace, monospace"
            >
              {p.tsIp}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}

export function TailscaleStatusBadge() {
  const tailscaleEnabled = useBuilderStore(s => s.tailscaleEnabled);
  const hardwareNodes = useBuilderStore(s => s.hardwareNodes);

  if (!tailscaleEnabled) return null;

  const enrolledCount = hardwareNodes.filter(
    hn => isNetworkNode(hn.type) && hn.tailscale_ip,
  ).length;

  return (
    <div className="absolute bottom-10 right-4 z-10 flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-950/80 border border-blue-500/30 text-blue-300 text-[11px] pointer-events-none select-none backdrop-blur-sm">
      <Shield className="h-3.5 w-3.5" />
      <span className="font-medium">Tailscale</span>
      <span className="text-blue-400/70">{enrolledCount} device{enrolledCount !== 1 ? 's' : ''}</span>
    </div>
  );
}
