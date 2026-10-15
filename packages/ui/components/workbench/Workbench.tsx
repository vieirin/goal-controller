'use client';

import {
  Lock,
  Maximize2,
  Minimize2,
  PanelBottomClose,
  PanelBottomOpen,
  PanelRightClose,
  PanelRightOpen,
  Unlock,
  Upload,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Group, Panel, Separator, usePanelRef } from 'react-resizable-panels';
import { normalizeEngineMode } from '@/lib/types';
import { useIsMobile } from '@/lib/workbench/useMediaQuery';
import { baseName, downloadText } from '@/lib/workbench/download';
import { EMPTY_PISTAR_MODEL, isEngineMode } from '@/lib/workbench/pistar';
import BottomPanel from './BottomPanel';
import Explorer from './Explorer';
import Home from './home/Home';
import { modelKindLabel } from './home/labels';
import ModelInspector from './engines/ModelInspector';
import MobileShell from './MobileShell';
import ModelSettingsModal from './ModelSettingsModal';
import ConvertDialog from './ConvertDialog';
import OutputPane from './OutputPane';
import { ModelTabView, modelTabsFor } from './modelTabs';
import TopBar, { openUpload } from './TopBar';
import {
  WorkbenchProvider,
  useSelection,
  useWorkbench,
} from './WorkbenchContext';
import { LanguageServices } from './engines/definition/LanguageServices';
import { ShellContext, useShell } from './shell';
import { IconButton, Tabs } from './ui';

const EXPLORER_KEY = 'goal-workbench:explorer-open';
const READ_ONLY_KEY = 'goal-workbench:model-read-only';

export default function Workbench() {
  const mode = normalizeEngineMode(useSearchParams().get('mode'));
  return (
    <WorkbenchProvider lockedEngine={mode}>
      <LanguageServices>
        <ShellLayout />
      </LanguageServices>
    </WorkbenchProvider>
  );
}

