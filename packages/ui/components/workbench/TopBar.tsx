'use client';

import {
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
  SlidersHorizontal,
  Undo2,
} from 'lucide-react';
import { useRef, type ReactElement } from 'react';
import { isPrismEngine, type TransformEngine } from '@/lib/types';
import { baseName, downloadText } from '@/lib/workbench/download';
import { useShell } from './shell';
import { useWorkbench } from './WorkbenchContext';
import { Button, IconButton, Kbd, Menu, MenuItem, Segmented, Switch, cx } from './ui';

const ENGINES: Array<{ id: TransformEngine; label: string; title: string }> = [
  { id: 'edge', label: 'Edge', title: 'Legacy Edge engine (PRISM)' },
  { id: 'edgev2', label: 'EdgeV2', title: 'EdgeV2 engine (PRISM, EDGE reference encoding)' },
  { id: 'sleec', label: 'SLEEC', title: 'SLEEC specification' },
];

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
        if (file) openModel(file.name, await readFile(file));
        event.target.value = '';
      }}
    />
  );
  return { open: () => ref.current?.click(), input };
};

export { readFile };

const optionsSummary = (engine: TransformEngine, wb: ReturnType<typeof useWorkbench>): string => {
  const { options } = wb;
  if (engine === 'edgev2') {
    return `N=${options.discretisation} · ${options.taskLayout === 'taskModules' ? 'task modules' : 'ChangeManager'}`;
  }
  if (engine === 'edge') return `space ${options.achievabilitySpace}`;
  return options.generateFluents ? 'with fluents' : 'no fluents';
};

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
        <span className='select-none font-mono text-[13px] font-bold tracking-tight text-ink'>
          goal<span className='text-trace'>·</span>wb
        </span>
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
        <IconButton icon={Undo2} label='Undo model change' shortcut='⌘Z' onClick={wb.undo} disabled={!wb.canUndo} />
        <IconButton icon={Redo2} label='Redo model change' shortcut='⇧⌘Z' onClick={wb.redo} disabled={!wb.canRedo} />
      </div>

      <div className='ml-auto flex shrink-0 items-center gap-2'>
        {!wb.engineLocked && (
          <Segmented label='Target engine' options={ENGINES} value={wb.engine} onChange={wb.setEngine} />
        )}
        <EngineOptions />
        <span className='h-5 w-px bg-line' aria-hidden />
        <Switch
          checked={wb.live}
          onChange={wb.setLive}
          label='Live'
          description='Regenerate automatically after each change'
        />
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
      {() => (
        <div className='space-y-3 p-2 text-[13px]'>
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
                    if (Number.isInteger(n) && n > 0) setOptions({ discretisation: n });
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
                  onChange={(taskLayout) => setOptions({ taskLayout })}
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
                  if (Number.isInteger(n) && n > 0) setOptions({ achievabilitySpace: n });
                }}
                className='w-16 rounded-md border border-line-strong px-2 py-1 font-mono text-[13px]'
              />
            </label>
          )}
          {isPrismEngine(engine) && (
            <div className='space-y-2'>
              <Switch
                checked={options.generateDecisionVars}
                onChange={(generateDecisionVars) => setOptions({ generateDecisionVars })}
                label='Decision variables'
              />
              <Switch checked={options.clean} onChange={(clean) => setOptions({ clean })} label='Clean mode (no comments)' />
            </div>
          )}
          {engine === 'sleec' && (
            <Switch
              checked={options.generateFluents}
              onChange={(generateFluents) => setOptions({ generateFluents })}
              label='Generate fluent definitions'
            />
          )}
        </div>
      )}
    </Menu>
  );
}
