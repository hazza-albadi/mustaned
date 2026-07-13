"use client";

import { memo } from "react";
import { BaseEdge, getSmoothStepPath, type EdgeProps } from "reactflow";

export type OrgFlowEdgeData = {
  // This edge connects the focused node to one of its direct children.
  active: boolean;
  // The traveling pulse has finished — the edge is now in its bold, static
  // state. Only meaningful when active is true.
  settled: boolean;
  // Some other node is focused and this edge isn't part of that branch.
  dimmed: boolean;
  // Changes whenever a branch is (re)selected — used as the pulse dot's React
  // key so it remounts and restarts its travel animation on every new click,
  // even re-selecting the same node after clearing it.
  activationKey: string;
};

function OrgFlowEdgeImpl({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<OrgFlowEdgeData>) {
  const [path] = getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const active = data?.active ?? false;
  const settled = data?.settled ?? false;
  const dimmed = data?.dimmed ?? false;

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke: active ? "var(--utas-orange)" : "var(--utas-navy)",
          strokeWidth: active && settled ? 3 : 1.5,
          opacity: dimmed ? 0.15 : active ? 1 : 0.35,
          transition: "stroke-width 150ms ease, opacity 200ms ease, stroke 150ms ease",
        }}
      />
      {active && !settled && (
        <circle key={data?.activationKey} r={5} fill="var(--utas-orange)">
          <animateMotion dur="0.4s" begin="0s" fill="freeze" path={path} />
        </circle>
      )}
    </>
  );
}

export const OrgFlowEdge = memo(OrgFlowEdgeImpl);