function ShellLayout() {
  const wb = useWorkbench();
  const [dragging, setDragging] = useState(false);
  // dragover fires every few ms while a file is over the window; when it stops
  // (the file left the window, or the drag was cancelled) the drop target goes away
  const dragTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const hideDropTarget = useCallback(() => {
    clearTimeout(dragTimer.current);
    setDragging(false);
  }, []);
  const showDropTarget = useCallback(() => {
    setDragging(true);
    clearTimeout(dragTimer.current);
    dragTimer.current = setTimeout(() => setDragging(false), 300);
  }, []);
  useEffect(() => () => clearTimeout(dragTimer.current), []);
  const explorerPanel = usePanelRef();
  const outputPanel = usePanelRef();
  const bottomPanel = usePanelRef();
  const isMobile = useIsMobile();
  // phones: the files drawer, closed after a file is opened
  const [drawerOpen, setDrawerOpen] = useState(false);
  useEffect(() => {
    setDrawerOpen(false);
  }, [wb.fileName, wb.bottomRevealSeq, wb.modelTab, wb.outputTab]);

  // left bar: the open project's files, so only while a model is open;
  // remembered, by default closed
  const [explorerOpen, setExplorerOpen] = useState<boolean>(
    () => window.localStorage.getItem(EXPLORER_KEY) === 'true',
  );
  useEffect(() => {
    if (!wb.hasModel) return;
    const frame = requestAnimationFrame(() => {
      if (explorerOpen) explorerPanel.current?.expand();
      else explorerPanel.current?.collapse();
    });
    return () => cancelAnimationFrame(frame);
    // apply the remembered state once the group has laid out it again (a model opened)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [explorerPanel, wb.hasModel]);
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

  const [modelReadOnly, setModelReadOnly] = useState(
    () => window.localStorage.getItem(READ_ONLY_KEY) === 'true',
  );
  const toggleModelReadOnly = useCallback(() => {
    setModelReadOnly((on) => {
      window.localStorage.setItem(READ_ONLY_KEY, String(!on));
      return !on;
    });
  }, []);

  // full-screen model: collapses the PRISM output and the side bar, and restores them after
  const [modelFullscreen, setModelFullscreen] = useState(false);
  const fullscreenRef = useRef(false);
  const explorerBeforeFullscreen = useRef(false);
  const setFullscreen = useCallback(
    (on: boolean) => {
      if (on === fullscreenRef.current) return;
      if (on) {
        explorerBeforeFullscreen.current = !(
          explorerPanel.current?.isCollapsed() ?? true
        );
        fullscreenRef.current = true;
        explorerPanel.current?.collapse();
        outputPanel.current?.collapse();
      } else {
        outputPanel.current?.expand();
        if (explorerBeforeFullscreen.current) explorerPanel.current?.expand();
        fullscreenRef.current = false;
      }
      setModelFullscreen(on);
    },
    [explorerPanel, outputPanel],
  );
  const toggleModelFullscreen = useCallback(() => {
    if (wb.hasModel) setFullscreen(!fullscreenRef.current);
  }, [wb.hasModel, setFullscreen]);

  // piStar mode is a model setting: the plain editor on its own (the PRISM output and
  // the side bar collapsed), whether it was chosen here, in the settings or with the file
  const pistarMode = !!wb.settings.pistar;
  // piStar mode with the recorded engine's palette (per file)
  const [enginePalette, setEnginePalette] = useState(false);
  useEffect(() => setEnginePalette(false), [wb.fileName]);
  // leaving piStar mode converts the model back to its engine (a checked step)
  const togglePistarMode = useCallback(() => {
    if (wb.hasModel)
      wb.requestMode(wb.settings.pistar ? wb.settings.engine : 'pistar');
  }, [wb]);
  const layoutFor = useRef<{ pistar: boolean; file: string } | null>(null);
  useEffect(() => {
    if (!wb.hasModel) {
      layoutFor.current = null;
      return undefined;
    }
    const last = layoutFor.current;
    layoutFor.current = { pistar: pistarMode, file: wb.fileName };
    // follow a change of mode, and open a piStar model in its layout
    if (
      last &&
      last.pistar === pistarMode &&
      (last.file === wb.fileName || !pistarMode)
    )
      return undefined;
    // after the model panels mount
    const frame = requestAnimationFrame(() => setFullscreen(pistarMode));
    return () => cancelAnimationFrame(frame);
  }, [pistarMode, wb.hasModel, wb.fileName, setFullscreen]);
  // closing the model leaves full screen (its panels are gone)
  useEffect(() => {
    if (!wb.hasModel && fullscreenRef.current) {
      fullscreenRef.current = false;
      setModelFullscreen(false);
    }
  }, [wb.hasModel]);

  // a new model is set up first, then drawn in the diagram, full screen
  const [diagramAfterSetup, setDiagramAfterSetup] = useState(false);
  const newModel = useCallback(() => {
    void wb
      .openFile('untitled.txt', EMPTY_PISTAR_MODEL, { setup: true })
      .then(() => setDiagramAfterSetup(true));
  }, [wb]);
  useEffect(() => {
    if (!diagramAfterSetup || wb.settingsDialog) return undefined;
    setDiagramAfterSetup(false);
    wb.setModelTab('diagram');
    // wait for the model panels to mount
    const frame = requestAnimationFrame(() => setFullscreen(true));
    return () => cancelAnimationFrame(frame);
  }, [diagramAfterSetup, wb, setFullscreen]);

  // keyboard shortcuts
  useEffect(() => {
    if (wb.settingsDialog || wb.conversion) return undefined;
    const exportModel = () => {
      if (!wb.hasModel) return;
      const name = /\.(txt|json)$/i.test(wb.fileName)
        ? wb.fileName
        : `${baseName(wb.fileName)}.txt`;
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
      } else if (key === 'e' && event.shiftKey) {
        event.preventDefault();
        toggleModelFullscreen();
      } else if (key === 'b') {
        event.preventDefault();
        toggleExplorer();
      } else if (key === 'z' && !inText) {
        event.preventDefault();
        if (event.shiftKey) wb.redo();
        else wb.undo();
      } else if (event.key === '1' || event.key === '2') {
        event.preventDefault();
        wb.setModelTab(event.key === '1' ? 'diagram' : 'source');
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('workbench:export-model', exportModel);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('workbench:export-model', exportModel);
    };
  }, [wb, toggleModelFullscreen, toggleExplorer]);

  if (isMobile) {
    return (
      <ShellContext.Provider
        value={{
          explorerOpen: drawerOpen,
          toggleExplorer: () => setDrawerOpen((open) => !open),
          modelFullscreen: false,
          toggleModelFullscreen: () => undefined,
          modelReadOnly,
          toggleModelReadOnly,
          pistarMode,
          togglePistarMode,
          enginePalette,
          setEnginePalette,
        }}
      >
        <MobileShell empty={<Home onNewModel={newModel} />} />
        {wb.settingsDialog && wb.hasModel && <ModelSettingsModal />}
        {wb.conversion && wb.hasModel && (
          <ConvertDialog target={wb.conversion.target} />
        )}
      </ShellContext.Provider>
    );
  }

  return (
    <ShellContext.Provider
      value={{
        explorerOpen,
        toggleExplorer,
        modelFullscreen,
        toggleModelFullscreen,
        modelReadOnly,
        toggleModelReadOnly,
        pistarMode,
        togglePistarMode,
        enginePalette,
        setEnginePalette,
      }}
    >
      <div
        className='flex h-screen flex-col bg-panel'
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes('Files')) {
            event.preventDefault();
            showDropTarget();
          }
        }}
        onDrop={async (event) => {
          event.preventDefault();
          hideDropTarget();
          const file = event.dataTransfer.files[0];
          if (file) await openUpload(wb, file);
        }}
      >
        <TopBar />
        <Group orientation='vertical' className='min-h-0 flex-1'>
          <Panel id='main' defaultSize='75%' minSize='30%'>
            <Group orientation='horizontal' className='h-full'>
              {wb.hasModel && (
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
                    // collapsing it for full screen is not a preference
                    if (!fullscreenRef.current)
                      window.localStorage.setItem(EXPLORER_KEY, String(open));
                  }}
                >
                  <Explorer />
                </Panel>
              )}
              {wb.hasModel && <Separator />}
              {wb.hasModel ? (
                <>
                  <Panel
                    id='output'
                    panelRef={outputPanel}
                    defaultSize='56%'
                    minSize='25%'
                    collapsible
                    onResize={(size) => {
                      // opening the output by hand leaves full screen
                      if (size.inPixels > 0 && fullscreenRef.current) {
                        fullscreenRef.current = false;
                        setModelFullscreen(false);
                      }
                    }}
                  >
                    <OutputPane />
                  </Panel>
                  <Separator />
                  <Panel id='model' defaultSize='44%' minSize='22%'>
                    <ModelColumn />
                  </Panel>
                </>
              ) : (
                <Panel id='empty' minSize='30%'>
                  <Home onNewModel={newModel} />
                </Panel>
              )}
            </Group>
          </Panel>
          <Separator />
          <Panel
            id='bottom'
            panelRef={bottomPanel}
            defaultSize='30%'
            minSize='160px'
            collapsible
            collapsedSize='36px'
          >
            <BottomPanel
              onToggle={() => {
                if (bottomPanel.current?.isCollapsed())
                  bottomPanel.current.expand();
                else bottomPanel.current?.collapse();
              }}
            />
          </Panel>
        </Group>
        <StatusBar />
        {dragging && (
          <div className='pointer-events-none fixed inset-2 z-50 grid place-items-center rounded-xl border-2 border-dashed border-trace bg-trace-soft/80'>
            <span className='flex items-center gap-2 text-lg font-semibold text-trace'>
              <Upload className='h-5 w-5' aria-hidden /> Drop to open the goal
              model
            </span>
          </div>
        )}
        {wb.settingsDialog && wb.hasModel && <ModelSettingsModal />}
        {wb.conversion && wb.hasModel && (
          <ConvertDialog target={wb.conversion.target} />
        )}
      </div>
    </ShellContext.Provider>
  );
}

