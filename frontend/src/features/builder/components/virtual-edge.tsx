import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react';

export function VirtualEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
}: EdgeProps) {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 8,
  });

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{
        stroke: '#8b5cf6',
        strokeWidth: 1.5,
        strokeDasharray: '6 4',
        opacity: 0.5,
      }}
    />
  );
}
