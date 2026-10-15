'use client';

import { QUALITY_PATH } from '@istar-ts/react';
import { Network } from 'lucide-react';
import type {
  Thumbnail,
  ThumbnailLine,
  ThumbnailShape,
} from '@/lib/workbench/thumbnail';

// the canvas's colours: an element's kind, a link's refinement
const SHAPE_CLASS: Record<ThumbnailShape, string> = {
  goal: 'fill-and-soft stroke-and',
  task: 'fill-task-soft stroke-task',
  resource: 'fill-panel-deep stroke-ink-faint',
  quality: 'fill-or-soft stroke-or',
  other: 'fill-white stroke-ink-faint',
};
const LINE_CLASS: Record<ThumbnailLine, string> = {
  and: 'stroke-and/60',
  or: 'stroke-or/70',
  other: 'stroke-ink-faint/60',
};
// istar-ts's task hexagon (TaskShape), drawn over 130 × 36
const TASK_POINTS = [
  [0, 18],
  [15, 0],
  [115, 0],
  [130, 18],
  [115, 36],
  [15, 36],
];
const PAD = 40;

/**
 * A model drawn small, with no text: where its actors and elements are and
 * how they link, as on the canvas. None: a placeholder.
 */
export default function ModelThumbnail({
  thumbnail,
}: {
  thumbnail: Thumbnail | null;
}) {
  if (!thumbnail)
    return (
      <div className='grid h-full w-full place-items-center text-ink-faint'>
        <Network className='h-6 w-6' aria-hidden />
      </div>
    );
  const { box } = thumbnail;
  return (
    <svg
      className='h-full w-full'
      viewBox={`${box.x - PAD} ${box.y - PAD} ${box.w + 2 * PAD} ${box.h + 2 * PAD}`}
      preserveAspectRatio='xMidYMid meet'
      aria-hidden
    >
      <g vectorEffect='non-scaling-stroke' strokeWidth={1}>
        {thumbnail.actors.map((a, i) => (
          <rect
            key={`a${i}`}
            x={a.x}
            y={a.y}
            width={a.w}
            height={a.h}
            rx={28}
            className='fill-white stroke-line-strong'
            strokeDasharray='6 4'
            vectorEffect='non-scaling-stroke'
          />
        ))}
        {thumbnail.links.map((l, i) => (
          <line
            key={`l${i}`}
            x1={l.x1}
            y1={l.y1}
            x2={l.x2}
            y2={l.y2}
            className={LINE_CLASS[l.line]}
            vectorEffect='non-scaling-stroke'
          />
        ))}
        {thumbnail.elements.map((e, i) => {
          const className = SHAPE_CLASS[e.shape];
          if (e.shape === 'task')
            return (
              <polygon
                key={`e${i}`}
                points={TASK_POINTS.map(
                  ([px, py]) =>
                    `${e.x + (px! * e.w) / 130},${e.y + (py! * e.h) / 36}`,
                ).join(' ')}
                className={className}
                vectorEffect='non-scaling-stroke'
              />
            );
          if (e.shape === 'quality')
            return (
              <svg
                key={`e${i}`}
                x={e.x}
                y={e.y}
                width={e.w}
                height={e.h}
                viewBox='-0.5 -12.5 117 55.4'
                preserveAspectRatio='none'
                overflow='visible'
              >
                <path
                  d={QUALITY_PATH}
                  className={className}
                  vectorEffect='non-scaling-stroke'
                />
              </svg>
            );
          return (
            <rect
              key={`e${i}`}
              x={e.x}
              y={e.y}
              width={e.w}
              height={e.h}
              rx={
                e.shape === 'goal'
                  ? Math.min(20, e.h / 2)
                  : e.shape === 'other'
                    ? 4
                    : 0
              }
              className={className}
              vectorEffect='non-scaling-stroke'
            />
          );
        })}
      </g>
    </svg>
  );
}