/** Goal Model (diagram) / Source with the Inspector underneath (beside it in full screen). */
function ModelColumn() {
  const wb = useWorkbench();
  const {
    modelFullscreen,
    toggleModelFullscreen,
    modelReadOnly,
    toggleModelReadOnly,
  } = useShell();
  // piStar mode shows the editor's own inspector beside the diagram instead
  // piStar mode and the dialects carry their inspector in the diagram
  const showInspector = isEngineMode(wb.mode);
  // hidden by default; selecting a node shows it; the button toggles it
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const tabs = modelTabsFor(
    wb.mode,
    wb.engine,
    wb.resourceSlots,
    wb.openedFiles,
  );

  return (
    <section
      className='flex h-full min-h-0 flex-col bg-white'
      aria-label='Goal model'
    >
      <OpenInspectorOnSelect open={() => setInspectorOpen(true)} />
      <Tabs
        label='Model views'
        tabs={tabs}
        value={wb.modelTab}
        onChange={wb.setModelTab}
        trailing={
          <>
            <IconButton
              icon={modelReadOnly ? Lock : Unlock}
              label={
                modelReadOnly
                  ? 'Read-only: click to edit the model'
                  : 'Make the model read-only'
              }
              aria-pressed={modelReadOnly}
              onClick={toggleModelReadOnly}
            />
            {showInspector && (
              <IconButton
                icon={
                  modelFullscreen
                    ? inspectorOpen
                      ? PanelRightClose
                      : PanelRightOpen
                    : inspectorOpen
                      ? PanelBottomClose
                      : PanelBottomOpen
                }
                label={
                  inspectorOpen ? 'Hide the Inspector' : 'Show the Inspector'
                }
                aria-pressed={inspectorOpen}
                onClick={() => setInspectorOpen((open) => !open)}
              />
            )}
            <IconButton
              icon={modelFullscreen ? Minimize2 : Maximize2}
              label={
                modelFullscreen
                  ? 'Exit full screen'
                  : 'Full screen: hide the PRISM output and the side bar'
              }
              shortcut='⇧⌘E'
              aria-pressed={modelFullscreen}
              onClick={toggleModelFullscreen}
            />
          </>
        }
      />
      {/* keyed by orientation so each layout starts from its own default sizes */}
      <Group
        key={modelFullscreen ? 'side' : 'below'}
        orientation={modelFullscreen ? 'horizontal' : 'vertical'}
        className='min-h-0 flex-1'
      >
        <Panel
          id='model-view'
          defaultSize={modelFullscreen ? undefined : '58%'}
          minSize='25%'
        >
          <ModelTabView />
        </Panel>
        {showInspector && inspectorOpen && (
          <>
            <Separator />
            <Panel
              id='inspector'
              defaultSize={modelFullscreen ? '380px' : '42%'}
              minSize={modelFullscreen ? '280px' : '120px'}
            >
              <aside
                className='h-full overflow-auto bg-white'
                aria-label='Inspector'
              >
                <ModelInspector />
              </aside>
            </Panel>
          </>
        )}
      </Group>
    </section>
  );
}

