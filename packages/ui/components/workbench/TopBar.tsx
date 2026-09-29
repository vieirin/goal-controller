'use client';

import {
  ArrowRightLeft,
  ChevronDown,
  Download,
  FileJson,
  FileOutput,
  FolderOpen,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Redo2,
  Settings2,
  Shapes,
  SlidersHorizontal,
  Undo2,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { isPrismEngine, type TransformEngine } from '@/lib/types';
import { baseName, downloadText } from '@/lib/workbench/download';
import type { GenerationOptions } from '@/lib/workbench/types';
import { useShell } from './shell';
import { useWorkbench } from './WorkbenchContext';
import { Button, IconButton, Kbd, Menu, MenuItem, Segmented, Switch, cx } from './ui';

const readFile = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });

export const useOpenFile = (): { open: () => void; input: ReactElement } => {
  const { openModel } = useWorkbench();
  const ref = useRef<HTMLInputElement>(null);
  const input = (
    <input
      ref={ref}
      type='file'
      accept='.txt,.json,application/json,text/plain'
      className='hidden'
      onChange={async (event) => {
        const file = event.target.files?.[0];
        if (file) openModel(file.name, await readFile(file), { setup: true });
        event.target.value = '';
      }}
    />
  );
  return { open: () => ref.current?.click(), input };
};

export { readFile };

const ENGINE_LABEL: Record<TransformEngine, string> = { edgev2: 'EdgeV2', edge: 'Edge', sleec: 'SLEEC' };

const optionsSummary = (engine: TransformEngine, wb: ReturnType<typeof useWorkbench>): string => {
  const { options } = wb;
  if (engine === 'edgev2') {
    return `N=${options.discretisation} · ${options.taskLayout === 'taskModules' ? 'task modules' : 'ChangeManager'}`;
  }
  if (engine === 'edge') return `space ${options.achievabilitySpace}`;
  return options.generateFluents ? 'with fluents' : 'no fluents';
};

