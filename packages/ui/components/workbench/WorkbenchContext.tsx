'use client';

import { useServiceDiagnostics } from '@/lib/workbench/diagnosticsStore';
import { ENGINE_LABEL, isDialectEngine } from '@/lib/workbench/engineDialects';
import type { LoggerReport } from '@goal-controller/lib';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { isPrismEngine, type TransformEngine } from '@/lib/types';
import {
  generationProblems,
  jsonProblem,
  modelLanguageProblems,
  treeProblems,
} from '@/lib/workbench/localProblems';
import type { GoalView } from '@goal-controller/goal-tree';
import {
  isDialectMode,
  parseModel,
  type DialectMode,
} from '@/lib/workbench/dialects';
import {
  isEngineMode,
  readModelMode,
  writeModelMode,
  type ModelMode,
} from '@/lib/workbench/pistar';
import {
  copyProject,
  fileStore,
  freeName,
  indexedDbHandles,
  openProject as readProject,
  opfsProjects,
  opfsStore,
  PROJECT_FILE,
  recentId,
  recordedMode,
  rememberDirectory,
  reopenDirectory,
  resourceSlots,
  saveProject,
  setSettingsInManifest,
  settingsInManifest,
  sourceLabel,
  withModelText,
  withProjectResource,
  type DirectoryHandleLike,
  type HandleStorage,
  type OpenProjectOptions,
  type Project,
  type ProjectSource,
  type ProjectStore,
  type ResourceSlot,
} from '@/lib/project';
import type { DefinitionContext } from '@goal-controller/dialect';
import {
  declarationsOf,
  parseResources,
  resourceProblems,
  resourcesContext,
  type ParsedResources,
} from '@/lib/workbench/projectResources';
import {
  checkedOptions,
  openingSettings,
  optionsFor,
  optionsToKeep,
  readModelOptions,
  withEngineOptions,
} from '@/lib/workbench/projectSettings';

/** What every project opens with: the resources its model's dialect reads. */
const PROJECT_OPTIONS: OpenProjectOptions = {
  projectResources: declarationsOf,
};

/** Where the folders a user opened are kept (IndexedDB), opened when first used. */
let handleStorage: HandleStorage | null = null;
const handles = (): HandleStorage => (handleStorage ??= indexedDbHandles());

/** What a model converts to: an engine, or a modelling dialect (piStar mode needs none). */
export type ConversionTarget = TransformEngine | DialectMode;
import { modelSignature } from '@/lib/workbench/signature';
import { analyze, transform, treeView } from '@/services';
import {
  loadPreferences,
  loadRecent,
  rememberRecent,
  savePreferences,
  forgetRecent as forgetRecentFile,
  type RecentFile,
} from '@/lib/workbench/storage';
import { mergeProblems } from '@/lib/workbench/diagnostics';
import { buildTraceIndex, type TraceIndex } from '@/lib/workbench/trace';
import {
  DEFAULT_OPTIONS,
  SOURCE,
  type AnalyzeResponse,
  type GenerationOptions,
  type ModelSettings,
  type Problem,
  type VariableInfo,
} from '@/lib/workbench/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Which part of the workbench last changed the model. */
export type ChangeSource =
  | 'open'
  | 'canvas'
  | 'source'
  | 'notation'
  | 'inspector'
  | 'undo'
  | 'restore'
  | 'convert'
  /** the model's options, written to its manifest */
  | 'settings';
/** Which part of the workbench made the selection. */
export type SelectOrigin =
  | 'canvas'
  | 'source'
  | 'notation'
  | 'output'
  | 'inspector'
  | 'problems'
  | 'variables';

/** `notation`: the whole model as the engine's notation (engines with a definition) */
export type ModelTab =
  | 'diagram'
  | 'source'
  | 'notation'
  /** a project resource's file, in its own editor */
  | `resource:${string}`;
export type OutputTab = 'output' | 'diff' | 'report';
export type BottomTab = 'problems' | 'variables' | 'model' | 'log';

export type Run = {
  id: number;
  at: number;
  engine: TransformEngine;
  durationMs: number;
  /** what the run was generated from (see inputsSignature) */
  signature: string;
  output: string | null;
  report: LoggerReport | null;
  error: string | null;
};

type VariableValues = Record<string, boolean | number>;

/** Preferences kept across reloads (the model itself is not reopened). */
type Persisted = {
  engine: TransformEngine;
  options: GenerationOptions;
  live: boolean;
  variables: VariableValues;
};

export type OpenOptions = {
  /** last exported version (a Recent entry with unsaved edits) */
  savedText?: string;
  /** settings to use instead of the current ones */
  settings?: Partial<ModelSettings>;
  /** ask for the model settings first (uploaded models) */
  setup?: boolean;
  /** where its project came from (default: a local file of that name) */
  source?: ProjectSource;
  /** a Recent entry moved aside (RecentEntry.aside) */
  aside?: number;
};
/** How a project opens; where it came from is its own. */
export type ProjectOpenOptions = Omit<OpenOptions, 'source'>;

