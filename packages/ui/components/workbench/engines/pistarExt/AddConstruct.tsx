'use client';

import {
  ISTAR_NODE_KINDS,
  kindLabel,
  MODEL_NAMESPACE,
  takenName,
  type ModelExtension,
} from '@goal-controller/dialect';
import { LINE_DASHES, shapeViewBox } from '@istar-ts/react';
import { Plus, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { writeModelExtension } from '@/lib/workbench/pistar';
import { useWorkbench } from '../../WorkbenchContext';
import { Button, IconButton, cx } from '../../ui';
import { inputClass } from '../shared/inspector';
import { usePistarExt } from './usePistarExt';

/**
 * piStar-ext's "Add new" (its paper's Fig. 4): a new construct for this model,
 * a node drawn with SVG path data, or a link between kinds, with a line and a
 * marker. It joins the palette at once. piStar-ext keeps constructs in the
 * browser; here they are the model's, in its file's `"metamodel"` block, which
 * istar-ts reads, checks and draws (saved as `istar.<Name>`, piStar-ext's
 * type for them).
 */
export default function AddConstruct() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type='button'
        onClick={() => setOpen(true)}
        title='Add a new construct (a node or a link) to this model'
        className='flex shrink-0 flex-col items-center justify-center gap-0.5 border-b border-l border-line bg-white px-3 text-[11px] text-ink-soft hover:bg-panel hover:text-ink'
      >
        <Plus className='h-4 w-4' aria-hidden />
        Add new
      </button>
      {open && <AddConstructDialog onClose={() => setOpen(false)} />}
    </>
  );
}

const LINES = ['continuous', 'dashed', 'dotted'] as const;
const NAME = /^[A-Za-z][A-Za-z0-9]*$/;

