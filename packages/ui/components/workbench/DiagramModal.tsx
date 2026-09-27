'use client';

import { Loader2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useWorkbench } from './WorkbenchContext';
import { Button, Kbd } from './ui';

/**
 * piStar (vendored in public/pistar, MIT) as a full-screen diagram editor.
 * Opening loads the current model; "Save and return" writes piStar's model
 * back into the workbench. The iframe is same-origin, so piStar is driven
 * through its own API: istar.fileManager.loadModel / saveModel, istar.graph
 * events, istar.paper 'change:selection', ui.selectCell.
 */

type Cell = { id: string };
type PiStarWindow = Window &
  typeof globalThis & {
    istar?: {
      fileManager?: { loadModel: (json: string) => void; saveModel: () => string };
      graph?: {
        on: (events: string, handler: (...args: unknown[]) => void) => void;
        getCell: (id: string) => Cell | undefined;
      };
      paper?: {
        on: (event: string, handler: (selection: { selectedCell?: Cell }) => void) => void;
        findViewByModel: (cell: Cell) => { el?: Element } | undefined;
      };
    };
    ui?: { selectCell: (cell: Cell) => void; selectPaper: () => void };
  };

export const EMPTY_PISTAR_MODEL = `${JSON.stringify(
  {
    actors: [],
    orphans: [],
    dependencies: [],
    links: [],
    display: {},
    tool: 'pistar.2.1.0',
    istar: '2.0',
    saveDate: '',
    diagram: { width: 2000, height: 1300, customProperties: { Description: '' } },
  },
  null,
  2,
)}\n`;

export default function DiagramModal({ onClose }: { onClose: () => void }) {
  const wb = useWorkbench();
  const frame = useRef<HTMLIFrameElement>(null);
  const saveButton = useRef<HTMLButtonElement>(null);
  const [ready, setReady] = useState(false);
  const [changed, setChanged] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const loading = useRef(true);
  const selectedIStarId = useRef<string | null>(null);
  const latest = useRef({ wb, onClose });
  latest.current = { wb, onClose };
  const changedRef = useRef(false);
  changedRef.current = changed;
  const confirmRef = useRef(false);
  confirmRef.current = confirmDiscard;

  const win = (): PiStarWindow | null => (frame.current?.contentWindow as PiStarWindow | null) ?? null;

  const save = useCallback(() => {
    const w = win();
    const { wb: current, onClose: close } = latest.current;
    if (w?.istar?.fileManager && changedRef.current) {
      // piStar logs the whole model on every save
      const log = w.console.log;
      w.console.log = () => undefined;
      try {
        current.setText(`${w.istar.fileManager.saveModel()}\n`, 'canvas');
      } finally {
        w.console.log = log;
      }
    }
    const node = selectedIStarId.current ? current.tree?.byIStarId.get(selectedIStarId.current) : undefined;
    if (node) current.select(node.id, 'canvas');
    close();
  }, []);

  const cancel = useCallback(() => {
    if (changedRef.current && !confirmRef.current) {
      setConfirmDiscard(true);
      return;
    }
    latest.current.onClose();
  }, []);

  // wait for piStar to start, then load the model into it
  const onLoad = useCallback(() => {
    let tries = 0;
    const poll = setInterval(() => {
      const w = win();
      tries += 1;
      if (tries > 200) clearInterval(poll);
      if (!w?.istar?.fileManager || !w.istar.graph || !w.istar.paper || !w.ui) return;
      clearInterval(poll);
      const link = w.document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/workbench/pistar-compact.css';
      w.document.head.appendChild(link);
      // let piStar finish loading its welcome model before replacing it
      setTimeout(() => {
        const { wb: current } = latest.current;
        w.istar!.graph!.on('add remove change', () => {
          if (!loading.current) setChanged(true);
        });
        w.istar!.paper!.on('change:selection', (selection) => {
          selectedIStarId.current = selection.selectedCell?.id ?? null;
        });
        w.document.addEventListener('keydown', (event) => {
          if ((event.metaKey || event.ctrlKey) && (event.key.toLowerCase() === 's' || event.key === 'Enter')) {
            event.preventDefault();
            save();
          }
        });
        w.istar!.fileManager!.loadModel(current.text);
        const node = current.selected ? current.tree?.nodes.get(current.selected) : undefined;
        const cell = node ? w.istar!.graph!.getCell(node.iStarId) : undefined;
        if (cell) {
          w.ui!.selectCell(cell);
          w.istar!.paper!.findViewByModel(cell)?.el?.scrollIntoView({ block: 'center', inline: 'center' });
          selectedIStarId.current = cell.id;
        } else {
          w.ui!.selectPaper();
        }
        // events fired by the load itself are not edits
        setTimeout(() => {
          loading.current = false;
        }, 100);
        setReady(true);
      }, 150);
    }, 50);
  }, [save]);

  // shortcuts while focus is outside the iframe
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && (event.key.toLowerCase() === 's' || event.key === 'Enter')) {
        event.preventDefault();
        event.stopPropagation();
        save();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [save]);

  useEffect(() => {
    saveButton.current?.focus();
  }, []);

  return (
    <div
      role='dialog'
      aria-modal='true'
      aria-label='Diagram editor'
      className='fixed inset-0 z-50 flex flex-col bg-white'
    >
      <header className='flex h-12 shrink-0 items-center gap-2 border-b border-line px-3 sm:gap-3 sm:px-4'>
        <div className='min-w-0'>
          <h2 className='truncate text-[14px] font-semibold text-ink'>
            Diagram · <span className='font-normal text-ink-soft'>{wb.fileName || 'untitled.txt'}</span>
          </h2>
          <p className='hidden text-2xs text-ink-muted sm:block'>
            {changed ? 'Unsaved diagram changes — they reach the model when you save.' : 'Edit the model with piStar; save to apply the changes.'}
          </p>
        </div>
        {confirmDiscard ? (
          <div className='ml-auto flex items-center gap-2 rounded-md bg-caution-soft px-2 py-1.5 text-[13px] text-caution sm:px-3'>
            <span className='hidden sm:inline'>Discard the changes made in the diagram?</span>
            <span className='sm:hidden'>Discard changes?</span>
            <Button variant='outline' onClick={() => setConfirmDiscard(false)}>
              Keep editing
            </Button>
            <Button variant='primary' className='bg-danger hover:bg-danger/90' onClick={onClose}>
              Discard
            </Button>
          </div>
        ) : (
          <div className='ml-auto flex items-center gap-2'>
            <Button variant='outline' onClick={cancel}>
              <X className='h-4 w-4' aria-hidden /> <span className='hidden sm:inline'>Cancel</span>
            </Button>
            <Button variant='primary' onClick={save} disabled={!ready} ref={saveButton}>
              Save<span className='hidden sm:inline'> and return</span>
              <span className='hidden sm:inline'>
                <Kbd>⌘S</Kbd>
              </span>
            </Button>
          </div>
        )}
      </header>
      <div className='relative min-h-0 flex-1'>
        <iframe
          ref={frame}
          src='/pistar/index.html'
          title='piStar diagram editor'
          onLoad={onLoad}
          className='h-full w-full border-0'
          style={{ opacity: ready ? 1 : 0 }}
        />
        {!ready && (
          <div className='absolute inset-0 grid place-items-center text-sm text-ink-muted'>
            <span className='flex items-center gap-2'>
              <Loader2 className='h-4 w-4 animate-spin' aria-hidden /> Opening the diagram editor…
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