export type Workbench = {
  // model
  fileName: string;
  text: string;
  hasModel: boolean;
  dirty: boolean;
  changeSource: ChangeSource;
  revision: number;
  /** open a project (lib/project): its model, with where it came from */
  openProject: (project: Project, how?: ProjectOpenOptions) => void;
  /** a local file (uploaded or new) as an implicit one-model project */
  openFile: (
    fileName: string,
    text: string,
    how?: ProjectOpenOptions,
  ) => Promise<void>;
  /** a Recent entry, with its edits and the settings kept with it */
  openRecent: (entry: RecentFile) => Promise<void>;
  /** where the open model's project came from (a single file: an implicit project) */
  projectSource: ProjectSource | null;
  /** the open model's Recent entry (recentId), none without a model */
  recentEntry: string | null;
  /** close the model and go back to the start screen; it stays in Recent with its edits */
  closeModel: () => void;
  setText: (text: string, source: ChangeSource) => void;
  renameFile: (fileName: string) => void;
  markSaved: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  recent: RecentFile[];
  /** `id`: the entry's recentId */
  forgetRecent: (id: string) => void;

  // the project (goal-controller#25)
  project: Project | null;
  /** a folder on disk, opened as a project (File System Access) */
  openFolder: () => Promise<void>;
  /** the resources the engine reads: where the project has each, or missing */
  resourceSlots: ResourceSlot[];
  resourceTexts: Readonly<Record<string, string>>;
  parsedResources: ParsedResources;
  /** what the language and checks get of them (none: the model alone) */
  projectResources: DefinitionContext['projectResources'];
  /** add a file to a resource kind (a read-only project becomes a browser copy) */
  addResource: (
    kind: string,
    file: { name: string; text: string },
  ) => Promise<void>;
  setResourceText: (path: string, text: string) => void;
  /** a read-only project copied to the browser, to edit it */
  copyToBrowser: () => Promise<void>;
  /** what just happened to the project (it became a browser copy) */
  resourceNotice: string | null;

  // structure
  tree: GoalView | null;
  jsonError: Problem | null;

  // engine
  engine: TransformEngine;
  engineLocked: boolean;
  setEngine: (engine: TransformEngine) => void;
  /** what the model is for: its engine, a dialect, or 'pistar' for free modelling */
  mode: ModelMode;
  /**
   * Switch the model to a mode. piStar mode is always possible; an engine goes through a
   * conversion (see `conversion`) that checks the model is valid for it first.
   */
  requestMode: (mode: ModelMode) => void;
  /** the engine recorded in the model file, if any (a piStar view of it can go straight back) */
  recordedEngine: TransformEngine | null;
  /** a conversion waiting for confirmation (ConvertDialog) */
  conversion: { target: ConversionTarget } | null;
  /** open the conversion dialog (every engine checked), `target` selected first */
  openConversion: (target: ConversionTarget) => void;
  /** apply a checked conversion: the converted model text, now for `target` */
  applyConversion: (target: ConversionTarget, text: string) => void;
  cancelConversion: () => void;
  options: GenerationOptions;
  setOptions: (patch: Partial<GenerationOptions>) => void;
  /** engine, options and live mode together */
  settings: ModelSettings;
  applySettings: (settings: ModelSettings) => void;
  /** model settings dialog: 'setup' right after a model is opened, 'edit' when asked for */
  settingsDialog: 'setup' | 'edit' | null;
  openSettings: () => void;
  closeSettings: () => void;

  // analysis & variables
  analysis: AnalyzeResponse | null;
  analyzing: boolean;
  variables: VariableInfo[];
  values: VariableValues;
  setValue: (name: string, value: boolean | number) => void;
  setValues: (values: VariableValues) => void;
  resetValues: () => void;

  // generation
  live: boolean;
  setLive: (live: boolean) => void;
  generate: () => void;
  generating: boolean;
  runs: Run[];
  current: Run | null;
  stale: boolean;
  trace: TraceIndex | null;

  // problems
  problems: Problem[];

  // selection (what is selected: useSelection) & navigation
  select: (id: string | null, origin: SelectOrigin) => void;
  modelTab: ModelTab;
  setModelTab: (tab: ModelTab) => void;
  outputTab: OutputTab;
  setOutputTab: (tab: OutputTab) => void;
  bottomTab: BottomTab;
  /** show a bottom-panel tab (opens the panel if it is collapsed) */
  setBottomTab: (tab: BottomTab) => void;
  bottomRevealSeq: number;
  /** ask the Source view to show a line (JSON problems) */
  sourceLine: { line: number; seq: number } | null;
  revealSourceLine: (line: number) => void;
};

const WorkbenchContext = createContext<Workbench | null>(null);

export const useWorkbench = (): Workbench => {
  const value = useContext(WorkbenchContext);
  if (!value)
    throw new Error('useWorkbench must be used inside <WorkbenchProvider>');
  return value;
};

/**
 * The selected node. Kept out of the workbench context so a click re-renders only
 * what shows the selection, not the whole workbench.
 */
export type Selection = {
  selected: string | null;
  selectOrigin: SelectOrigin | null;
  /** bumps on every select, also when the same node is selected again */
  selectSeq: number;
};

type SelectionActions = {
  select: (id: string | null, origin: SelectOrigin) => void;
  clearSelection: () => void;
};

const SelectionContext = createContext<Selection>({
  selected: null,
  selectOrigin: null,
  selectSeq: 0,
});
const SelectionActionsContext = createContext<SelectionActions | null>(null);

export const useSelection = (): Selection => useContext(SelectionContext);

function SelectionProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<Selection>({
    selected: null,
    selectOrigin: null,
    selectSeq: 0,
  });
  const actions = useMemo<SelectionActions>(
    () => ({
      select: (selected, selectOrigin) =>
        setSelection((prev) => ({
          selected,
          selectOrigin,
          selectSeq: prev.selectSeq + 1,
        })),
      clearSelection: () =>
        setSelection((prev) => ({
          selected: null,
          selectOrigin: null,
          selectSeq: prev.selectSeq + 1,
        })),
    }),
    [],
  );
  return (
    <SelectionActionsContext.Provider value={actions}>
      <SelectionContext.Provider value={selection}>
        {children}
      </SelectionContext.Provider>
    </SelectionActionsContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultValue = (variable: VariableInfo): boolean | number =>
  variable.kind === 'context' ? false : 0.8;

const analysisKey = (text: string, engine: TransformEngine): string =>
  `${engine}\n${text}`;

const useDebounced = <T,>(value: T, ms: number): T => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
};