function AddConstructDialog({ onClose }: { onClose: () => void }) {
  const wb = useWorkbench();
  const { extension, model } = usePistarExt();
  const [name, setName] = useState('');
  const [type, setType] = useState<'node' | 'link'>('node');
  const [shape, setShape] = useState('');
  const [sources, setSources] = useState<string[]>([]);
  const [targets, setTargets] = useState<string[]>([]);
  const [line, setLine] = useState<(typeof LINES)[number]>('continuous');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // what a link may join: iStar's nodes, the dialect's and the model's
  const ends = [
    ...ISTAR_NODE_KINDS,
    ...extension.elements
      .filter((e) => e.category !== 'actor')
      .map((e) => e.kind),
  ];
  // piStar-ext capitalises a construct's name
  const named = name.trim().charAt(0).toUpperCase() + name.trim().slice(1);
  const problem = !named
    ? 'Give it a name'
    : !NAME.test(named)
      ? 'A name is letters and digits, starting with a letter'
      : (takenName(extension, 'kind', named) ??
        (type === 'link' && (!sources.length || !targets.length)
          ? 'A link needs its source and target kinds'
          : null));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (problem) return setError(problem);
    const path = shape.trim();
    // a node goes inside actors, at a node's size (istar-ts's default)
    const kind = {
      kind: `${MODEL_NAMESPACE}.${named}`,
      label: named,
      pistarType: `istar.${named}`,
    };
    const dash = LINE_DASHES[line];
    const next: ModelExtension =
      type === 'node'
        ? {
            ...model,
            elements: [
              ...(model.elements ?? []),
              {
                ...kind,
                category: 'node',
                ...(path ? { shape: { path } } : {}),
              },
            ],
          }
        : {
            ...model,
            links: [
              ...(model.links ?? []),
              {
                ...kind,
                rules: { sources, targets },
                line: {
                  ...(dash ? { dash } : {}),
                  ...(path ? { marker: path } : {}),
                },
              },
            ],
          };
    try {
      // istar-ts and the dialect must take it (they say why not)
      wb.setText(writeModelExtension(wb.text, 'pistarext', next), 'inspector');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-6'>
      <form
        role='dialog'
        aria-modal='true'
        aria-labelledby='add-construct-title'
        onSubmit={submit}
        className='flex max-h-[92dvh] w-full max-w-md flex-col rounded-xl bg-white shadow-2xl'
      >
        <header className='flex items-start gap-3 border-b border-line px-5 py-4'>
          <div className='min-w-0 flex-1'>
            <h2
              id='add-construct-title'
              className='text-[15px] font-semibold text-ink'
            >
              Create a new Construct
            </h2>
            <p className='mt-0.5 text-[13px] text-ink-muted'>
              It joins the palette, and is kept in this model (saved as{' '}
              <code>istar.{named || 'Name'}</code>, as piStar-ext saves it).
            </p>
          </div>
          <IconButton icon={X} label='Cancel' onClick={onClose} />
        </header>
        <div className='min-h-0 flex-1 space-y-3 overflow-auto px-5 py-4 text-[13px]'>
          <label className='block space-y-1'>
            <span className='text-2xs font-semibold text-ink-soft'>Name</span>
            <input
              className={inputClass}
              value={name}
              autoFocus
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
            />
          </label>
          <label className='block space-y-1'>
            <span className='text-2xs font-semibold text-ink-soft'>Type</span>
            <select
              className={inputClass}
              value={type}
              onChange={(e) => setType(e.target.value as 'node' | 'link')}
            >
              <option value='node'>Node</option>
              <option value='link'>Link</option>
            </select>
          </label>
          <label className='block space-y-1'>
            <span className='text-2xs font-semibold text-ink-soft'>
              {type === 'node' ? 'Shape' : 'Marker'} (SVG path data)
            </span>
            <textarea
              className={cx(inputClass, 'h-16 font-mono text-xs')}
              placeholder={
                type === 'node'
                  ? 'M 0 0 L 80 0 L 100 20 L 80 40 L 0 40 Z (none: a dashed box)'
                  : 'm 10,-6 l -10,6 10,6 (none: an open arrow)'
              }
              value={shape}
              onChange={(e) => setShape(e.target.value)}
            />
          </label>
          {shape.trim() && (
            <div className='flex items-center gap-3'>
              <span className='text-2xs text-ink-muted'>Preview</span>
              <svg
                viewBox={shapeViewBox({ path: shape.trim() })}
                className='h-14 w-24 rounded border border-line bg-white'
                aria-label='Shape preview'
              >
                <path
                  d={shape.trim()}
                  fill={type === 'node' ? '#CDFECD' : 'none'}
                  stroke='black'
                  strokeWidth={1}
                  vectorEffect='non-scaling-stroke'
                />
              </svg>
            </div>
          )}
          {type === 'link' && (
            <>
              <div className='grid grid-cols-2 gap-2'>
                <KindsSelect
                  label='Source'
                  kinds={ends}
                  value={sources}
                  onChange={setSources}
                />
                <KindsSelect
                  label='Target'
                  kinds={ends}
                  value={targets}
                  onChange={setTargets}
                />
              </div>
              <label className='block space-y-1'>
                <span className='text-2xs font-semibold text-ink-soft'>
                  Kind of Line
                </span>
                <select
                  className={inputClass}
                  value={line}
                  onChange={(e) =>
                    setLine(e.target.value as (typeof LINES)[number])
                  }
                >
                  {LINES.map((l) => (
                    <option key={l} value={l}>
                      {l.charAt(0).toUpperCase() + l.slice(1)}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          {(error ?? (name && problem)) && (
            <p role='alert' className='text-2xs text-danger'>
              {error ?? problem}
            </p>
          )}
        </div>
        <footer className='flex justify-end gap-2 border-t border-line px-5 py-3'>
          <Button type='button' onClick={onClose}>
            Cancel
          </Button>
          <Button type='submit' variant='primary' disabled={!!problem}>
            Create
          </Button>
        </footer>
      </form>
    </div>
  );
}

function KindsSelect({
  label,
  kinds,
  value,
  onChange,
}: {
  label: string;
  kinds: readonly string[];
  value: readonly string[];
  onChange: (kinds: string[]) => void;
}) {
  return (
    <label className='block space-y-1'>
      <span className='text-2xs font-semibold text-ink-soft'>{label}</span>
      <select
        multiple
        className={cx(inputClass, 'h-24')}
        value={[...value]}
        onChange={(e) =>
          onChange([...e.target.selectedOptions].map((o) => o.value))
        }
      >
        {kinds.map((kind) => (
          <option key={kind} value={kind}>
            {kindLabel(kind)}
          </option>
        ))}
      </select>
    </label>
  );
}
