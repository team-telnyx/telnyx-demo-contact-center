'use client';

import { BaseEdge, EdgeLabelRenderer, getBezierPath } from 'reactflow';

export default function PillEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  style = {}, markerEnd, label, data,
}: {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: any;
  targetPosition: any;
  style?: React.CSSProperties;
  markerEnd?: string;
  label?: string;
  data?: any;
}) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  const isDigit = data?.sourceHandle && data.sourceHandle !== 'default';
  const color = isDigit ? '#f59e0b' : '#6366f1';

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth: 2,
          stroke: color,
          strokeDasharray: isDigit ? '' : '6 3',
        }}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold shadow-lg border whitespace-nowrap ${
              isDigit
                ? 'bg-tx-citron/20 border-tx-citron/30 text-tx-citron'
                : 'bg-tx-green/20 border-tx-green/30 text-tx-green'
            }`}>
              {label}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
