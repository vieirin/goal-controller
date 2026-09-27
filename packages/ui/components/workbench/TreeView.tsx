'use client';

import { hierarchy, tree as d3tree, type HierarchyPointNode } from 'd3-hierarchy';
import { Maximize2, Minus, Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CONSTRUCT_LABEL, type ViewNode, type ViewTree } from '@/lib/workbench/pistar';
import type { Severity } from '@/lib/workbench/types';
import { useWorkbench } from './WorkbenchContext';
import { IconButton } from './ui';

const NODE_W = 176;
const NODE_H = 58;
const GAP_X = 20;
const GAP_Y = 54;

type Datum = { node: ViewNode | null; children: Datum[] };

/** Goal tree as a hierarchy (a virtual root joins several roots). */
const toHierarchy = (tree: ViewTree): Datum => {
  const seen = new Set<string>();
  const build = (id: string): Datum | null => {
    const node = tree.nodes.get(id);
    if (!node || seen.has(id)) return null;
    seen.add(id);
    return {
      node,
      children: node.children.map(build).filter((d): d is Datum => d !== null),
    };
  };
  const roots = tree.roots.map(build).filter((d): d is Datum => d !== null);
  return roots.length === 1 && roots[0] ? roots[0] : { node: null, children: roots };
};

export const nodeTone = (node: ViewNode | undefined): 'and' | 'or' | 'task' | 'plain' =>
  !node
    ? 'plain'
    : node.kind === 'task'
      ? 'task'
      : node.kind === 'goal'
        ? node.relation === 'or'
          ? 'or'
          : node.relation === 'and'
            ? 'and'
            : 'plain'
        : 'plain';

const TONE = {
  and: { stroke: '#1F7A74', fill: '#FFFFFF', id: '#1F7A74', chip: '#E3F1EF' },
  or: { stroke: '#B7791F', fill: '#FFFFFF', id: '#9A6414', chip: '#F7EEDC' },
  task: { stroke: '#56636B', fill: '#F7F8F8', id: '#3E484E', chip: '#ECEFF0' },
  plain: { stroke: '#9AA4A6', fill: '#FFFFFF', id: '#3A4447', chip: '#F3F5F4' },
} as const;

const truncate = (text: string, max: number): string =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;

const hexagon = (w: number, h: number): string => {
  const inset = 12;
  return `M${inset},0 H${w - inset} L${w},${h / 2} L${w - inset},${h} H${inset} L0,${h / 2} Z`;
};

