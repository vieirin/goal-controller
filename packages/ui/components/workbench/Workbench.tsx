'use client';

import { FilePlus2, FolderOpen, PanelBottomClose, PanelBottomOpen, Upload, Workflow } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Group, Panel, Separator, usePanelRef } from 'react-resizable-panels';
import { normalizeEngineMode } from '@/lib/types';
import { baseName, downloadText } from '@/lib/workbench/download';
import BottomPanel from './BottomPanel';
import DiagramModal, { EMPTY_PISTAR_MODEL } from './DiagramModal';
import Explorer, { useExamples, useOpenExample } from './Explorer';
import Inspector from './Inspector';
import OutputPane from './OutputPane';
import SourceView from './SourceView';
import TopBar, { readFile, useOpenFile } from './TopBar';
import TreeView from './TreeView';
import { WorkbenchProvider, useWorkbench, type ModelTab } from './WorkbenchContext';
import { ShellContext, useShell } from './shell';
import { Button, IconButton, Kbd, Tabs } from './ui';

const EXPLORER_KEY = 'goal-workbench:explorer-open';

export default function Workbench() {
  const mode = normalizeEngineMode(useSearchParams().get('mode'));
  return (
    <WorkbenchProvider lockedEngine={mode}>
      <ShellLayout />
    </WorkbenchProvider>
  );
}

