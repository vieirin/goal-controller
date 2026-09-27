'use client';

import {
  AlertTriangle,
  Download,
  FileCode2,
  FileJson,
  FolderOpen,
  GitFork,
  Loader2,
  Menu as MenuIcon,
  MoreHorizontal,
  Play,
  Redo2,
  SlidersHorizontal,
  Undo2,
  Workflow,
  X,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { isPrismEngine, type TransformEngine } from '@/lib/types';
import { baseName, downloadText } from '@/lib/workbench/download';
import { LogView, ProblemsView, VariablesView } from './BottomPanel';
import Explorer from './Explorer';
import Inspector from './Inspector';
import OutputPane from './OutputPane';
import SourceView from './SourceView';
import { EngineOptions, useOpenFile } from './TopBar';
import TreeView from './TreeView';
import { useWorkbench, type ModelTab } from './WorkbenchContext';
import { useShell } from './shell';
import { Button, IconButton, Menu, MenuItem, Segmented, Switch, Tabs, cx } from './ui';

type View = 'output' | 'model' | 'problems' | 'variables';

const ENGINES: Array<{ id: TransformEngine; label: string }> = [
  { id: 'edge', label: 'Edge' },
  { id: 'edgev2', label: 'EdgeV2' },
  { id: 'sleec', label: 'SLEEC' },
];

/**
 * Phone layout: one full-screen view at a time with a bottom navigation bar,
 * files in a drawer and the Inspector as a bottom sheet.
 */
export default function MobileShell({ empty }: { empty: ReactNode }) {
  const wb = useWorkbench();
  const shell = useShell();
  const [view, setView] = useState<View>('output');
  const [showLog, setShowLog] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  // selecting a node opens the Inspector sheet; the output's "lines" button goes to the output
  useEffect(() => {
    if (!wb.selected) {
      setSheetOpen(false);
      return;
    }
    if (wb.selectOrigin === 'inspector') {
      setSheetOpen(false);
      setView('output');
    } else if (wb.selectOrigin !== 'output') {
      setSheetOpen(true);
    }
  }, [wb.selectSeq, wb.selected, wb.selectOrigin]);

  // bottom-panel requests from elsewhere (problem counts, variable links)
  useEffect(() => {
    if (wb.bottomRevealSeq === 0) return;
    setView(wb.bottomTab === 'variables' ? 'variables' : 'problems');
    setShowLog(wb.bottomTab === 'log');
  }, [wb.bottomRevealSeq, wb.bottomTab]);

  const problems = wb.problems.filter((p) => p.severity !== 'info').length;
  const hasErrors = wb.problems.some((p) => p.severity === 'error');

  return (
    <div className='flex h-[100dvh] flex-col bg-panel'>
      <MobileTopBar />
      <main className='relative min-h-0 flex-1 bg-white'>
        {!wb.hasModel ? (
          empty
        ) : view === 'output' ? (
          <OutputPane />
        ) : view === 'model' ? (
          <MobileModel />
        ) : view === 'problems' ? (
          <div className='flex h-full flex-col'>
            <Tabs
              label='Problems and log'
              tabs={[
                { id: 'problems', label: 'Problems', count: problems, tone: hasErrors ? 'danger' : problems ? 'caution' : null },
                { id: 'log', label: 'Log' },
              ]}
              value={showLog ? 'log' : 'problems'}
              onChange={(id) => setShowLog(id === 'log')}
            />
            <div className='min-h-0 flex-1'>{showLog ? <LogView /> : <ProblemsView />}</div>
          </div>
        ) : (
          <VariablesView />
        )}
      </main>

      {wb.hasModel && (
        <nav
          className='grid shrink-0 grid-cols-4 border-t border-line bg-white pb-[env(safe-area-inset-bottom)]'
          aria-label='Views'
        >
          <NavButton icon={FileCode2} label={isPrismEngine(wb.engine) ? 'PRISM' : 'SLEEC'} active={view === 'output'} onClick={() => setView('output')} badge={wb.stale ? '•' : undefined} />
          <NavButton icon={GitFork} label='Model' active={view === 'model'} onClick={() => setView('model')} />
          <NavButton
            icon={AlertTriangle}
            label='Problems'
            active={view === 'problems'}
            onClick={() => setView('problems')}
            badge={problems ? String(problems) : undefined}
            badgeTone={hasErrors ? 'danger' : 'caution'}
          />
          <NavButton
            icon={SlidersHorizontal}
            label='Variables'
            active={view === 'variables'}
            onClick={() => setView('variables')}
            badge={wb.variables.length ? String(wb.variables.length) : undefined}
          />
        </nav>
      )}

      {/* files drawer */}
      {shell.explorerOpen && (
        <div className='fixed inset-0 z-40 flex' role='dialog' aria-modal='true' aria-label='Files'>
          <div className='flex w-[82vw] max-w-xs flex-col bg-panel shadow-xl'>
            <div className='flex h-12 items-center justify-between border-b border-line px-3'>
              <span className='text-[13px] font-semibold text-ink'>Files</span>
              <IconButton icon={X} label='Close files' onClick={shell.toggleExplorer} />
            </div>
            <div className='min-h-0 flex-1'>
              <Explorer />
            </div>
          </div>
          <button type='button' aria-label='Close files' className='flex-1 bg-ink/30' onClick={shell.toggleExplorer} />
        </div>
      )}

      {/* Inspector sheet */}
      {sheetOpen && wb.selected && (
        <div className='fixed inset-0 z-40 flex flex-col justify-end' role='dialog' aria-modal='true' aria-label='Inspector'>
          <button type='button' aria-label='Close the Inspector' className='flex-1 bg-ink/20' onClick={() => setSheetOpen(false)} />
          <div className='flex max-h-[75dvh] flex-col rounded-t-xl bg-white shadow-2xl'>
            <div className='flex items-center justify-between border-b border-line px-3 py-1.5'>
              <span className='mx-auto h-1 w-10 rounded-full bg-line-strong' aria-hidden />
              <IconButton icon={X} label='Close the Inspector' onClick={() => setSheetOpen(false)} />
            </div>
            <div className='min-h-0 flex-1 overflow-auto pb-[env(safe-area-inset-bottom)]'>
              <Inspector />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NavButton({
  icon: Icon,
  label,
  active,
  onClick,
  badge,
  badgeTone,
}: {
  icon: typeof FileJson;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: string;
  badgeTone?: 'danger' | 'caution';
}) {
  return (
    <button
      type='button'
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cx('relative flex flex-col items-center gap-0.5 py-2 text-2xs', active ? 'text-ink' : 'text-ink-muted')}
    >
      <Icon className='h-5 w-5' aria-hidden />
      {label}
      {badge && (
        <span
          className={cx(
            'absolute right-[22%] top-1 min-w-4 rounded-full px-1 text-[10px] font-semibold leading-4',
            badgeTone === 'danger' ? 'bg-danger text-white' : badgeTone === 'caution' ? 'bg-caution-soft text-caution' : 'bg-line text-ink-soft',
          )}
        >
          {badge}
        </span>
      )}
      {active && <span className='absolute inset-x-6 top-0 h-0.5 rounded-full bg-ink' />}
    </button>
  );
}

function MobileModel() {
  const wb = useWorkbench();
  const { openDiagram } = useShell();
  const tabs: Array<{ id: ModelTab; label: string }> = [
    { id: 'tree', label: 'Tree' },
    { id: 'source', label: 'Source' },
  ];
  return (
    <section className='flex h-full flex-col' aria-label='Goal model'>
      <Tabs
        label='Model views'
        tabs={tabs}
        value={wb.modelTab}
        onChange={wb.setModelTab}
        trailing={
          <Button variant='outline' onClick={openDiagram}>
            <Workflow className='h-4 w-4' aria-hidden /> Diagram
          </Button>
        }
      />
      <div className='min-h-0 flex-1'>{wb.modelTab === 'tree' ? <TreeView /> : <SourceView />}</div>
    </section>
  );
}

function MobileTopBar() {
  const wb = useWorkbench();
  const shell = useShell();
  const { open, input } = useOpenFile();
  const lastOutput = wb.runs.find((run) => run.output !== null)?.output ?? null;
  const outputExtension = isPrismEngine(wb.engine) ? 'prism' : 'sleec';
  return (
    <header className='flex h-12 shrink-0 items-center gap-1 border-b border-line bg-white px-2'>
      {input}
      <IconButton icon={MenuIcon} label='Files and examples' onClick={shell.toggleExplorer} />
      <div className='min-w-0 flex-1 px-1'>
        {wb.hasModel ? (
          <span className='flex items-center gap-1.5 text-[13px]'>
            <span className='truncate font-medium text-ink'>{wb.fileName || 'untitled.txt'}</span>
            {wb.dirty && <span className='h-2 w-2 shrink-0 rounded-full bg-trace' aria-label='unsaved changes' />}
          </span>
        ) : (
          <span className='font-mono text-[13px] font-bold text-ink'>
            goal<span className='text-trace'>·</span>wb
          </span>
        )}
      </div>
      {wb.hasModel && (
        <Button variant='primary' onClick={wb.generate} disabled={!!wb.jsonError} aria-label='Generate'>
          {wb.generating ? <Loader2 className='h-4 w-4 animate-spin' aria-hidden /> : <Play className='h-3.5 w-3.5' aria-hidden />}
        </Button>
      )}
      <Menu
        label='More'
        trigger={({ toggle, open: isOpen }) => (
          <IconButton icon={MoreHorizontal} label='More actions' aria-expanded={isOpen} onClick={toggle} />
        )}
      >
        {(close) => (
          <div className='w-[min(20rem,90vw)] space-y-2 p-1'>
            {!wb.engineLocked && (
              <div className='px-1 pt-1'>
                <Segmented label='Target engine' options={ENGINES} value={wb.engine} onChange={wb.setEngine} />
              </div>
            )}
            <div className='flex items-center justify-between px-1'>
              <Switch checked={wb.live} onChange={wb.setLive} label='Live' description='Regenerate after each change' />
              <EngineOptions />
            </div>
            <div className='border-t border-line pt-1'>
              <MenuItem icon={FolderOpen} onClick={() => { open(); close(); }}>
                Open file…
              </MenuItem>
              <MenuItem icon={Undo2} disabled={!wb.canUndo} onClick={wb.undo}>
                Undo model change
              </MenuItem>
              <MenuItem icon={Redo2} disabled={!wb.canRedo} onClick={wb.redo}>
                Redo model change
              </MenuItem>
            </div>
            {wb.hasModel && (
              <div className='border-t border-line pt-1'>
                <MenuItem
                  icon={FileJson}
                  onClick={() => {
                    const name = /\.(txt|json)$/i.test(wb.fileName) ? wb.fileName : `${baseName(wb.fileName)}.txt`;
                    downloadText(name, wb.text, 'application/json');
                    wb.markSaved();
                    close();
                  }}
                >
                  Export goal model
                </MenuItem>
                <MenuItem
                  icon={Download}
                  disabled={!lastOutput}
                  onClick={() => {
                    if (lastOutput) downloadText(`${baseName(wb.fileName)}.${outputExtension}`, lastOutput);
                    close();
                  }}
                >
                  Export output (.{outputExtension})
                </MenuItem>
              </div>
            )}
          </div>
        )}
      </Menu>
    </header>
  );
}