const UNDO_LIMIT = 100;
const COALESCE_MS = 600;

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function WorkbenchProvider(props: {
  lockedEngine: TransformEngine | null;
  children: ReactNode;
}) {
  // the selection sits outside the workbench state: selecting does not re-render WorkbenchState
  return (
    <SelectionProvider>
      <WorkbenchState {...props} />
    </SelectionProvider>
  );
}

function WorkbenchState({
  lockedEngine,
  children,
}: {
  lockedEngine: TransformEngine | null;
  children: ReactNode;
}) {
  const selectionActions = useContext(SelectionActionsContext);
  if (!selectionActions)
    throw new Error('WorkbenchState must be inside <SelectionProvider>');
  const { select, clearSelection } = selectionActions;
  const initial = useRef<Persisted | null>(null);
  initial.current ??= loadPreferences<Persisted>();

  // ---- model (every load starts empty; earlier work is reopened from Recent) ----
  const [model, setModel] = useState(() => ({
    fileName: '',
    text: '',
    savedText: '',
    source: 'restore' as ChangeSource,
    revision: 0,
    /** where the model's project came from (Recent keeps one entry per project) */
    projectSource: null as ProjectSource | null,
    /** an edited copy moved aside in Recent (RecentEntry.aside) */
    aside: undefined as number | undefined,
  }));
  // the open model's project (lib/project): its manifest, files and resources
  const [project, setProject] = useState<Project | null>(null);
  const projectRef = useRef(project);
  projectRef.current = project;

  // ---- engine & options ----------------------------------------------------
  const [engineState, setEngineState] = useState<TransformEngine>(
    lockedEngine ?? initial.current?.engine ?? 'edgev2',
  );
  const engine = lockedEngine ?? engineState;
  const setEngine = useCallback(
    (next: TransformEngine) => setEngineState(next),
    [],
  );
  // the options that apply where the model's manifest says nothing: the ones in use
  // when it was opened, or kept with it in Recent
  const [baseOptions, setBaseOptions] = useState<GenerationOptions>({
    ...DEFAULT_OPTIONS,
    ...initial.current?.options,
  });
  const baseOptionsRef = useRef(baseOptions);
  baseOptionsRef.current = baseOptions;
  // the options the model's manifest sets (read through lib/project), and what it
  // holds that is not used
  const modelOptions = useMemo(() => {
    // a project with project.json keeps them there; a one-model project, in its model
    if (project?.form === 'file') {
      const read = settingsInManifest(
        project.manifest,
        project.models[0]?.path,
      );
      return checkedOptions({
        ...read,
        mode: read.mode ?? recordedMode(model.text),
      });
    }
    return readModelOptions(model.text);
  }, [model.text, project]);
  const options = useMemo<GenerationOptions>(
    () => ({ ...baseOptions, ...modelOptions.options }),
    [baseOptions, modelOptions],
  );
  const [live, setLive] = useState<boolean>(initial.current?.live ?? true);
  const [pistar, setPistar] = useState(false);
  // with pistar: the dialect the model is for (no engine either)
  const [dialect, setDialect] = useState<DialectMode | undefined>();
  const settings = useMemo<ModelSettings>(
    () => ({ engine, options, live, pistar, dialect }),
    [engine, options, live, pistar, dialect],
  );
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  // the workbench's own state; the model's options are in its text (applySettings)
  const adoptSettings = useCallback((next: ModelSettings) => {
    setEngineState(next.engine);
    setBaseOptions({ ...DEFAULT_OPTIONS, ...next.options });
    setLive(next.live);
    setPistar(next.pistar ?? false);
    setDialect(next.pistar ? next.dialect : undefined);
  }, []);
  const [settingsDialog, setSettingsDialog] = useState<'setup' | 'edit' | null>(
    null,
  );
  const openSettings = useCallback(() => setSettingsDialog('edit'), []);
  const closeSettings = useCallback(() => setSettingsDialog(null), []);

  const undoStack = useRef<string[]>([]);
  const redoStack = useRef<string[]>([]);
  const lastPush = useRef(0);
  const [, forceHistory] = useState(0);
  // read after loadPreferences, which may move an old autosave into Recent
  const [recent, setRecent] = useState<RecentFile[]>(() => loadRecent());

  // latest text, updated synchronously so the undo bookkeeping stays outside
  // state updaters (React may run updaters twice)
  const textRef = useRef(model.text);
  const commit = useCallback((text: string, source: ChangeSource) => {
    textRef.current = text;
    setModel((prev) => ({
      ...prev,
      text,
      source,
      revision: prev.revision + 1,
    }));
    forceHistory((n) => n + 1);
  }, []);

  const setText = useCallback(
    (text: string, source: ChangeSource) => {
      if (textRef.current === text) return;
      const now = Date.now();
      // coalesce bursts (typing, dragging) into one undo step
      if (
        now - lastPush.current > COALESCE_MS ||
        undoStack.current.length === 0
      ) {
        undoStack.current = [...undoStack.current, textRef.current].slice(
          -UNDO_LIMIT,
        );
      }
      lastPush.current = now;
      redoStack.current = [];
      commit(text, source);
    },
    [commit],
  );

  // ---- the model's options: written to its manifest (lib/project) ---------
  // an engine model's options go into its text, as an edit (undo reverts them); with
  // no model, or text that isn't JSON or isn't recorded for the engine, they stay in
  // the workbench (and in Recent)
  const writeOptions = useCallback(
    (next: GenerationOptions, ownStep: boolean) => {
      const { engine: current, pistar: viewOnly } = settingsRef.current;
      const target = lockedEngine ?? current;
      const text = textRef.current;
      const open = projectRef.current;
      if (open?.form === 'file' && !viewOnly) {
        // project.json's: written there (saved when the project's store can be)
        const manifest = setSettingsInManifest(
          open.manifest,
          open.models[0]?.path,
          { options: optionsToKeep(target, next, baseOptionsRef.current) },
        );
        setProject({ ...open, manifest });
        if (!open.store.readOnly)
          void saveProject(open, {}, manifest).catch(() => {});
        return;
      }
      if (text.trim() && !viewOnly && readModelMode(text) === target) {
        try {
          const written = withEngineOptions(
            text,
            target,
            next,
            baseOptionsRef.current,
          );
          if (ownStep) lastPush.current = 0;
          setText(written, 'settings');
          return;
        } catch {
          // not JSON: kept in the workbench
        }
      }
      setBaseOptions(next);
    },
    [lockedEngine, setText],
  );
  const setOptions = useCallback(
    (patch: Partial<GenerationOptions>) =>
      writeOptions({ ...settingsRef.current.options, ...patch }, false),
    [writeOptions],
  );
  /** the settings dialog: live and the options (one undoable edit when they change) */
  const applySettings = useCallback(
    (next: ModelSettings) => {
      const before = settingsRef.current.options;
      const options = { ...DEFAULT_OPTIONS, ...next.options };
      adoptSettings({ ...next, options: baseOptionsRef.current });
      const changed = (
        Object.keys(options) as (keyof GenerationOptions)[]
      ).some((key) => options[key] !== before[key]);
      if (changed) writeOptions(options, true);
    },
    [adoptSettings, writeOptions],
  );

  // ---- mode: engines and piStar, and conversion between them ---------------
  const recordedEngine = useMemo<TransformEngine | null>(() => {
    const recorded = readModelMode(model.text);
    return recorded && isEngineMode(recorded) ? recorded : null;
  }, [model.text]);
  const [conversion, setConversion] = useState<{
    target: ConversionTarget;
  } | null>(null);
  // a mode without an engine: piStar's, or a dialect's (with pistar set)
  const enterMode = useCallback((target: ConversionTarget | 'pistar') => {
    if (isEngineMode(target)) {
      setEngineState(target);
      setPistar(false);
      setDialect(undefined);
    } else {
      setPistar(true);
      setDialect(isDialectMode(target) ? target : undefined);
    }
  }, []);
  const requestMode = useCallback(
    (target: ModelMode) => {
      const current = settingsRef.current;
      const currentMode: ModelMode = current.pistar
        ? (current.dialect ?? 'pistar')
        : (lockedEngine ?? current.engine);
      const text = textRef.current;
      if (lockedEngine && isEngineMode(target) && target !== lockedEngine)
        return;
      const recorded = (() => {
        try {
          return readModelMode(text);
        } catch {
          return null;
        }
      })();
      if (target === currentMode) {
        // same engine: record it in a file that does not say yet
        if (target !== 'pistar' && text.trim() && recorded !== target) {
          try {
            setText(writeModelMode(text, target), 'convert');
          } catch {
            // a model that does not parse keeps its text
          }
        }
        return;
      }
      if (target === 'pistar') {
        // the piStar view of any model; the mode recorded in the file stays
        // (only the mode: options applied just before, by the settings dialog, stay)
        enterMode('pistar');
        return;
      }
      if (recorded === target) {
        // back to the engine or dialect the file is for: nothing to convert
        enterMode(target);
        return;
      }
      setConversion({ target });
    },
    [lockedEngine, setText, enterMode],
  );
  const applyConversion = useCallback(
    (target: ConversionTarget, text: string) => {
      setText(text, 'convert');
      enterMode(target);
      setConversion(null);
    },
    [setText, enterMode],
  );
  const cancelConversion = useCallback(() => setConversion(null), []);
  const openConversion = useCallback(
    (target: ConversionTarget) => setConversion({ target }),
    [],
  );

  const undo = useCallback(() => {
    const previous = undoStack.current.pop();
    if (previous === undefined) return;
    redoStack.current.push(textRef.current);
    lastPush.current = 0;
    commit(previous, 'undo');
  }, [commit]);

  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    if (next === undefined) return;
    undoStack.current.push(textRef.current);
    lastPush.current = 0;
    commit(next, 'undo');
  }, [commit]);

  // ---- navigation (the selection itself is in SelectionProvider) ----------
  const [modelTab, setModelTab] = useState<ModelTab>('diagram');
  const [outputTab, setOutputTab] = useState<OutputTab>('output');
  const [bottomTab, setBottomTabState] = useState<BottomTab>('problems');
  const [bottomRevealSeq, setBottomRevealSeq] = useState(0);
  const setBottomTab = useCallback((tab: BottomTab) => {
    setBottomTabState(tab);
    setBottomRevealSeq((n) => n + 1);
  }, []);
  const [sourceLine, setSourceLine] = useState<{
    line: number;
    seq: number;
  } | null>(null);
  const revealSourceLine = useCallback((line: number) => {
    setModelTab('source');
    setSourceLine((prev) => ({ line, seq: (prev?.seq ?? 0) + 1 }));
  }, []);

  // ---- generation state (declared early: openModel resets it) --------------
  const [runs, setRuns] = useState<Run[]>([]);

  const modelRef = useRef(model);
  modelRef.current = model;

  // ---- opening: every model opens as a project (a single file: an implicit one) ----
  /** Recent's entry for the model being left, with its latest edits (none: no model) */
  const leaving = useCallback((): Omit<RecentFile, 'at'> | null => {
    const previous = modelRef.current;
    if (!previous.text.trim()) return null;
    const fileName = previous.fileName || 'untitled.txt';
    return {
      fileName,
      text: previous.text,
      savedText: previous.savedText,
      settings: settingsRef.current,
      source: previous.projectSource ?? { kind: 'file', name: fileName },
      ...(previous.aside && { aside: previous.aside }),
    };
  }, []);

  const openModel = useCallback(
    (
      fileName: string,
      text: string,
      {
        savedText = text,
        settings: stored,
        setup = false,
        source = { kind: 'file', name: fileName },
        aside,
      }: OpenOptions = {},
    ) => {
      const left = leaving();
      if (left) rememberRecent(left);
      // the file says what it is for: its recorded engine, or (none) a piStar model;
      // live, and the options its manifest doesn't set, come from the settings kept
      // with it in Recent
      const next = openingSettings(
        readModelMode(text),
        stored,
        settingsRef.current,
      );
      adoptSettings(next);
      setSettingsDialog(setup ? 'setup' : null);
      setRecent(
        rememberRecent({
          fileName,
          text,
          savedText,
          settings: next,
          source,
          ...(aside && { aside }),
        }),
      );
      textRef.current = text;
      setModel((prev) => ({
        fileName,
        text,
        savedText,
        source: 'open',
        revision: prev.revision + 1,
        projectSource: source,
        aside,
      }));
      undoStack.current = [];
      redoStack.current = [];
      setRuns([]);
      clearSelection();
      setConversion(null);
      forceHistory((n) => n + 1);
    },
    [leaving, adoptSettings, clearSelection],
  );

  const openProject = useCallback(
    (project: Project, how: ProjectOpenOptions = {}) => {
      const [first] = project.models;
      if (!first) return;
      openModel(first.path.split('/').pop() ?? first.path, first.text, {
        ...how,
        source: project.source,
      });
      setProject(project);
    },
    [openModel],
  );
  const openFile = useCallback(
    async (fileName: string, text: string, how: ProjectOpenOptions = {}) =>
      openProject(
        await readProject(fileStore(fileName, text), PROJECT_OPTIONS),
        how,
      ),
    [openProject],
  );
  const openRecent = useCallback(
    async (entry: RecentFile) => {
      // a folder or a browser project is opened where it is (its resources with it),
      // with the model as Recent kept it; anything else from Recent's text alone
      const store =
        (entry.source?.kind === 'directory'
          ? await reopenDirectory(handles(), entry.source).catch(() => null)
          : entry.source?.kind === 'opfs'
            ? opfsStore(entry.source.name, undefined, entry.source.copyOf)
            : null) ??
        fileStore(entry.fileName, entry.text, {
          ...(entry.source && { source: entry.source }),
        });
      let project = await readProject(store, PROJECT_OPTIONS).catch(() => null);
      if (!project)
        project = await readProject(
          fileStore(entry.fileName, entry.text),
          PROJECT_OPTIONS,
        );
      const model =
        project.models.find(
          (m) => (m.path.split('/').pop() ?? m.path) === entry.fileName,
        ) ?? project.models[0];
      openProject(
        model ? withModelText(project, model.path, entry.text) : project,
        {
          savedText: entry.savedText,
          settings: entry.settings,
          ...(entry.aside && { aside: entry.aside }),
        },
      );
    },
    [openProject],
  );
  /** a folder on disk, as a project (File System Access: Chrome, Edge) */
  const openFolder = useCallback(async () => {
    const pick = (
      window as unknown as {
        showDirectoryPicker?: (options?: { mode?: string }) => Promise<unknown>;
      }
    ).showDirectoryPicker;
    if (!pick)
      throw new Error('this browser cannot open folders: try Chrome or Edge');
    const handle = (await pick({ mode: 'readwrite' })) as DirectoryHandleLike;
    const store = await rememberDirectory(handles(), handle);
    openProject(await readProject(store, PROJECT_OPTIONS));
  }, [openProject]);

  const closeModel = useCallback(() => {
    const left = leaving();
    if (left) setRecent(rememberRecent(left));
    // the start screen is not a piStar model
    adoptSettings({ ...settingsRef.current, pistar: false });
    setSettingsDialog(null);
    textRef.current = '';
    setModel((prev) => ({
      fileName: '',
      text: '',
      savedText: '',
      source: 'open',
      revision: prev.revision + 1,
      projectSource: null,
      aside: undefined,
    }));
    undoStack.current = [];
    redoStack.current = [];
    setRuns([]);
    clearSelection();
    setConversion(null);
    setProject(null);
    forceHistory((n) => n + 1);
  }, [leaving, adoptSettings, clearSelection]);

  const renameFile = useCallback((fileName: string) => {
    // the entry under the old name is replaced by the next Recent sync; a renamed
    // model (an example's too) is a local file from now on
    const { fileName: old, projectSource } = modelRef.current;
    setRecent(
      forgetRecentFile(
        recentId({
          fileName: old,
          source: projectSource ?? undefined,
          aside: modelRef.current.aside,
        }),
      ),
    );
    // a model of a project kept somewhere (a folder, the browser) stays in it
    const kept = projectRef.current && !projectRef.current.store.readOnly;
    setModel((prev) => ({
      ...prev,
      fileName,
      projectSource:
        kept && prev.projectSource
          ? prev.projectSource
          : { kind: 'file', name: fileName },
      aside: undefined,
    }));
  }, []);

  const markSaved = useCallback(() => {
    setModel((prev) => ({ ...prev, savedText: prev.text }));
  }, []);

  /** `id`: the entry's recentId */
  const forgetRecent = useCallback(
    (id: string) => setRecent(forgetRecentFile(id)),
    [],
  );

  // ---- structure -------------------------------------------------------------
  // whether the file parses: immediate, in the browser
  const parsed = useMemo(() => {
    if (!model.text.trim()) return { error: null };
    try {
      parseModel(model.text);
      return { error: null };
    } catch (error) {
      return { error: jsonProblem(model.text, error as Error) };
    }
  }, [model.text]);
  // the tree: goal-tree's view of the model, read with the engine's grammar; the last one
  // of the same file stays while the JSON is being fixed
  const [served, setServed] = useState<{
    fileName: string;
    tree: GoalView;
  } | null>(null);
  useEffect(() => {
    if (!model.text.trim() || parsed.error) return;
    const fileName = model.fileName;
    try {
      setServed({ fileName, tree: treeView(model.text, engine) });
    } catch {
      // kept: the previous view stays until the model parses again
    }
  }, [model.text, model.fileName, engine, parsed.error]);
  const tree =
    model.text.trim() && served?.fileName === model.fileName
      ? served.tree
      : null;
  const nodeIds = useMemo(
    () => new Set(tree ? [...tree.nodes.keys()] : []),
    [tree],
  );

  // ---- analysis (server, debounced) ------------------------------------------
  const debouncedText = useDebounced(model.text, 400);
  const [analyzed, setAnalyzed] = useState<{
    key: string;
    data: AnalyzeResponse;
  } | null>(null);
  const analysis = analyzed?.data ?? null;
  const setAnalysis = useCallback(
    (data: AnalyzeResponse | null, key = '') =>
      setAnalyzed(data ? { key, data } : null),
    [],
  );
  const [analyzing, setAnalyzing] = useState(false);
  useEffect(() => {
    // piStar mode has no engine to analyse for; a model just opened waits for
    // its text, not the last one's read with its engine
    if (
      pistar ||
      debouncedText !== model.text ||
      !debouncedText.trim() ||
      modelSignature(debouncedText) === null
    )
      return;
    setAnalyzing(true);
    const key = analysisKey(debouncedText, engine);
    try {
      setAnalysis(analyze(debouncedText, engine), key);
    } catch (error) {
      // keep the last variables and known properties, but always surface the failure
      setAnalyzed((prev) => ({
        key,
        data: {
          success: true,
          variables: prev?.data.variables ?? [],
          knownProperties: prev?.data.knownProperties ?? {
            goal: [],
            task: [],
            resource: [],
            quality: [],
          },
          problems: [
            {
              severity: 'error',
              source: ENGINE_LABEL[engine],
              message: error instanceof Error ? error.message : String(error),
            },
          ],
        },
      }));
    } finally {
      setAnalyzing(false);
    }
  }, [debouncedText, model.text, engine, pistar, setAnalysis]);
  useEffect(() => {
    if (!model.text.trim() || pistar) setAnalysis(null);
  }, [model.text, pistar, setAnalysis]);
  // PRISM generation needs the model's variables: until they are known the
  // engine would fill in placeholders (0.5, MISSING_VARIABLE_DEFINITION)
  const variablesReady =
    !isPrismEngine(engine) ||
    (analyzed?.key === analysisKey(model.text, engine) && !analyzing);

  // ---- variables -------------------------------------------------------------
  const variables = useMemo(
    () => (isPrismEngine(engine) ? (analysis?.variables ?? []) : []),
    [analysis, engine],
  );
  const [storedValues, setStoredValues] = useState<VariableValues>(
    initial.current?.variables ?? {},
  );
  const values = useMemo(() => {
    const result: VariableValues = {};
    for (const variable of variables) {
      const stored = storedValues[variable.name];
      result[variable.name] =
        typeof stored === (variable.kind === 'context' ? 'boolean' : 'number')
          ? (stored as boolean | number)
          : defaultValue(variable);
    }
    return result;
  }, [variables, storedValues]);
  const setValue = useCallback(
    (name: string, value: boolean | number) =>
      setStoredValues((prev) => ({ ...prev, [name]: value })),
    [],
  );
  const setValues = useCallback(
    (next: VariableValues) => setStoredValues((prev) => ({ ...prev, ...next })),
    [],
  );
  const resetValues = useCallback(() => {
    setStoredValues((prev) => {
      const next = { ...prev };
      variables.forEach((variable) => {
        next[variable.name] = defaultValue(variable);
      });
      return next;
    });
  }, [variables]);

  // ---- generation --------------------------------------------------------------
  const inputsSignature = useMemo(() => {
    const content = modelSignature(model.text);
    return content === null
      ? null
      : JSON.stringify([
          content,
          engine,
          optionsFor(engine, options),
          isPrismEngine(engine) ? values : null,
        ]);
  }, [model.text, engine, options, values]);

  const [generating, setGenerating] = useState(false);
  const runId = useRef(0);
  const latest = useRef({
    text: model.text,
    fileName: model.fileName,
    engine,
    options,
    values,
    inputsSignature,
    variablesReady,
    runs,
  });
  latest.current = {
    text: model.text,
    fileName: model.fileName,
    engine,
    options,
    values,
    inputsSignature,
    variablesReady,
    runs,
  };
  // a generation asked for before the variables were known runs once they are
  const [pendingGenerate, setPendingGenerate] = useState(false);

  const generate = useCallback(() => {
    const {
      text,
      fileName,
      engine: runEngine,
      options: runOptions,
      values: runValues,
      inputsSignature: signature,
      runs: priorRuns,
    } = latest.current;
    if (!text.trim() || signature === null) return;
    if (!latest.current.variablesReady) {
      setPendingGenerate(true);
      return;
    }
    setPendingGenerate(false);
    const started = performance.now();
    setGenerating(true);
    const previousOutput = runOptions.clean
      ? undefined
      : (priorRuns.find(
          (run) => run.engine === runEngine && run.output !== null,
        )?.output ?? undefined);
    let run: Run;
    try {
      const result = transform({
        modelJson: text,
        engine: runEngine,
        fileName: fileName.replace(/\.(txt|json)$/i, '') || 'model',
        previousOutput,
        ...optionsFor(runEngine, runOptions),
        ...(isPrismEngine(runEngine) &&
          Object.keys(runValues).length > 0 && { variables: runValues }),
      });
      runId.current += 1;
      run = {
        id: runId.current,
        at: Date.now(),
        engine: runEngine,
        durationMs: performance.now() - started,
        signature,
        output: result.output,
        report: result.report,
        error: null,
      };
    } catch (error) {
      runId.current += 1;
      run = {
        id: runId.current,
        at: Date.now(),
        engine: runEngine,
        durationMs: performance.now() - started,
        signature,
        output: null,
        report: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
    setRuns((prev) => [run, ...prev].slice(0, 20));
    setGenerating(false);
  }, []);

  useEffect(() => {
    if (pendingGenerate && variablesReady) generate();
  }, [pendingGenerate, variablesReady, generate]);

  const current = runs[0] ?? null;
  const stale = !!current && current.signature !== inputsSignature;

  // live: regenerate when what generation depends on changes
  const debouncedSignature = useDebounced(inputsSignature, 700);
  useEffect(() => {
    // a newly opened model waits for its settings
    if (
      !live ||
      pistar ||
      settingsDialog === 'setup' ||
      !variablesReady ||
      debouncedSignature === null ||
      !model.text.trim()
    )
      return;
    if (current?.signature === debouncedSignature) return;
    generate();
    // current is read for comparison only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    live,
    pistar,
    settingsDialog,
    variablesReady,
    debouncedSignature,
    generate,
  ]);

  // last successful output (a failed run keeps showing the previous output)
  const lastOutput = runs.find((run) => run.output !== null)?.output ?? null;
  const trace = useMemo(
    () => (lastOutput ? buildTraceIndex(lastOutput, nodeIds) : null),
    [lastOutput, nodeIds],
  );

  // ---- the project's resources (goal-controller#25) ------------------------------
  // the slots the engine's definition declares, in the open project
  const resourceSlotsNow = useMemo<ResourceSlot[]>(
    () =>
      project && !pistar
        ? resourceSlots(
            project.manifest,
            project.files,
            declarationsOf(engine) ?? {},
          )
        : [],
    [project, engine, pistar],
  );
  // their texts, by path: read from the project's store, then as edited
  const [resourceTexts, setResourceTexts] = useState<Record<string, string>>(
    {},
  );
  const resourceTextsRef = useRef(resourceTexts);
  resourceTextsRef.current = resourceTexts;
  // the store the texts were read from: another project starts with none of them
  const textsOf = useRef<ProjectStore | null>(null);
  useEffect(() => {
    if (!project) {
      textsOf.current = null;
      setResourceTexts({});
      return undefined;
    }
    const fresh = textsOf.current !== project.store;
    textsOf.current = project.store;
    const kept = fresh ? {} : resourceTextsRef.current;
    const missing = resourceSlotsNow
      .flatMap((slot) => slot.paths)
      .filter((path) => !(path in kept));
    if (fresh) setResourceTexts({});
    if (!missing.length) return undefined;
    let cancelled = false;
    void Promise.all(
      missing.map(
        async (path) => [path, await project.store.read(path)] as const,
      ),
    )
      .then((read) => {
        if (!cancelled)
          setResourceTexts((prev) => ({
            ...prev,
            ...Object.fromEntries(read),
          }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [project, resourceSlotsNow]);
  const parsedResources = useMemo(
    () => parseResources(engine, resourceSlotsNow, resourceTexts),
    [engine, resourceSlotsNow, resourceTexts],
  );
  // what the language and the checks get (none: the model alone, as before)
  const projectResources = useMemo(() => {
    const context = resourcesContext(parsedResources);
    return Object.keys(context).length ? context : undefined;
  }, [parsedResources]);
  const resourceProblemsNow = useMemo(
    () =>
      resourceProblems(
        parsedResources,
        declarationsOf(engine) ?? {},
        resourceTexts,
      ),
    [parsedResources, engine, resourceTexts],
  );
  const [resourceNotice, setResourceNotice] = useState<string | null>(null);

  /** the open project, with the model as it is now (its edits) */
  const currentProject = useCallback((): Project | null => {
    const open = projectRef.current;
    const [first] = open?.models ?? [];
    return open && first
      ? withModelText(open, first.path, textRef.current)
      : open;
  }, []);

  /**
   * Make the open project one that can be written: a copy in the browser
   * (OPFS) of a file or an example, with these changes; it becomes the open
   * project, labelled as a copy, and the original stays in Recent.
   */
  const toWritable = useCallback(
    async (from: Project, changes: Record<string, string>, next: Project) => {
      if (!from.store.readOnly) {
        const saved = await saveProject(next, changes, next.manifest);
        return saved;
      }
      const name = freeName(from.name, await opfsProjects().catch(() => []));
      const copy = await copyProject(
        next,
        opfsStore(name, undefined, from.source),
        changes,
        PROJECT_OPTIONS,
      );
      setResourceNotice(
        `Now ${sourceLabel(copy.source)}: the original is kept in Recent`,
      );
      return copy;
    },
    [],
  );

  const addResource = useCallback(
    async (kind: string, file: { name: string; text: string }) => {
      const open = currentProject();
      if (!open) return;
      const withDeclarations = {
        ...open,
        declarations: declarationsOf(settingsRef.current.engine) ?? {},
      };
      const { project: added, changes } = withProjectResource(
        withDeclarations,
        kind,
        file,
      );
      const left = leaving();
      const result = await toWritable(open, changes, added);
      // the original as it was left (with its edits), kept in Recent
      if (left) rememberRecent(left);
      // the resource's text, known already (read again only if the store changed)
      const resourcePath = Object.keys(changes).find(
        (path) =>
          path !== PROJECT_FILE && !result.models.some((m) => m.path === path),
      );
      textsOf.current = result.store;
      setResourceTexts((prev) => ({
        ...(result.store === open.store ? prev : {}),
        ...(resourcePath && { [resourcePath]: file.text }),
      }));
      setProject(result);
      setModel((prev) => ({
        ...prev,
        projectSource: result.source,
        aside: undefined,
      }));
      // the model's own text, promoted (its options moved to project.json)
      const [first] = result.models;
      if (first && first.text !== textRef.current)
        setText(first.text, 'settings');
    },
    [currentProject, leaving, toWritable, setText],
  );

  // a resource edited in its tab: kept, and saved where the project can be written
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setResourceText = useCallback((path: string, text: string) => {
    setResourceTexts((prev) => ({ ...prev, [path]: text }));
    const open = projectRef.current;
    if (!open || open.store.readOnly) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void open.store.write(path, text).catch(() => {});
    }, 500);
  }, []);

  /** a read-only project (a file, an example) copied to the browser, to edit its resources */
  const copyToBrowser = useCallback(async () => {
    const open = currentProject();
    if (!open || !open.store.readOnly) return;
    const left = leaving();
    const copy = await toWritable(open, resourceTextsRef.current, open);
    if (left) rememberRecent(left);
    textsOf.current = copy.store;
    setProject(copy);
    setModel((prev) => ({
      ...prev,
      projectSource: copy.source,
      aside: undefined,
    }));
  }, [currentProject, leaving, toWritable]);

  // ---- problems ----------------------------------------------------------------
  // what the language services say of the open documents (editors, fields)
  const serviceProblems = useServiceDiagnostics();
  const problems = useMemo(() => {
    const list: Problem[] = [];
    if (parsed.error) list.push(parsed.error);
    // what the model's manifest holds that is not used (its options are the file's)
    else list.push(...modelOptions.problems);
    // what is wrong in the project's resources (Model group, by the resource's label)
    list.push(...resourceProblemsNow);
    // piStar mode: only whether the file parses; the engine checks do not apply
    if (pistar) return list;
    if (tree && !parsed.error) {
      list.push(...treeProblems(tree, engine));
      // the shared language on the model's own document, editors open or not
      if (isDialectEngine(engine))
        list.push(
          ...modelLanguageProblems(engine, tree, variables, projectResources),
        );
    }
    if (analysis && !parsed.error) list.push(...analysis.problems);
    if (current && !stale) {
      const checked = new Set(
        list
          .filter(
            (p) =>
              (p.source === SOURCE.workbench || p.source === SOURCE.language) &&
              p.elementId,
          )
          .map((p) => p.elementId),
      );
      list.push(
        ...generationProblems(
          current.error,
          current.report?.log ?? null,
          nodeIds,
          ENGINE_LABEL[engine],
        ).filter(
          // the engine repeats notation problems the model check already reports
          (p) =>
            !(
              p.severity === 'warning' &&
              p.elementId &&
              checked.has(p.elementId) &&
              /notation/i.test(p.message)
            ),
        ),
      );
    }
    return mergeProblems(list, serviceProblems);
  }, [
    parsed.error,
    modelOptions,
    resourceProblemsNow,
    projectResources,
    pistar,
    tree,
    engine,
    variables,
    analysis,
    current,
    stale,
    nodeIds,
    serviceProblems,
  ]);

  // ---- persistence ----------------------------------------------------------------
  // the open model is kept in Recent (with its unsaved edits) instead of being reopened
  // model and settings debounced together, so a switch never pairs one model with another's settings
  const snapshot = useDebounced(
    useMemo(() => ({ model, settings }), [model, settings]),
    500,
  );
  useEffect(() => {
    const { fileName, text, savedText, projectSource, aside } = snapshot.model;
    if (!text.trim()) return;
    const name = fileName || 'untitled.txt';
    setRecent(
      rememberRecent({
        fileName: name,
        text,
        savedText,
        settings: snapshot.settings,
        source: projectSource ?? { kind: 'file', name },
        ...(aside && { aside }),
      }),
    );
  }, [snapshot]);

  // memoized: a new object on every render would restart the debounce and re-render
  // the whole workbench twice a second, forever
  const persisted = useDebounced<Persisted>(
    useMemo(
      () => ({ engine: engineState, options, live, variables: storedValues }),
      [engineState, options, live, storedValues],
    ),
    500,
  );
  useEffect(() => {
    savePreferences(persisted);
  }, [persisted]);

  const value: Workbench = {
    fileName: model.fileName,
    text: model.text,
    hasModel: model.text.trim().length > 0,
    dirty: model.text !== model.savedText,
    changeSource: model.source,
    revision: model.revision,
    openProject,
    openFile,
    openRecent,
    project,
    openFolder,
    resourceSlots: resourceSlotsNow,
    resourceTexts,
    parsedResources,
    projectResources,
    addResource,
    setResourceText,
    copyToBrowser,
    resourceNotice,
    projectSource: model.projectSource,
    recentEntry: model.text.trim()
      ? recentId({
          fileName: model.fileName || 'untitled.txt',
          source: model.projectSource ?? undefined,
          aside: model.aside,
        })
      : null,
    closeModel,
    setText,
    renameFile,
    markSaved,
    undo,
    redo,
    canUndo: undoStack.current.length > 0,
    canRedo: redoStack.current.length > 0,
    recent,
    forgetRecent,
    tree,
    jsonError: parsed.error,
    engine,
    engineLocked: lockedEngine !== null,
    mode: pistar ? (dialect ?? 'pistar') : engine,
    recordedEngine,
    requestMode,
    conversion,
    openConversion,
    applyConversion,
    cancelConversion,
    setEngine,
    options,
    setOptions,
    settings,
    applySettings,
    settingsDialog,
    openSettings,
    closeSettings,
    analysis,
    analyzing,
    variables,
    values,
    setValue,
    setValues,
    resetValues,
    live,
    setLive,
    generate,
    generating: generating || pendingGenerate,
    runs,
    current,
    stale,
    trace,
    problems,
    select,
    modelTab,
    setModelTab,
    outputTab,
    setOutputTab,
    bottomTab,
    setBottomTab,
    bottomRevealSeq,
    sourceLine,
    revealSourceLine,
  };

  return (
    <WorkbenchContext.Provider value={value}>
      {children}
    </WorkbenchContext.Provider>
  );
}