function ShellLayout() {
  const wb = useWorkbench();
  const [dragging, setDragging] = useState(false);
  const [diagramOpen, setDiagramOpen] = useState(false);
  const explorerPanel = usePanelRef();
  const bottomPanel = usePanelRef();

  // left bar: remembered; by default closed while a model is open
  const [explorerOpen, setExplorerOpen] = useState<boolean>(() => {
    const stored = window.localStorage.getItem(EXPLORER_KEY);
    return stored === null ? !wb.hasModel : stored === 'true';
  });
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (explorerOpen) explorerPanel.current?.expand();
      else explorerPanel.current?.collapse();
    });
    return () => cancelAnimationFrame(frame);
    // apply the initial state once the group has laid out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [explorerPanel]);
  const toggleExplorer = useCallback(() => {
    const panel = explorerPanel.current;
    if (!panel) return;
    if (panel.isCollapsed()) panel.expand();
    else panel.collapse();
  }, [explorerPanel]);

  // the bottom panel starts as just its tab bar; asking for a tab opens it
  useEffect(() => {
    const frame = requestAnimationFrame(() => bottomPanel.current?.collapse());
    return () => cancelAnimationFrame(frame);
  }, [bottomPanel]);
  const firstReveal = useRef(true);
  useEffect(() => {
    if (firstReveal.current) {
      firstReveal.current = false;
      return;
    }
    if (bottomPanel.current?.isCollapsed()) bottomPanel.current.expand();
  }, [wb.bottomRevealSeq, bottomPanel]);

  const openDiagram = useCallback(() => {
    if (wb.hasModel) setDiagramOpen(true);
  }, [wb.hasModel]);

  // a new model starts in the diagram editor
  const newModel = useCallback(() => {
    wb.openModel('untitled.txt', EMPTY_PISTAR_MODEL);
    setDiagramOpen(true);
  }, [wb]);

  // keyboard shortcuts (the diagram editor handles its own while open)
  useEffect(() => {
    if (diagramOpen) return undefined;
    const exportModel = () => {
      if (!wb.hasModel) return;
      const name = /\.(txt|json)$/i.test(wb.fileName) ? wb.fileName : `${baseName(wb.fileName)}.txt`;
      downloadText(name, wb.text, 'application/json');
      wb.markSaved();
    };
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      const target = event.target as HTMLElement | null;
      const inText = !!target?.closest('input, textarea, .cm-editor');
      const key = event.key.toLowerCase();
      if (event.key === 'Enter') {
        event.preventDefault();
        wb.generate();
      } else if (key === 's') {
        event.preventDefault();
        exportModel();
      } else if (key === 'e') {
        event.preventDefault();
        openDiagram();
      } else if (key === 'b') {
        event.preventDefault();
        toggleExplorer();
      } else if (key === 'z' && !inText) {
        event.preventDefault();
        if (event.shiftKey) wb.redo();
        else wb.undo();
      } else if (event.key === '1' || event.key === '2') {
        event.preventDefault();
        wb.setModelTab(event.key === '1' ? 'tree' : 'source');
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('workbench:export-model', exportModel);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('workbench:export-model', exportModel);
    };
  }, [wb, diagramOpen, openDiagram, toggleExplorer]);

  return (
    <ShellContext.Provider value={{ explorerOpen, toggleExplorer, openDiagram }}>
      <div
        className='flex h-screen flex-col bg-panel'
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes('Files')) {
            event.preventDefault();
            setDragging(true);
          }
        }}
        onDragLeave={(event) => {
          if (event.currentTarget === event.target) setDragging(false);
        }}
        onDrop={async (event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files[0];
          if (file) wb.openModel(file.name, await readFile(file));
        }}
      >
        <TopBar />
        <Group orientation='vertical' className='min-h-0 flex-1'>
          <Panel id='main' defaultSize='75%' minSize='30%'>
            <Group orientation='horizontal' className='h-full'>
              <Panel
                id='explorer'
                panelRef={explorerPanel}
                defaultSize='220px'
                minSize='180px'
                maxSize='30%'
                collapsible
                onResize={(size) => {
                  const open = size.inPixels > 0;
                  setExplorerOpen(open);
                  window.localStorage.setItem(EXPLORER_KEY, String(open));
                }}
              >
                <Explorer />
              </Panel>
              <Separator />
              {wb.hasModel ? (
                <>
                  <Panel id='output' defaultSize='56%' minSize='25%'>
                    <OutputPane />
                  </Panel>
                  <Separator />
                  <Panel id='model' defaultSize='44%' minSize='22%'>
                    <ModelColumn />
                  </Panel>
                </>
              ) : (
                <Panel id='empty' minSize='30%'>
                  <EmptyState onNewModel={newModel} />
                </Panel>
              )}
            </Group>
          </Panel>
          <Separator />
          <Panel id='bottom' panelRef={bottomPanel} defaultSize='30%' minSize='160px' collapsible collapsedSize='36px'>
            <BottomPanel
              onToggle={() => {
                if (bottomPanel.current?.isCollapsed()) bottomPanel.current.expand();
                else bottomPanel.current?.collapse();
              }}
            />
          </Panel>
        </Group>
        <StatusBar />
        {dragging && (
          <div className='pointer-events-none fixed inset-2 z-50 grid place-items-center rounded-xl border-2 border-dashed border-trace bg-trace-soft/80'>
            <span className='flex items-center gap-2 text-lg font-semibold text-trace'>
              <Upload className='h-5 w-5' aria-hidden /> Drop to open the goal model
            </span>
          </div>
        )}
        {diagramOpen && <DiagramModal onClose={() => setDiagramOpen(false)} />}
      </div>
    </ShellContext.Provider>
  );
}

/** Tree / Source with the Inspector underneath. */
function ModelColumn() {
  const wb = useWorkbench();
  const { openDiagram } = useShell();
  // hidden by default; selecting a node shows it; the button toggles it
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const tabs: Array<{ id: ModelTab; label: string }> = [
    { id: 'tree', label: 'Tree' },
    { id: 'source', label: 'Source' },
  ];

  useEffect(() => {
    if (wb.selected) setInspectorOpen(true);
  }, [wb.selectSeq, wb.selected]);

  return (
    <section className='flex h-full min-h-0 flex-col bg-white' aria-label='Goal model'>
      <Tabs
        label='Model views'
        tabs={tabs}
        value={wb.modelTab}
        onChange={wb.setModelTab}
        trailing={
          <>
            <IconButton
              icon={inspectorOpen ? PanelBottomClose : PanelBottomOpen}
              label={inspectorOpen ? 'Hide the Inspector' : 'Show the Inspector'}
              aria-pressed={inspectorOpen}
              onClick={() => setInspectorOpen((open) => !open)}
            />
            <Button variant='outline' onClick={openDiagram} title='Edit the model in the diagram editor (⌘E)'>
              <Workflow className='h-4 w-4' aria-hidden /> Edit diagram
            </Button>
          </>
        }
      />
      <Group orientation='vertical' className='min-h-0 flex-1'>
        <Panel id='model-view' defaultSize='58%' minSize='25%'>
          {wb.modelTab === 'tree' ? <TreeView /> : <SourceView />}
        </Panel>
        {inspectorOpen && (
          <>
            <Separator />
            <Panel id='inspector' defaultSize='42%' minSize='120px'>
              <aside className='h-full overflow-auto bg-white' aria-label='Inspector'>
                <Inspector />
              </aside>
            </Panel>
          </>
        )}
      </Group>
    </section>
  );
}