/**
 * Opens the Inspector when a node is selected. A component of its own so that a
 * selection re-renders only this, not the model column around it.
 */
function OpenInspectorOnSelect({ open }: { open: () => void }) {
  const { selected, selectSeq } = useSelection();
  const latest = useRef(open);
  latest.current = open;
  useEffect(() => {
    if (selected) latest.current();
  }, [selectSeq, selected]);
  return null;
}

function StatusBar() {
  const wb = useWorkbench();
  const errors = wb.problems.filter((p) => p.severity === 'error').length;
  const warnings = wb.problems.filter((p) => p.severity === 'warning').length;
  const { selected: selectedId } = useSelection();
  const selected = selectedId ? wb.tree?.nodes.get(selectedId) : undefined;
  // what the model is for: its engine, a dialect, or piStar
  const engineLabel = modelKindLabel(wb.settings);
  return (
    <footer className='flex h-6 shrink-0 items-center gap-4 border-t border-line bg-white px-3 text-2xs text-ink-muted'>
      <span>{engineLabel}</span>
      <button
        type='button'
        onClick={() => wb.setBottomTab('problems')}
        className='hover:text-ink'
      >
        <span className={errors ? 'text-danger' : ''}>{errors} errors</span> ·{' '}
        <span className={warnings ? 'text-caution' : ''}>
          {warnings} warnings
        </span>
      </button>
      {wb.current && (
        <span>
          {wb.generating
            ? 'generating…'
            : wb.stale
              ? 'output out of date'
              : wb.current.error
                ? 'last generation failed'
                : 'output up to date'}
        </span>
      )}
      <span className='ml-auto'>
        {selected ? (
          <>
            <span className='font-mono text-ink'>{selected.id}</span>{' '}
            {selected.name}
          </>
        ) : wb.hasModel ? (
          'nothing selected'
        ) : null}
      </span>
      {wb.hasModel && (
        <span title='Reopen it from Recent after a reload'>kept in Recent</span>
      )}
    </footer>
  );
}