/** The logo goes home: it closes the open model, after asking. */
function HomeLogo() {
  const wb = useWorkbench();
  const [confirming, setConfirming] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!confirming) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setConfirming(false);
    };
    const onPointer = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setConfirming(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, [confirming]);
  const logo = (
    <>
      goal<span className='text-trace'>·</span>wb
    </>
  );
  if (!wb.hasModel) {
    return <span className='select-none font-mono text-[13px] font-bold tracking-tight text-ink'>{logo}</span>;
  }
  return (
    <div ref={box} className='relative'>
      <button
        type='button'
        onClick={() => setConfirming((open) => !open)}
        title='Close the model and go home'
        aria-expanded={confirming}
        className='select-none rounded px-0.5 font-mono text-[13px] font-bold tracking-tight text-ink hover:bg-panel'
      >
        {logo}
      </button>
      {confirming && (
        <div
          role='alertdialog'
          aria-label='Close the model'
          className='absolute left-0 top-full z-50 mt-1.5 w-72 rounded-lg border border-line bg-white p-3 shadow-lg'
        >
          <p className='text-[13px] text-ink'>
            Close <span className='font-mono text-xs'>{wb.fileName || 'untitled.txt'}</span> and go home?
          </p>
          <p className='mt-1 text-2xs text-ink-muted'>
            It stays in Recent{wb.dirty ? ', with its unsaved edits' : ''}.
          </p>
          <div className='mt-3 flex justify-end gap-2'>
            <Button variant='outline' onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              variant='primary'
              autoFocus
              onClick={() => {
                setConfirming(false);
                wb.closeModel();
              }}
            >
              Close model
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TopBar() {
  const wb = useWorkbench();
  const shell = useShell();
  const { open, input } = useOpenFile();
  const outputExtension = isPrismEngine(wb.engine) ? 'prism' : 'sleec';
  const lastOutput = wb.runs.find((run) => run.output !== null)?.output ?? null;

  const exportModel = () => {
    const name = /\.(txt|json)$/i.test(wb.fileName) ? wb.fileName : `${baseName(wb.fileName)}.txt`;
    downloadText(name, wb.text, 'application/json');
    wb.markSaved();
  };

  return (
    <header className='flex h-12 min-w-0 shrink-0 items-center gap-2 border-b border-line bg-white px-3 xl:gap-3'>
      {input}
      <div className='flex min-w-0 items-center gap-2'>
        <IconButton
          icon={shell.explorerOpen ? PanelLeftClose : PanelLeftOpen}
          label={shell.explorerOpen ? 'Hide the side bar' : 'Show the side bar (files and examples)'}
          shortcut='⌘B'
          onClick={shell.toggleExplorer}
        />
        <HomeLogo />
        <span className='h-5 w-px bg-line' aria-hidden />
        <Button onClick={open} title='Open a goal model (piStar .txt / .json)'>
          <FolderOpen className='h-4 w-4' aria-hidden /> Open
        </Button>
        {wb.hasModel && (
          <span className='flex min-w-0 items-center gap-1.5 text-[13px]' title={wb.dirty ? 'Changed since opened or exported' : 'No unsaved changes'}>
            <span className='truncate font-medium text-ink'>{wb.fileName || 'untitled.txt'}</span>
            {wb.dirty && <span className='h-2 w-2 shrink-0 rounded-full bg-trace' aria-label='unsaved changes' />}
          </span>
        )}
        {wb.hasModel && (
          // what the model is for: its engine, or piStar for free modelling
          <button
            type='button'
            onClick={wb.openSettings}
            title={wb.mode === 'pistar' ? 'piStar model (no engine): change it in the model settings' : `Target engine: ${ENGINE_LABEL[wb.mode]} (change it in the model settings)`}
            className={cx(
              'shrink-0 rounded border px-1.5 py-0.5 text-2xs font-medium',
              wb.mode === 'pistar' ? 'border-trace/30 text-trace hover:bg-trace-soft' : 'border-line text-ink-soft hover:bg-panel',
            )}
          >
            {wb.mode === 'pistar' ? 'piStar' : ENGINE_LABEL[wb.mode]}
          </button>
        )}
        {wb.hasModel && <IconButton icon={Settings2} label='Model settings (engine and options)' onClick={wb.openSettings} />}
        {wb.hasModel && (
          <>
            <IconButton icon={Undo2} label='Undo model change' shortcut='⌘Z' onClick={wb.undo} disabled={!wb.canUndo} />
            <IconButton icon={Redo2} label='Redo model change' shortcut='⇧⌘Z' onClick={wb.redo} disabled={!wb.canRedo} />
          </>
        )}
      </div>

      {/* model controls: nothing to act on at home */}
      {wb.hasModel && (
      <div className='ml-auto flex shrink-0 items-center gap-2'>
        {wb.hasModel && (
          <Button
            variant='outline'
            onClick={shell.togglePistarMode}
            aria-pressed={shell.pistarMode}
            title={shell.pistarMode ? 'Back to the engines (generate PRISM or SLEEC)' : 'piStar mode: model freely with the plain iStar editor'}
            className={cx(shell.pistarMode && 'border-trace bg-trace-soft text-trace')}
          >
            <Shapes className='h-4 w-4' aria-hidden /> piStar
          </Button>
        )}
        {wb.hasModel && shell.pistarMode && wb.recordedEngine && (
          // the file is for an engine: model with that engine's palette, still in piStar mode
          <Switch
            checked={shell.enginePalette}
            onChange={shell.setEnginePalette}
            label={ENGINE_LABEL[wb.recordedEngine]}
            description={`Use the ${ENGINE_LABEL[wb.recordedEngine]} palette (only the elements it reads)`}
          />
        )}
        {wb.hasModel && shell.pistarMode && (
          <Button
            variant={wb.recordedEngine ? 'outline' : 'primary'}
            onClick={() => wb.openConversion(wb.recordedEngine ?? wb.settings.engine)}
            title='Convert the model to an engine: see which engines accept it'
          >
            <ArrowRightLeft className='h-4 w-4' aria-hidden /> Convert to…
          </Button>
        )}
        {/* piStar mode is the plain iStar editor: no engine to pick */}
        {!shell.pistarMode && (
          <>
            <EngineOptions />
            <span className='h-5 w-px bg-line' aria-hidden />
          </>
        )}
        {!shell.pistarMode && (
          <Switch
            checked={wb.live}
            onChange={wb.setLive}
            label='Live'
            description='Regenerate automatically after each change'
          />
        )}
        {!shell.pistarMode && (
        <Button
          variant='primary'
          onClick={wb.generate}
          disabled={!wb.hasModel || !!wb.jsonError}
          title='Generate now (⌘↵)'
          className={cx(wb.stale && !wb.generating && 'ring-2 ring-trace/40')}
        >
          {wb.generating ? <Loader2 className='h-4 w-4 animate-spin' aria-hidden /> : <Play className='h-3.5 w-3.5' aria-hidden />}
          Generate
          <span className='ml-1 hidden font-mono text-2xs text-white/60 xl:inline'>⌘↵</span>
        </Button>
        )}
        <Menu
          label='Export'
          trigger={({ toggle, open: isOpen }) => (
            <Button variant='outline' onClick={toggle} aria-expanded={isOpen} disabled={!wb.hasModel}>
              <Download className='h-4 w-4' aria-hidden /> <span className='hidden lg:inline'>Export</span>{' '}
              <ChevronDown className='h-3 w-3' aria-hidden />
            </Button>
          )}
        >
          {(close) => (
            <>
              <MenuItem icon={FileJson} hint={<Kbd>⌘S</Kbd>} onClick={() => { exportModel(); close(); }}>
                Goal model (.txt, opens in piStar)
              </MenuItem>
              <MenuItem
                icon={SlidersHorizontal}
                disabled={wb.variables.length === 0}
                onClick={() => {
                  downloadText(`${baseName(wb.fileName)}.variables.json`, JSON.stringify(wb.values, null, 2), 'application/json');
                  close();
                }}
              >
                Variables (.json)
              </MenuItem>
              <MenuItem
                icon={FileOutput}
                disabled={!lastOutput}
                onClick={() => {
                  if (lastOutput) downloadText(`${baseName(wb.fileName)}.${outputExtension}`, lastOutput);
                  close();
                }}
              >
                Generated output (.{outputExtension})
              </MenuItem>
            </>
          )}
        </Menu>
      </div>
      )}
    </header>
  );
}

export function EngineOptions() {
  const wb = useWorkbench();
  const { engine, options, setOptions } = wb;
  return (
    <Menu
      label={`${engine} options`}
      trigger={({ toggle, open }) => (
        <Button onClick={toggle} aria-expanded={open} title='Engine options'>
          <SlidersHorizontal className='h-4 w-4' aria-hidden />
          <span className='hidden font-mono text-xs text-ink-muted xl:inline'>{optionsSummary(engine, wb)}</span>
          <ChevronDown className='h-3 w-3' aria-hidden />
        </Button>
      )}
    >
      {(close) => (
        <div className='p-2'>
          <EngineOptionFields engine={engine} options={options} onChange={setOptions} />
          {wb.hasModel && (
            <button
              type='button'
              onClick={() => {
                close();
                wb.openSettings();
              }}
              className='mt-3 w-full border-t border-line pt-2 text-left text-2xs text-ink-muted hover:text-ink'
            >
              All model settings…
            </button>
          )}
        </div>
      )}
    </Menu>
  );
}

/** The options of one engine (shared by the options menu and the model settings dialog). */
export function EngineOptionFields({
  engine,
  options,
  onChange,
}: {
  engine: TransformEngine;
  options: GenerationOptions;
  onChange: (patch: Partial<GenerationOptions>) => void;
}) {
  return (
    <div className='space-y-3 text-[13px]'>
      {engine === 'edgev2' && (
        <>
          <label className='flex items-center justify-between gap-4'>
            <span>
              Discretisation <span className='font-mono'>N</span>
              <span className='block text-2xs text-ink-muted'>decisions compare achievability × N</span>
            </span>
            <input
              type='number'
              min={1}
              max={100}
              value={options.discretisation}
              onChange={(e) => {
                const n = Number.parseInt(e.target.value, 10);
                if (Number.isInteger(n) && n > 0) onChange({ discretisation: n });
              }}
              className='w-16 rounded-md border border-line-strong px-2 py-1 font-mono text-[13px]'
            />
          </label>
          <div className='space-y-1'>
            <span className='block'>Task layout</span>
            <Segmented
              size='sm'
              label='Task layout'
              value={options.taskLayout}
              onChange={(taskLayout) => onChange({ taskLayout })}
              options={[
                { id: 'taskModules', label: 'Module per task', title: 'One module per task, next to its goal (EDGE reference)' },
                { id: 'changeManager', label: 'ChangeManager', title: 'All tasks in one ChangeManager module' },
              ]}
            />
          </div>
        </>
      )}
      {engine === 'edge' && (
        <label className='flex items-center justify-between gap-4'>
          <span>
            Achievability space
            <span className='block text-2xs text-ink-muted'>levels for decision variables</span>
          </span>
          <input
            type='number'
            min={1}
            max={100}
            value={options.achievabilitySpace}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10);
              if (Number.isInteger(n) && n > 0) onChange({ achievabilitySpace: n });
            }}
            className='w-16 rounded-md border border-line-strong px-2 py-1 font-mono text-[13px]'
          />
        </label>
      )}
      {isPrismEngine(engine) && (
        <div className='flex flex-col items-start gap-2'>
          <Switch
            checked={options.generateDecisionVars}
            onChange={(generateDecisionVars) => onChange({ generateDecisionVars })}
            label='Decision variables'
          />
          <Switch checked={options.clean} onChange={(clean) => onChange({ clean })} label='Clean mode (no comments)' />
        </div>
      )}
      {engine === 'sleec' && (
        <Switch
          checked={options.generateFluents}
          onChange={(generateFluents) => onChange({ generateFluents })}
          label='Generate fluent definitions'
        />
      )}
    </div>
  );
}