function EmptyState({ onNewModel }: { onNewModel: () => void }) {
  const { open, input } = useOpenFile();
  const examples = useExamples();
  const openExample = useOpenExample();
  const featured = (examples.data ?? []).filter((e) => e.group === 'edgeV2').slice(0, 6);
  return (
    <section className='grid h-full place-items-center overflow-auto bg-white p-8' aria-label='Open a goal model'>
      {input}
      <div className='w-full max-w-md space-y-6'>
        <div className='space-y-1'>
          <h1 className='text-xl font-semibold text-ink'>Open a goal model</h1>
          <p className='text-[13px] text-ink-muted'>
            A piStar model (<span className='font-mono'>.txt</span> or <span className='font-mono'>.json</span>). Drop it anywhere on
            this window, open it from disk, or draw a new one in the diagram editor.
          </p>
        </div>
        <div className='flex flex-wrap gap-2'>
          <Button variant='primary' onClick={open}>
            <FolderOpen className='h-4 w-4' aria-hidden /> Open file…
          </Button>
          <Button variant='outline' onClick={onNewModel}>
            <FilePlus2 className='h-4 w-4' aria-hidden /> New model
          </Button>
        </div>
        {featured.length > 0 && (
          <div className='space-y-1.5'>
            <h2 className='text-2xs font-semibold uppercase tracking-wider text-ink-muted'>Or try an example</h2>
            <ul className='divide-y divide-line rounded-lg border border-line'>
              {featured.map((example) => (
                <li key={example.path}>
                  <button
                    type='button'
                    onClick={() => void openExample(example)}
                    className='flex w-full items-center justify-between px-3 py-2 text-left text-[13px] hover:bg-panel'
                  >
                    <span className='font-mono text-xs text-ink'>{example.name.split('/').pop()}</span>
                    <span className='text-2xs text-ink-muted'>{example.group}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className='text-2xs text-ink-muted'>
          <Kbd>⌘↵</Kbd> generate · <Kbd>⌘E</Kbd> edit diagram · <Kbd>⌘S</Kbd> export · <Kbd>⌘B</Kbd> side bar
        </p>
      </div>
    </section>
  );
}

function StatusBar() {
  const wb = useWorkbench();
  const errors = wb.problems.filter((p) => p.severity === 'error').length;
  const warnings = wb.problems.filter((p) => p.severity === 'warning').length;
  const selected = wb.selected ? wb.tree?.nodes.get(wb.selected) : undefined;
  const engineLabel = wb.engine === 'edgev2' ? 'EdgeV2' : wb.engine === 'edge' ? 'Edge' : 'SLEEC';
  return (
    <footer className='flex h-6 shrink-0 items-center gap-4 border-t border-line bg-white px-3 text-2xs text-ink-muted'>
      <span>{engineLabel}</span>
      <button type='button' onClick={() => wb.setBottomTab('problems')} className='hover:text-ink'>
        <span className={errors ? 'text-danger' : ''}>{errors} errors</span> ·{' '}
        <span className={warnings ? 'text-caution' : ''}>{warnings} warnings</span>
      </button>
      {wb.current && (
        <span>
          {wb.generating ? 'generating…' : wb.stale ? 'output out of date' : wb.current.error ? 'last generation failed' : 'output up to date'}
        </span>
      )}
      <span className='ml-auto'>
        {selected ? (
          <>
            <span className='font-mono text-ink'>{selected.id}</span> {selected.name}
          </>
        ) : wb.hasModel ? (
          'nothing selected'
        ) : null}
      </span>
      {wb.hasModel && <span>autosaved in this browser</span>}
    </footer>
  );
}