export default function TreeView() {
  const wb = useWorkbench();
  const { tree, selected, select, problems, selectOrigin, selectSeq } = wb;
  const svg = useRef<SVGSVGElement>(null);
  const [view, setView] = useState({ x: 40, y: 30, k: 1 });
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);

  const layout = useMemo(() => {
    if (!tree) return null;
    const root = hierarchy(toHierarchy(tree), (d) => d.children);
    const laid = d3tree<Datum>().nodeSize([NODE_W + GAP_X, NODE_H + GAP_Y])(root);
    const nodes = laid.descendants().filter((d) => d.data.node !== null);
    const links = laid.links().filter((l) => l.source.data.node !== null);
    const xs = nodes.map((d) => d.x);
    const ys = nodes.map((d) => d.y);
    return {
      nodes,
      links,
      byId: new Map(nodes.map((d) => [d.data.node!.id, d])),
      bounds: {
        minX: Math.min(...xs) - NODE_W / 2,
        maxX: Math.max(...xs) + NODE_W / 2,
        minY: Math.min(...ys),
        maxY: Math.max(...ys) + NODE_H,
      },
    };
  }, [tree]);

  const worst = useMemo(() => {
    const map = new Map<string, Severity>();
    for (const problem of problems) {
      if (!problem.nodeId || problem.severity === 'info') continue;
      if (map.get(problem.nodeId) !== 'error') map.set(problem.nodeId, problem.severity);
    }
    return map;
  }, [problems]);

  const fit = useCallback(() => {
    const el = svg.current;
    if (!el || !layout) return;
    const { width, height } = el.getBoundingClientRect();
    const b = layout.bounds;
    const whole = Math.min((width - 48) / (b.maxX - b.minX), (height - 48) / (b.maxY - b.minY));
    // never shrink below a readable size; a tree that does not fit starts at its root
    const k = Math.min(1.1, Math.max(0.8, whole));
    const root = layout.nodes[0];
    const fits = whole >= 0.8;
    setView({
      k,
      x: fits ? (width - (b.maxX - b.minX) * k) / 2 - b.minX * k : width / 2 - (root?.x ?? 0) * k,
      // below the legend
      y: fits ? (height - (b.maxY - b.minY) * k) / 2 - b.minY * k : 52 - b.minY * k,
    });
  }, [layout]);

  // fit when a different model is opened (node count changes a lot)
  const fittedFor = useRef<number>(-1);
  useEffect(() => {
    const count = layout?.nodes.length ?? 0;
    if (count > 0 && Math.abs(count - fittedFor.current) > 2) {
      fittedFor.current = count;
      fit();
    }
  }, [layout, fit]);

  // bring a node selected elsewhere into view
  useEffect(() => {
    if (!selected || selectOrigin === 'tree' || !layout || !svg.current) return;
    const d = layout.byId.get(selected);
    if (!d) return;
    const { width, height } = svg.current.getBoundingClientRect();
    setView((v) => {
      const sx = d.x * v.k + v.x;
      const sy = d.y * v.k + v.y;
      const inside = sx > 60 && sx < width - 60 && sy > 20 && sy < height - 60;
      return inside ? v : { ...v, x: width / 2 - d.x * v.k, y: height / 3 - d.y * v.k };
    });
  }, [selectSeq, selected, selectOrigin, layout]);

  const zoomBy = (factor: number, cx?: number, cy?: number) => {
    const el = svg.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = cx ?? rect.width / 2;
    const py = cy ?? rect.height / 2;
    setView((v) => {
      const k = Math.min(2.5, Math.max(0.15, v.k * factor));
      return { k, x: px - ((px - v.x) * k) / v.k, y: py - ((py - v.y) * k) / v.k };
    });
  };

  // non-passive wheel listener so the page does not scroll while zooming
  useEffect(() => {
    const el = svg.current;
    if (!el) return undefined;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      if (event.ctrlKey || event.metaKey) {
        zoomBy(Math.exp(-event.deltaY / 300), event.clientX - rect.left, event.clientY - rect.top);
      } else {
        setView((v) => ({ ...v, x: v.x - event.deltaX, y: v.y - event.deltaY }));
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!tree) return;
    const current = selected ? tree.nodes.get(selected) : undefined;
    const pick = (id: string | null | undefined) => {
      if (id) {
        event.preventDefault();
        select(id, 'tree');
      }
    };
    if (!current) {
      if (event.key.startsWith('Arrow')) pick(tree.roots[0]);
      return;
    }
    const parent = current.parent ? tree.nodes.get(current.parent) : undefined;
    const siblings = parent?.children ?? tree.roots;
    const index = siblings.indexOf(current.id);
    if (event.key === 'ArrowUp') pick(current.parent);
    else if (event.key === 'ArrowDown') pick(current.children[0]);
    else if (event.key === 'ArrowLeft') pick(siblings[index - 1]);
    else if (event.key === 'ArrowRight') pick(siblings[index + 1]);
    else if (event.key === 'Escape') select(null, 'tree');
  };

  if (!tree || !layout) {
    return <div className='grid h-full place-items-center text-sm text-ink-muted'>The tree appears once the model parses.</div>;
  }

  const linkPath = (link: { source: HierarchyPointNode<Datum>; target: HierarchyPointNode<Datum> }): string => {
    const sx = link.source.x;
    const sy = link.source.y + NODE_H;
    const tx = link.target.x;
    const ty = link.target.y;
    const my = (sy + ty) / 2;
    return `M${sx},${sy} C${sx},${my} ${tx},${my} ${tx},${ty}`;
  };

  return (
    <div className='relative h-full select-none bg-[radial-gradient(#DDE3E1_1px,transparent_1px)] [background-size:18px_18px]'>
      <svg
        ref={svg}
        className='h-full w-full cursor-grab touch-none outline-none active:cursor-grabbing'
        role='tree'
        aria-label='Goal tree'
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={(event) => {
          if ((event.target as Element).closest('[data-node]')) return;
          drag.current = { x: event.clientX, y: event.clientY, vx: view.x, vy: view.y };
          (event.currentTarget as Element).setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const start = drag.current;
          if (start) setView((v) => ({ ...v, x: start.vx + event.clientX - start.x, y: start.vy + event.clientY - start.y }));
        }}
        onPointerUp={(event) => {
          const start = drag.current;
          drag.current = null;
          if (start && Math.abs(event.clientX - start.x) + Math.abs(event.clientY - start.y) < 3) select(null, 'tree');
        }}
      >
        <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
          {layout.links.map((link) => {
            const parent = link.source.data.node!;
            const tone = nodeTone(parent);
            return (
              <path
                key={`${parent.id}-${link.target.data.node!.id}`}
                d={linkPath(link)}
                fill='none'
                stroke={TONE[tone].stroke}
                strokeOpacity={0.55}
                strokeWidth={1.4}
                strokeDasharray={parent.relation === 'or' ? '5 4' : undefined}
              />
            );
          })}
          {layout.nodes.map((d) => {
            const node = d.data.node!;
            const tone = nodeTone(node);
            const colors = TONE[tone];
            const isSelected = node.id === selected;
            const severity = worst.get(node.id);
            const x = d.x - NODE_W / 2;
            const y = d.y;
            const construct = node.construct ? CONSTRUCT_LABEL[node.construct] : null;
            return (
              <g
                key={node.id}
                data-node={node.id}
                role='treeitem'
                aria-selected={isSelected}
                aria-label={`${node.id} ${node.name}${construct ? `, ${construct}` : ''}`}
                transform={`translate(${x},${y})`}
                className='cursor-pointer'
                onClick={() => select(node.id, 'tree')}
              >
                <title>
                  {`${node.id}: ${node.name}${node.notation ? `  [${node.notation}]` : ''}${construct ? `\n${construct}` : ''}`}
                </title>
                {isSelected && (
                  node.kind === 'task' ? (
                    <path d={hexagon(NODE_W, NODE_H)} transform='translate(-4,-4) scale(1.045,1.14)' fill='none' stroke='#6D4AFF' strokeWidth={2.5} />
                  ) : (
                    <rect x={-4} y={-4} width={NODE_W + 8} height={NODE_H + 8} rx={10} fill='none' stroke='#6D4AFF' strokeWidth={2.5} />
                  )
                )}
                {node.kind === 'task' ? (
                  <path d={hexagon(NODE_W, NODE_H)} fill={colors.fill} stroke={colors.stroke} strokeWidth={1.4} />
                ) : (
                  <rect width={NODE_W} height={NODE_H} rx={node.kind === 'resource' ? 2 : 7} fill={colors.fill} stroke={colors.stroke} strokeWidth={node.kind === 'goal' ? 1.8 : 1.2} />
                )}
                <text x={node.kind === 'task' ? 16 : 10} y={18} className='font-mono' fontSize={11} fontWeight={700} fill={colors.id}>
                  {node.id}
                </text>
                <text x={node.kind === 'task' ? 16 : 10} y={34} fontSize={12} fill='#1E2527'>
                  {truncate(node.name || '(no name)', 24)}
                </text>
                {node.notation && (
                  <g transform='translate(10,40)'>
                    <rect width={Math.min(NODE_W - 20, node.notation.length * 6.6 + 10)} height={14} rx={3} fill={colors.chip} />
                    <text x={5} y={10.5} className='font-mono' fontSize={10} fill={colors.id}>
                      {truncate(node.notation, 24)}
                    </text>
                  </g>
                )}
                {!node.notation && node.kind === 'goal' && node.children.length > 0 && (
                  <text x={10} y={50} fontSize={10} fill='#9AA4A6'>
                    {node.relation === 'or' ? 'OR' : 'AND'} · no notation
                  </text>
                )}
                {severity && (
                  <circle cx={NODE_W - 8} cy={8} r={4.5} fill={severity === 'error' ? '#C2412D' : '#E0A100'} stroke='#FFFFFF' strokeWidth={1.5}>
                    <title>{severity === 'error' ? 'Has errors — see Problems' : 'Has warnings — see Problems'}</title>
                  </circle>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      <div className='pointer-events-none absolute left-3 top-3 flex items-center gap-3 rounded-md border border-line bg-white/90 px-2 py-1 text-2xs text-ink-muted'>
        <span className='flex items-center gap-1'>
          <span className='h-0.5 w-4 bg-and' /> AND
        </span>
        <span className='flex items-center gap-1'>
          <span className='h-0 w-4 border-t-2 border-dashed border-or' /> OR
        </span>
        <span className='hidden sm:inline'>↑↓←→ move · ⌘-scroll zoom</span>
      </div>
      <div className='absolute bottom-3 right-3 flex items-center gap-0.5 rounded-md border border-line bg-white p-0.5 shadow-sm'>
        <IconButton icon={Minus} label='Zoom out' onClick={() => zoomBy(1 / 1.2)} />
        <IconButton icon={Plus} label='Zoom in' onClick={() => zoomBy(1.2)} />
        <IconButton icon={Maximize2} label='Fit tree to view' onClick={fit} />
      </div>
    </div>
  );
}
