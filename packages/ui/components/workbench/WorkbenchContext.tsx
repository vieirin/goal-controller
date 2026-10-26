'use client';

import {
  publishDiagnostics,
  useServiceDiagnostics,
} from '@/lib/workbench/diagnosticsStore';
import {
  ENGINE_ANALYSES,
  ENGINE_LABEL,
  generatesFiles,
  isDialectEngine,
} from '@/lib/workbench/engineDialects';
import type { Analysis, AnyModel, LoggerReport } from '@goal-controller/lib';
import {
  cairisEnvironmentSlug,
  dialectForModel,
  readCairis,
} from '@goal-controller/lib';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
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
import type { GoalDiagnostic, ModelStore, PistarFile } from '@istar-ts/core';
import { emptyModel, fileMetamodelForText } from '@/lib/workbench/dialects';
import {
  createModelSession,
  dispatchOrFallback,
  type ModelChanged,
  type ModelSession,
} from '@/lib/workbench/modelSession';
import { isGuardRejection } from '@/lib/workbench/guardDiagnostics';
import {
  openGlspSession,
  type GlspSession,
} from '@/lib/workbench/agent/glspSession';
import type { AgentWorkspace } from '@/lib/workbench/agent/hostTools';
import type { ActionDispatcher } from '@istar-ts/actions';
import type { IstarSurface } from '@istar-ts/react';
import { frameworkProblems } from '@/lib/workbench/frameworkProblems';
import { frameworkOfModel } from '@/lib/workbench/frameworks';
import {
  addingMismatch,
  frameworkModeOf,
  frameworkOfEntry,
  inItsFramework,
  openingMismatch,
} from '@/lib/workbench/frameworkOpen';
import type { Framework } from '@goal-controller/dialect';
import {
  FRAMEWORK_DIALECTS,
  frameworkEditorOf,
  isFrameworkMode,
  isModellingMode,
  type ModellingMode,
} from '@/lib/workbench/frameworkModes';
import {
  isEngineMode,
  isMode,
  readModelMode,
  readModelText,
  writeModelMode,
  type ModelMode,
  type ReadModelText,
} from '@/lib/workbench/pistar';
import {
  archiveBaseName,
  copyProject,
  EMBEDDED_KEY,
  exportArchive,
  fileStore,
  freeName,
  importArchive,
  importFiles,
  indexedDbHandles,
  MANIFEST_VERSION,
  memoryStore,
  modelText,
  importedProjectFiles,
  nativeProjectFiles,
  nativeSlots,
  openProject as readProject,
  opfsProjects,
  opfsStore,
  PROJECT_FILE,
  projectListing,
  readOutputs,
  recentId,
  recordedMode,
  rememberDirectory,
  reopenDirectory,
  resourceSlots,
  saveProject,
  setSettingsInManifest,
  settingsInManifest,
  sourceLabel,
  withModel,
  withModelText,
  withOutputs,
  withProjectResource,
  type DirectoryHandleLike,
  type HandleStorage,
  type ListedFile,
  type OpenProjectOptions,
  type Project,
  type ProjectSource,
  type ProjectStore,
  type NativeSlot,
  type ResourceSlot,
} from '@/lib/project';
import {
  absentProblems,
  checkNatives,
  followed,
  generateAbsent,
  inSyncNow,
  nativeDeclarationsOf,
  nativeFileOf,
  nativeProblems,
  nativeStates,
  trackingFor,
  type NativeState,
  type NativeTracking,
} from '@/lib/workbench/nativeFiles';
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
  nativeFiles: nativeDeclarationsOf,
};

/** Where the folders a user opened are kept (IndexedDB), opened when first used. */
let handleStorage: HandleStorage | null = null;
const handles = (): HandleStorage => (handleStorage ??= indexedDbHandles());

/**
 * A model file of another framework than the open project's (goal-controller#171):
 * the file, its framework, the project's, and why it can't open as it is.
 */
export type FrameworkSwitch = {
  fileName: string;
  text: string;
  framework: Framework;
  project: Framework;
  message: string;
  /**
   * how it opens once confirmed, when not as a model file in its framework:
   * a native file's project (`.kaos`, goal-controller#181)
   */
  open?: () => Promise<void>;
};

/** What a model converts to: an engine, or a modelling dialect (piStar mode needs none). */
export type ConversionTarget = TransformEngine | ModellingMode;
import { analysisKey, modelSignature } from '@/lib/workbench/signature';
import { treeView } from '@/services';
import {
  useEngineWorker,
  type EngineAnalysisOutcome,
} from '@/lib/workbench/engineWorkerClient';
import {
  loadPreferences,
  loadRecent,
  rememberRecent,
  savePreferences,
  forgetRecent as forgetRecentFile,
  type RecentFile,
} from '@/lib/workbench/storage';
import { mergeProblems } from '@/lib/workbench/diagnostics';
import { saveQueue } from '@/lib/workbench/saveQueue';
import {
  analyse,
  analysisContext,
  analysisResource,
  stepped,
  type AnalysisRun,
} from '@/lib/workbench/analysis';
import { downloadBytes } from '@/lib/workbench/download';
import type { TraceIndex } from '@/lib/workbench/trace';
import {
  activeFileOf,
  engineRuns,
  generatedFrom,
  outputsToSave,
  previousOutputOf,
  savedRun,
  traceOfFile,
  withSavedRun,
  type OutputFile,
} from '@/lib/workbench/outputs';
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
  /** what the engine made, in its order (one primary); null: it failed */
  files: OutputFile[] | null;
  report: LoggerReport | null;
  error: string | null;
  /**
   * read from the project's outputs, not generated here: what they were
   * generated from, hashed (inputsHash of a signature)
   */
  inputs?: string;
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
  /** what the model is for, when its project's manifest says (a project.json's dialect) */
  mode?: string | null;
};
/** How a project opens; where it came from is its own. */
export type ProjectOpenOptions = Omit<OpenOptions, 'source'> & {
  /** the model of the project to open, by its path (default: its first) */
  model?: string;
};

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
  /**
   * a model file opened or dropped (`.txt`, `.json`), in its framework by its
   * content (goal-controller#171): a model of another framework than the open
   * project's waits in `frameworkSwitch` for an explicit confirmation
   */
  openModelFile: (fileName: string, text: string) => Promise<void>;
  /**
   * a model file (`.txt`, `.json`) added to the open project and opened
   * (goal-controller#329): in its own framework by its content, recorded in
   * its manifest entry; refused only when it isn't in the framework it
   * declares. A read-only project becomes a browser copy. No project open: openModelFile.
   */
  addModelFile: (fileName: string, text: string) => Promise<void>;
  /** the open model's path in its project (null: no project) */
  modelPath: string | null;
  /** another model of the open project opened, in its own framework; the left one's edits stay in the project */
  openProjectModel: (path: string) => void;
  /** a model file of another framework, waiting for the switch to be confirmed */
  frameworkSwitch: FrameworkSwitch | null;
  /** open it, the project now in its framework */
  confirmFrameworkSwitch: () => Promise<void>;
  /** keep the open project; the file isn't opened */
  cancelFrameworkSwitch: () => void;
  /** a project archive (.tar.gz, .zip), copied into a new browser project (#99) */
  openArchive: (fileName: string, bytes: Uint8Array) => Promise<void>;
  /** a Recent entry, with its edits and the settings kept with it */
  openRecent: (entry: RecentFile) => Promise<void>;
  /** where the open model's project came from (a single file: an implicit project) */
  projectSource: ProjectSource | null;
  /** close the model and go back to the start screen; it stays in Recent with its edits */
  closeModel: () => void;
  /**
   * the text as the model's, shown as given at once and read into the model
   * worker's store as one undoable edit (#434: a host-side write there, not
   * an action, so a model of another metamodel can go through it, and the
   * mode's guards never reject it — #471, the import/open path); a text
   * that doesn't parse is kept, the store left as it was. The raw-text paths
   * (an import, SourceView's and `applyConversion`'s vocabulary-rejection
   * fallback) write through it (#411). `skipStore` (#439): the text is
   * shown as given (so it isn't reset under the caller), but never read
   * into the store — for a dispatch a guard rejected, whose raw text the
   * write would otherwise apply unchecked.
   */
  setText: (
    text: string,
    source: ChangeSource,
    options?: { skipStore?: boolean },
  ) => void;
  renameFile: (fileName: string) => void;
  markSaved: () => void;
  /** `glspUndo` on the dispatcher: the one undo history (#410) */
  undo: () => void;
  /** `glspRedo` on the dispatcher */
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /**
   * the open model's store and dispatcher (#410): the model is the source of
   * truth, and `text` is derived from it on every `sourceModelChanged`
   */
  session: ModelSession;
  /** the dispatcher an editor sends its actions through, tagged with its surface */
  dispatcherFor: (surface: IstarSurface) => ActionDispatcher<string, string>;
  /**
   * A headless GLSP server over the session's own store and dispatcher
   * (goal-controller#414), for M6's agent: off until turned on, so the page
   * pays nothing while it isn't needed.
   */
  glspEnabled: boolean;
  setGlspEnabled: (enabled: boolean) => void;
  /** backend A's session (goal-controller#450), once it has opened; none while it hasn't */
  glspSession: GlspSession | null;
  /** what M6's host tools read of the open project, as it is now (goal-controller#415) */
  agentWorkspace: () => AgentWorkspace;
  /**
   * The inspector's last rejected edit (a guard's diagnostics), shown next to
   * the model until dismissed or replaced by another rejection: the inspector
   * surface has no `editor.notify` of its own (`useIstarEditor`'s, the canvas
   * uses), unlike the canvas (@istar-ts/react notifies there itself) and
   * SourceView (its own inline diagnostics, goal-controller#412).
   */
  editRejected: readonly GoalDiagnostic[];
  notifyEditRejected: (diagnostics: readonly GoalDiagnostic[]) => void;
  dismissEditRejected: () => void;
  recent: RecentFile[];
  /** `id`: the entry's recentId */
  forgetRecent: (id: string) => void;

  // the project (goal-controller#25)
  project: Project | null;
  /** a folder on disk, opened as a project (File System Access) */
  openFolder: () => Promise<void>;
  /** the resources the engine reads: where the project has each, or missing */
  resourceSlots: ResourceSlot[];
  /** the open project's own files, by role (never another project's) */
  listing: ListedFile[];
  /** the project's other files open in a tab (outputs, notes) */
  openedFiles: string[];
  openProjectFile: (path: string) => void;
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
  /** the model's native files its dialect declares: where the project has each, or missing (goal-controller#143) */
  nativeSlots: NativeSlot[];
  /** each present native file: its text, and how it stands with the model */
  nativeStates: NativeState[];
  /** a native file written from the model again (it follows the model from now) */
  regenerateNative: (path: string) => void;
  /** the model read again from a native file (an edit, undoable) */
  reimportModel: (path: string) => void;
  /**
   * a native file opened: the project of it and its model, in the browser; a
   * model of another framework than the open one's (a `.kaos` over an iStar
   * model, goal-controller#181) waits in `frameworkSwitch` as a model file does
   */
  openNativeFile: (fileName: string, text: string) => Promise<void>;
  /**
   * a CAIRIS model file opened (goal-controller#192): the project of its
   * environments' KAOS models, one each, in the browser; the first opens. A
   * switch of framework waits in `frameworkSwitch`, as a native file's does
   */
  openCairisFile: (fileName: string, text: string) => Promise<void>;

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
  /** analysing for longer than expected: the worker hasn't answered yet, and isn't presumed dead */
  analysisSlow: boolean;
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
  /** the latest run with files (a failed run keeps the previous output showing) */
  lastGood: Run | null;
  stale: boolean;
  /** the output file shown (its id; null: the primary) */
  outputFile: string | null;
  setOutputFile: (id: string | null) => void;
  /** the shown output file's trace to the model (null: plain text) */
  trace: TraceIndex | null;
  /**
   * write the latest output's files into the project (out/, one manifest
   * entry each); a read-only project becomes a browser copy first
   */
  saveOutputs: () => Promise<void>;
  /**
   * download the project as a .tar.gz (#99): its manifest (a one-model
   * project's promoted to project.json), models, project resources as they
   * are now, and the latest output in out/
   */
  exportProject: () => Promise<void>;

  // analysis engines (goal-controller#107): values on the model, not a file
  /** the engine's analyses, by id (none: it has no Analyse control) */
  analyses: Readonly<Record<string, Analysis>> | null;
  /** the last analysis run, until the engine changes or it is cleared */
  analysisRun: AnalysisRun | null;
  /** whether the model changed since the run (its values are then not drawn) */
  analysisStale: boolean;
  runAnalysis: (id: string) => void;
  /** the case whose values are drawn (a strategy) */
  setAnalysisCase: (caseId: string) => void;
  /** a case run step by step: the step drawn, `delta` steps on (back when negative) */
  stepAnalysis: (delta: number) => void;
  clearAnalysis: () => void;

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
  /**
   * a range to show, in a project file's tab or in a model field (a
   * definition pool's location, goal-controller#59): its tab consumes it
   */
  revealed: RevealRequest | null;
  revealLocation: (location: {
    document: string;
    from: number;
    to: number;
  }) => void;
};

/** A range to show: a project file's path, or a model field's `model:<key>:<field>`. */
export type RevealRequest = {
  document: string;
  from: number;
  to: number;
  seq: number;
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
/** A link or an actor selected in the diagram (goal-controller#107): its piStar id. */
export type SelectedPart = { type: 'link' | 'actor'; id: string };

export type Selection = {
  selected: string | null;
  /** a link or an actor, when one is selected instead of a node */
  part: SelectedPart | null;
  selectOrigin: SelectOrigin | null;
  /** bumps on every select, also when the same node is selected again */
  selectSeq: number;
};

type SelectionActions = {
  select: (id: string | null, origin: SelectOrigin) => void;
  /** a link or an actor selected in the diagram (none: what select gives) */
  selectPart: (part: SelectedPart) => void;
  clearSelection: () => void;
};

const SelectionContext = createContext<Selection>({
  selected: null,
  part: null,
  selectOrigin: null,
  selectSeq: 0,
});
const SelectionActionsContext = createContext<SelectionActions | null>(null);

export const useSelection = (): Selection => useContext(SelectionContext);
/** Selects a link or an actor (the diagram does, goal-controller#107). */
export const useSelectPart = (): SelectionActions['selectPart'] => {
  const actions = useContext(SelectionActionsContext);
  if (!actions) throw new Error('useSelectPart outside the workbench');
  return actions.selectPart;
};

function SelectionProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<Selection>({
    selected: null,
    part: null,
    selectOrigin: null,
    selectSeq: 0,
  });
  const actions = useMemo<SelectionActions>(
    () => ({
      select: (selected, selectOrigin) =>
        setSelection((prev) => ({
          selected,
          part: null,
          selectOrigin,
          selectSeq: prev.selectSeq + 1,
        })),
      selectPart: (part) =>
        setSelection((prev) => ({
          selected: null,
          part,
          selectOrigin: 'canvas',
          selectSeq: prev.selectSeq + 1,
        })),
      clearSelection: () =>
        setSelection((prev) => ({
          selected: null,
          part: null,
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

const useDebounced = <T,>(value: T, ms: number): T => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
};

// an analysis still unanswered this long is shown as slow (goal-controller#432
// review): well past the worker's own debounce (engineWorker.ts's
// ANALYSIS_DEBOUNCE_MS). Only a worker that then doesn't answer a ping within
// ANALYSIS_UNRESPONSIVE_MS (it's single-threaded: still busy is hung) is
// restarted, and the analysis it was on fails
export const ANALYSIS_SLOW_MS = 10_000;
export const ANALYSIS_UNRESPONSIVE_MS = 50_000;
// the diagnosticsStore "service" key the engine worker's problems publish
// under (goal-controller#433): not a Problem.source (each one already
// carries its own, set by `analyze`), just this store's replace-bookkeeping
const ENGINE_DIAGNOSTICS_SERVICE = 'engine';
// the diagnosticsStore "service" key the active mode's guard report
// publishes under (goal-controller#471): same replace-bookkeeping role as
// ENGINE_DIAGNOSTICS_SERVICE, each diagnostic's own `source` ('shield') is
// what Problems groups by
const GUARD_REPORT_SERVICE = 'guard-report';

/** The store's current model, kept driftless by subscribing to it directly
 * (#449, #451 review) instead of mirroring it into a `useState` that every
 * store mutation would have to remember to update. */
const useStoreModel = (store: ModelStore<string, string>): AnyModel =>
  useSyncExternalStore(store.subscribe, store.getModel, store.getModel);

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
  // which of its models is open (goal-controller#329: a project's models may
  // be of several frameworks, each opened in its own)
  const [modelPath, setModelPath] = useState<string | null>(null);
  const modelPathRef = useRef(modelPath);
  modelPathRef.current = modelPath;
  /** the open model's path in a project: the one open, else its first */
  const openPathIn = useCallback(
    (open: Project | null): string | undefined =>
      open?.models.find((m) => m.path === modelPathRef.current)?.path ??
      open?.models[0]?.path,
    [],
  );

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
      const read = settingsInManifest(project.manifest, openPathIn(project));
      return checkedOptions({
        ...read,
        mode: read.mode ?? recordedMode(model.text),
      });
    }
    return readModelOptions(model.text);
  }, [model.text, project, openPathIn]);
  const options = useMemo<GenerationOptions>(
    () => ({ ...baseOptions, ...modelOptions.options }),
    [baseOptions, modelOptions],
  );
  const [live, setLive] = useState<boolean>(initial.current?.live ?? true);
  const [pistar, setPistar] = useState(false);
  // with pistar: the dialect the model is for (no engine either)
  const [dialect, setDialect] = useState<ModellingMode | undefined>();
  const settings = useMemo<ModelSettings>(
    () => ({ engine, options, live, pistar, dialect }),
    [engine, options, live, pistar, dialect],
  );
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  // what a model is for: an engine's rules, a dialect's, or free piStar (#412, #439)
  const mode: ModelMode = pistar ? (dialect ?? 'pistar') : engine;
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

  const [, forceHistory] = useState(0);
  // read after loadPreferences, which may move an old autosave into Recent
  const [recent, setRecent] = useState<RecentFile[]>(() => loadRecent());

  // the inspector's rejections (guards #412): no editor.notify of its own, so
  // kept here and shown next to the model until dismissed, replaced, or the
  // next successful dispatch, model switch or mode change clears it (#439)
  const [editRejected, setEditRejected] = useState<readonly GoalDiagnostic[]>(
    [],
  );
  const notifyEditRejected = useCallback(
    (diagnostics: readonly GoalDiagnostic[]) => setEditRejected(diagnostics),
    [],
  );
  const dismissEditRejected = useCallback(() => setEditRejected([]), []);

  // latest text, updated synchronously so the text and the store stay in step
  // outside state updaters (React may run updaters twice)
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

  // whether the browser's own text parses: set at each raw write (setText's
  // non-store-derived branches), not re-derived from a store-derived text,
  // which is a serialization of a model already in the store and so cannot
  // fail to parse (#451 review)
  const [jsonError, setJsonError] = useState<Problem | null>(null);
  // the last text read, and what it read (setText reads each text once)
  const lastRead = useRef<{ text: string; read: ReadModelText } | null>(null);
  const readText = useCallback((text: string): ReadModelText => {
    if (lastRead.current?.text === text) return lastRead.current.read;
    const read = readModelText(text);
    lastRead.current = { text, read };
    return read;
  }, []);

  // ---- the model: the store and dispatcher own it, the text is derived (#410) ----
  // both live in the model worker (#434): the session here is a mirror of
  // its store, and each change arrives with the text derived from it there
  // (undo and redo bring a model's text back as it was, byte for byte)
  // the dispatcher's sourceModelChanged: an edit (canvas, inspector), undo or redo
  const onModelChanged = useCallback(
    ({ action, surface, text }: ModelChanged) => {
      // a guard rejection never reaches here (the dispatcher throws before any
      // store change): every call is a successful dispatch, from any surface
      setEditRejected([]);
      // the store's own model, just serialized: it cannot fail to parse (#451 review)
      setJsonError(null);
      if (text === textRef.current) {
        forceHistory((n) => n + 1);
        return;
      }
      commit(
        text,
        action.source === 'undo' || action.source === 'redo'
          ? 'undo'
          : (surface ?? 'canvas'),
      );
    },
    [commit],
  );
  const onModelChangedRef = useRef(onModelChanged);
  onModelChangedRef.current = onModelChanged;
  // the active mode's guard diagnostics, in report mode (goal-controller#471):
  // sent after this session's model opens, and again on every mode switch
  const [guardReport, setGuardReport] = useState<readonly GoalDiagnostic[]>([]);
  const newSession = useCallback(
    (text: string, seed: AnyModel): ModelSession =>
      createModelSession(
        text,
        (change) => onModelChangedRef.current(change),
        (diagnostics) => setGuardReport(diagnostics),
        {
          seed,
          // the server's prerender has no worker to open it in
          connect: typeof window !== 'undefined',
        },
      ),
    [],
  );
  const [session, setSession] = useState(() => newSession('', emptyModel()));
  // the store's model, by identity (#449): a subscription to the session's
  // own store, so the tree and its consumers below derive from it instead of
  // re-parsing the serialized text on every edit, driftless by construction
  // (#451 review) instead of by auditing every store-mutation call site
  const storeModel = useStoreModel(session.store);
  const sessionRef = useRef(session);
  // disposes the session that's current when the provider unmounts for real.
  // Strict Mode mounts, cleans up, and remounts the same session: the
  // cleanup only *schedules* the dispose, so the second mount can cancel it
  // before the session it's about to keep using is torn down.
  const disposeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (disposeTimer.current !== null) {
      clearTimeout(disposeTimer.current);
      disposeTimer.current = null;
    }
    return () => {
      const current = sessionRef.current;
      disposeTimer.current = setTimeout(() => {
        disposeTimer.current = null;
        current.dispose();
      }, 0);
    };
  }, []);
  // the mode's own guards (oneActorOnly, the edgeV2 resource-bounds check,
  // goal-controller#412): the session's, not whichever diagram happens to be
  // mounted (the Source tab unmounts the diagram entirely, #439 review) —
  // the worker's dispatcher runs them on every dispatch, whichever surface
  // or tab made it. A function can't cross postMessage: the worker builds
  // them from the mode (`guardsForMode`, #434), sent ahead of the next action.
  useEffect(() => {
    session.setMode(mode);
  }, [session, mode]);
  // a mode change (a pistar toggle, a conversion) starts over: an edit
  // rejected under the previous mode's guards no longer applies (#439)
  useEffect(() => {
    setEditRejected([]);
  }, [mode]);
  // backend A's session over the session's own store and dispatcher (#414,
  // #450), in the model worker, for M6's agent: off until turned on (its
  // cost is then zero), rebuilt whenever the session or the mode changes,
  // and disposed when turned off or the provider unmounts.
  const [glspEnabled, setGlspEnabled] = useState(false);
  const [glspSession, setGlspSession] = useState<GlspSession | null>(null);
  // the model's view and the project's resources, for M6's host tools'
  // pool-lookup and validate-notation (goal-controller#415), which run here
  // for the worker's session: read fresh on each call, not captured by the
  // effect below (declared, each render, after the tree, the resources and
  // the variables are, further down).
  const workspaceRef = useRef<() => AgentWorkspace>(() => ({
    tree: null,
    resources: [],
    variables: [],
  }));
  const agentWorkspace = useCallback(() => workspaceRef.current(), []);
  useEffect(() => {
    if (!glspEnabled) return undefined;
    let disposed = false;
    let opened: GlspSession | null = null;
    void openGlspSession(session, mode, () => workspaceRef.current()).then(
      (started) => {
        if (disposed) {
          started.close();
          return;
        }
        opened = started;
        setGlspSession(started);
      },
    );
    return () => {
      disposed = true;
      setGlspSession(null);
      opened?.close();
    };
  }, [glspEnabled, session, mode]);
  /** a new session for an opened model (none: an empty one): its history starts empty */
  const startSession = useCallback(
    (text: string) => {
      const read = readText(text);
      sessionRef.current.dispose();
      const next = newSession(
        text,
        'model' in read ? read.model : emptyModel(),
      );
      sessionRef.current = next;
      setSession(next);
      setJsonError('error' in read ? jsonProblem(text, read.error) : null);
      setEditRejected([]);
      setGuardReport([]);
    },
    [readText, newSession],
  );

  const setText = useCallback(
    (text: string, source: ChangeSource, options?: { skipStore?: boolean }) => {
      if (textRef.current === text) return;
      if (options?.skipStore) {
        // a guard rejection, or a dispatch the vocabulary itself rejects: the
        // text is already-valid JSON (built, not typed, by every caller that
        // passes skipStore), so there is nothing here for readText to catch
        setJsonError(null);
        sessionRef.current.write(text, false);
      } else {
        const read = readText(text);
        // one undoable edit in the worker's store, the text kept as written
        // (the worker reads it again: a model can't cross postMessage, #434)
        sessionRef.current.write(text, 'model' in read);
        setJsonError('model' in read ? null : jsonProblem(text, read.error));
      }
      commit(text, source);
    },
    [commit, readText],
  );

  // ---- the model's options: written to its manifest (lib/project) ---------
  // an engine model's options go into its text, as an edit (undo reverts them); with
  // no model, or text that isn't JSON or isn't recorded for the engine, they stay in
  // the workbench (and in Recent)
  const writeOptions = useCallback(
    (next: GenerationOptions) => {
      const { engine: current, pistar: viewOnly } = settingsRef.current;
      const target = lockedEngine ?? current;
      const text = textRef.current;
      const open = projectRef.current;
      if (open?.form === 'file' && !viewOnly) {
        // project.json's: written there (saved when the project's store can be)
        const manifest = setSettingsInManifest(
          open.manifest,
          openPathIn(open),
          {
            options: optionsToKeep(target, next, baseOptionsRef.current),
          },
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
          if (written === text) return;
          // the engine options live in the model's top-level `project` key
          // (EMBEDDED_KEY), `model.extra` to istar-ts: one `istar.updateModelExtra`
          const kept = optionsToKeep(target, next, baseOptionsRef.current);
          dispatchOrFallback(
            sessionRef.current,
            'inspector',
            Object.keys(kept).length > 0
              ? {
                  kind: 'istar.updateModelExtra',
                  set: {
                    [EMBEDDED_KEY]: {
                      version: MANIFEST_VERSION,
                      options: kept,
                    },
                  },
                }
              : { kind: 'istar.updateModelExtra', remove: [EMBEDDED_KEY] },
            (_, canFallBack) =>
              setText(written, 'settings', { skipStore: !canFallBack }),
          );
          return;
        } catch {
          // not JSON: kept in the workbench
        }
      }
      setBaseOptions(next);
    },
    [lockedEngine, setText, openPathIn],
  );
  const setOptions = useCallback(
    (patch: Partial<GenerationOptions>) =>
      writeOptions({ ...settingsRef.current.options, ...patch }),
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
      if (changed) writeOptions(options);
    },
    [adoptSettings, writeOptions],
  );

  // ---- mode: engines and piStar, and conversion between them ---------------
  // the open model's own text always parses (it's the store's own
  // serialization, #449): no need for readModelMode's validity check
  const recordedEngine = useMemo<TransformEngine | null>(() => {
    const recorded = recordedMode(model.text);
    return recorded && isMode(recorded) && isEngineMode(recorded)
      ? recorded
      : null;
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
      setDialect(isModellingMode(target) ? target : undefined);
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
            const written = writeModelMode(text, target);
            const model: PistarFile = JSON.parse(written);
            dispatchOrFallback(
              sessionRef.current,
              'inspector',
              {
                kind: 'istar.replaceModel',
                model,
                fileMetamodel: fileMetamodelForText(written),
              },
              (_, canFallBack) =>
                setText(written, 'convert', { skipStore: !canFallBack }),
            );
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
      setConversion(null);
      let model: PistarFile;
      try {
        model = JSON.parse(text);
      } catch {
        // not JSON: there is nothing a guard could check (goal-controller#451 review)
        setText(text, 'convert');
        enterMode(target);
        return;
      }
      const current = settingsRef.current;
      const currentMode: ModelMode = current.pistar
        ? (current.dialect ?? 'pistar')
        : (lockedEngine ?? current.engine);
      const session = sessionRef.current;
      // the conversion is an edit (goal-controller#471): through the target
      // mode's own guards, as a dispatch under that mode would be — ahead
      // of the dispatch, so the worker checks the converted model with it
      // (`session.setMode`, not yet `enterMode`, which only runs once the
      // dispatch succeeds); a rejection sets the guards back to the mode the
      // model is staying in
      session.setMode(target);
      void session
        .dispatcherFor('inspector')
        .dispatch({
          kind: 'istar.replaceModel',
          model,
          fileMetamodel: fileMetamodelForText(text),
        })
        .then((result) => {
          if (session.disposed) return;
          if (result.ok) {
            enterMode(target);
          } else if (isGuardRejection(result.diagnostics)) {
            // the model stays as it was, in the mode it was already in
            session.setMode(currentMode);
            notifyEditRejected(result.diagnostics);
          } else {
            // the vocabulary itself rejected it, not one of our guards
            // (goal-controller#439 review): the same fallback SourceView and
            // requestMode use, applied unchecked
            setText(text, 'convert');
            enterMode(target);
          }
        });
    },
    [setText, enterMode, notifyEditRejected, lockedEngine],
  );
  const cancelConversion = useCallback(() => setConversion(null), []);
  const openConversion = useCallback(
    (target: ConversionTarget) => setConversion({ target }),
    [],
  );

  const undo = useCallback(() => {
    void sessionRef.current.dispatcher.dispatch({ kind: 'glspUndo' });
  }, []);
  const redo = useCallback(() => {
    void sessionRef.current.dispatcher.dispatch({ kind: 'glspRedo' });
  }, []);

  // ---- navigation (the selection itself is in SelectionProvider) ----------
  const [modelTab, setModelTab] = useState<ModelTab>('diagram');
  const [outputTab, setOutputTab] = useState<OutputTab>('output');
  const [outputFile, setOutputFile] = useState<string | null>(null);
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
  // the analysis run shown on the model (#107); null: none, or cleared
  const [analysisRun, setAnalysisRun] = useState<AnalysisRun | null>(null);

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
        mode,
      }: OpenOptions = {},
    ) => {
      const left = leaving();
      if (left) rememberRecent(left);
      // the file says what it is for: its recorded engine, or (none) a piStar model;
      // live, and the options its manifest doesn't set, come from the settings kept
      // with it in Recent
      const next = openingSettings(
        readModelMode(text) ?? ((mode ?? null) as ModelMode | null),
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
      // the model in the store in the same update as the mode it opens in (#419)
      startSession(text);
      setRuns([]);
      setAnalysisRun(null);
      clearSelection();
      setConversion(null);
      forceHistory((n) => n + 1);
    },
    [leaving, adoptSettings, clearSelection, startSession],
  );

  // the saved text of each model of the open project left for another (#329)
  const leftModels = useRef(new Map<string, string>());
  const openProject = useCallback(
    (project: Project, { model: path, ...how }: ProjectOpenOptions = {}) => {
      const opened =
        project.models.find((m) => m.path === path) ?? project.models[0];
      if (!opened) return;
      // a model in its own framework: what its manifest says, else its
      // framework's mode (none for iStar 2.0's) unless the file records one
      const framework = frameworkOfEntry(
        project.manifest,
        opened.path,
        opened.text,
      );
      openModel(opened.path.split('/').pop() ?? opened.path, opened.text, {
        ...how,
        source: project.source,
        mode: opened.settings.mode ?? frameworkModeOf(framework),
      });
      if (project.store !== projectRef.current?.store)
        leftModels.current.clear();
      setProject(project);
      setModelPath(opened.path);
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
  // a model file in its framework, or the switch to it waiting for a yes (#171)
  const [frameworkSwitch, setFrameworkSwitch] =
    useState<FrameworkSwitch | null>(null);
  /** the open model's own framework (its entry's: a project's models may be of several, goal-controller#329); none when nothing is open */
  const openFramework = useCallback((): Framework | undefined => {
    const current = textRef.current;
    const open = projectRef.current;
    return !current.trim()
      ? undefined
      : open
        ? frameworkOfEntry(open.manifest, openPathIn(open), current)
        : frameworkOfModel(current);
  }, [openPathIn]);
  /** Whether a model text may replace the open one; when not, the switch waits for a yes (and then `open`). */
  const mismatched = useCallback(
    (fileName: string, text: string, open?: () => Promise<void>): boolean => {
      const project = openFramework();
      const message = openingMismatch(text, project);
      if (!message) return false;
      setFrameworkSwitch({
        fileName,
        text,
        framework: frameworkOfModel(text),
        project: project!,
        message,
        ...(open && { open }),
      });
      return true;
    },
    [openFramework],
  );
  const openModelFile = useCallback(
    async (fileName: string, text: string) => {
      if (mismatched(fileName, text)) return;
      await openFile(fileName, inItsFramework(text), { setup: true });
    },
    [openFile, mismatched],
  );
  const confirmFrameworkSwitch = useCallback(async () => {
    const pending = frameworkSwitch;
    setFrameworkSwitch(null);
    if (pending?.open) await pending.open();
    else if (pending)
      await openFile(pending.fileName, inItsFramework(pending.text), {
        setup: true,
      });
  }, [frameworkSwitch, openFile]);
  const cancelFrameworkSwitch = useCallback(() => setFrameworkSwitch(null), []);
  const openArchive = useCallback(
    async (fileName: string, bytes: Uint8Array) => {
      const name = freeName(
        archiveBaseName(fileName),
        await opfsProjects().catch(() => []),
      );
      const store = await importArchive(bytes, name);
      openProject(await readProject(store, PROJECT_OPTIONS), { setup: true });
    },
    [openProject],
  );
  const openNativeFile = useCallback(
    async (fileName: string, text: string) => {
      const found = nativeFileOf(fileName);
      if (!found) throw new Error(`${fileName}: no dialect's native file`);
      const read = found.file.read(text, { modelName: found.baseName });
      if (!read.model)
        throw new Error(
          `Not a model ${found.file.label} reads: ${
            read.diagnostics
              .filter((d) => d.severity === 'error')
              .map((d) => d.message)
              .join('; ') || 'no reason given'
          }`,
        );
      const { files, model } = nativeProjectFiles(fileName, text, found, read);
      const open = async () => {
        // kept in the browser; where it has no private file system, in memory
        const store = await opfsProjects()
          .then((taken) => importFiles(files, freeName(found.baseName, taken)))
          .catch(() => memoryStore(files, { kind: 'file', name: fileName }));
        openProject(await readProject(store, PROJECT_OPTIONS), {
          setup: true,
        });
      };
      // a model of another framework than the open one's waits for a yes (#171, #181)
      if (mismatched(fileName, files[model]!, open)) return;
      await open();
    },
    [openProject, mismatched],
  );
  const openCairisFile = useCallback(
    async (fileName: string, text: string) => {
      const baseName = fileName.replace(/\.[^.]*$/, '') || fileName;
      const { models, diagnostics } = readCairis(text, {
        modelName: baseName,
      });
      const read = models.flatMap(({ environment, result }) =>
        result.model
          ? [
              {
                path: `${baseName}-${cairisEnvironmentSlug(environment)}.txt`,
                model: result,
              },
            ]
          : [],
      );
      if (!read.length)
        throw new Error(
          `Not a model CAIRIS's importer reads: ${
            diagnostics
              .filter((d) => d.severity === 'error')
              .map((d) => d.message)
              .join('; ') || 'no environment'
          }`,
        );
      // its mode's native files (kaosprop's `.kaos`) are not the source's: none
      const { files, first } = importedProjectFiles(
        read,
        'kaos',
        Object.keys(
          nativeDeclarationsOf(read[0]!.model.dialectRecord.engine) ?? {},
        ),
      );
      const open = async () => {
        // kept in the browser; where it has no private file system, in memory
        const store = await opfsProjects()
          .then((taken) => importFiles(files, freeName(baseName, taken)))
          .catch(() => memoryStore(files, { kind: 'file', name: fileName }));
        openProject(await readProject(store, PROJECT_OPTIONS), {
          setup: true,
          model: first,
        });
      };
      // a KAOS model over another framework's waits for a yes (#171)
      if (mismatched(fileName, files[first]!, open)) return;
      await open();
    },
    [openProject, mismatched],
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
          // the entry's model of the project, not its first (#329)
          ...(model && { model: model.path }),
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
    startSession('');
    setRuns([]);
    setAnalysisRun(null);
    clearSelection();
    setConversion(null);
    setProject(null);
    setModelPath(null);
    forceHistory((n) => n + 1);
  }, [leaving, adoptSettings, clearSelection, startSession]);

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
  // the tree: goal-tree's view of the store's model (#449), read with the
  // engine's grammar; the last one of the same file stays while the JSON is
  // being fixed (the store keeps its last valid model, so this comes free)
  const [served, setServed] = useState<{
    fileName: string;
    tree: GoalView;
  } | null>(null);
  useEffect(() => {
    if (!model.text.trim() || jsonError) return;
    const fileName = model.fileName;
    setServed({ fileName, tree: treeView(storeModel, engine) });
  }, [storeModel, model.text, model.fileName, engine, jsonError]);
  const tree =
    model.text.trim() && served?.fileName === model.fileName
      ? served.tree
      : null;
  const nodeIds = useMemo(
    () => new Set(tree ? [...tree.nodes.keys()] : []),
    [tree],
  );

  // ---- analysis (engine worker, #413) ----------------------------------------
  // the worker holds a mirror of the model and reruns analysis on its own,
  // debounced the way the inline call used to be; this thread only reads
  // what it posts back
  const [analyzed, setAnalyzed] = useState<{
    key: string;
    data: AnalyzeResponse;
  } | null>(null);
  const analysis = analyzed?.data ?? null;
  const currentAnalysisKey = useMemo(
    () => analysisKey(model.text, engine),
    [model.text, engine],
  );
  // a crash belongs to the analysis this thread is waiting for: read at the
  // moment it lands, not when the callback was bound
  const awaitedKey = useRef(currentAnalysisKey);
  useEffect(() => {
    awaitedKey.current = currentAnalysisKey;
  }, [currentAnalysisKey]);
  // the only writer of `analyzed` (goal-controller#432 review): a worker
  // result, a worker failure, a worker crash, or no model to analyse. So
  // `analyzing`/`variablesReady` only ever move on one of those, never on a
  // timer. A failure keeps the last variables and known properties, but
  // always surfaces itself
  const applyAnalysisOutcome = useCallback(
    (outcome: EngineAnalysisOutcome | { readonly kind: 'cleared' }) => {
      if (outcome.kind === 'cleared') {
        setAnalyzed(null);
        return;
      }
      if (outcome.kind === 'analyzed') {
        setAnalyzed({ key: outcome.key, data: outcome.data });
        return;
      }
      const key = outcome.kind === 'failed' ? outcome.key : awaitedKey.current;
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
              message: outcome.message,
            },
          ],
        },
      }));
    },
    [engine],
  );
  const engineWorker = useEngineWorker(
    session.serve,
    engine,
    pistar,
    applyAnalysisOutcome,
  );
  useEffect(() => {
    if (!model.text.trim() || pistar) applyAnalysisOutcome({ kind: 'cleared' });
  }, [model.text, pistar, applyAnalysisOutcome]);
  // true from the moment the text changes until the worker catches up to it
  // (its key, by content: the worker's own serialization never matches
  // `model.text` byte for byte, see `analysisKey`)
  const analyzing =
    !pistar &&
    !jsonError &&
    !!model.text.trim() &&
    analyzed?.key !== currentAnalysisKey;
  // an analysis past ANALYSIS_SLOW_MS is only reported as slow: the worker is
  // asked for a pong, and only one that never comes (a hung worker, not a
  // busy one) goes down the crash path, which ends this analysis as a failure
  const [slowKey, setSlowKey] = useState<string | null>(null);
  const { probe } = engineWorker;
  useEffect(() => {
    if (!analyzing) return undefined;
    const key = currentAnalysisKey;
    const timer = setTimeout(() => {
      setSlowKey(key);
      probe(ANALYSIS_UNRESPONSIVE_MS);
    }, ANALYSIS_SLOW_MS);
    return () => clearTimeout(timer);
  }, [analyzing, currentAnalysisKey, probe]);
  const analysisSlow = analyzing && slowKey === currentAnalysisKey;
  // PRISM generation needs the model's variables: until they are known the
  // engine would fill in placeholders (0.5, MISSING_VARIABLE_DEFINITION)
  const variablesReady =
    !isPrismEngine(engine) ||
    (analyzed?.key === currentAnalysisKey && !analyzing);

  // ---- the project's resources (goal-controller#25) ------------------------------
  // the slots the engine's definition declares, in the open project
  // (in piStar mode no engine reads any: the files its manifest lists are still shown)
  const resourceSlotsNow = useMemo<ResourceSlot[]>(
    () =>
      project
        ? resourceSlots(
            project.manifest,
            project.files,
            (!pistar && declarationsOf(engine)) || {},
          )
        : [],
    [project, engine, pistar],
  );
  // the model's native files (goal-controller#143), by the engine's dialect
  const nativeSlotsNow = useMemo<NativeSlot[]>(
    () =>
      project
        ? nativeSlots(
            project.manifest,
            project.files,
            project.models.map((m) => m.path),
            (!pistar && nativeDeclarationsOf(engine)) || {},
          )
        : [],
    [project, engine, pistar],
  );
  // the open project's own files, by role: what the Explorer lists (never the examples)
  const listing = useMemo<ListedFile[]>(
    () =>
      project
        ? projectListing(
            project.manifest,
            project.files,
            resourceSlotsNow,
            project.models.map((m) => m.path),
            nativeSlotsNow,
          )
        : [],
    [project, resourceSlotsNow, nativeSlotsNow],
  );
  // the project's other files opened in a tab (outputs, notes), besides its resources'
  const [openedFiles, setOpenedFiles] = useState<string[]>([]);
  // their texts, by path: read from the project's store, then as edited
  const [resourceTexts, setResourceTexts] = useState<Record<string, string>>(
    {},
  );
  const resourceTextsRef = useRef(resourceTexts);
  resourceTextsRef.current = resourceTexts;
  // the store each text was read from (or written to): another project's
  // texts stay in state until its own are read
  const textStore = useRef(new Map<string, ProjectStore>());
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
    const missing = [
      ...resourceSlotsNow.flatMap((slot) => slot.paths),
      ...nativeSlotsNow.flatMap((slot) => (slot.missing ? [] : [slot.path])),
      ...(fresh ? [] : openedFiles),
    ].filter((path) => !(path in kept));
    if (fresh) {
      setResourceTexts({});
      setOpenedFiles([]);
    }
    if (!missing.length) return undefined;
    let cancelled = false;
    void Promise.all(
      missing.map(
        async (path) => [path, await project.store.read(path)] as const,
      ),
    )
      .then((read) => {
        if (cancelled) return;
        for (const [path] of read) textStore.current.set(path, project.store);
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
  }, [project, resourceSlotsNow, nativeSlotsNow, openedFiles]);
  /** one of the project's files in its tab (read when first opened) */
  const openProjectFile = useCallback(
    (path: string) => {
      if (
        !resourceSlotsNow.some((slot) => slot.paths.includes(path)) &&
        !nativeSlotsNow.some((slot) => !slot.missing && slot.path === path)
      )
        setOpenedFiles((prev) =>
          prev.includes(path) ? prev : [...prev, path],
        );
      setModelTab(`resource:${path}`);
    },
    [resourceSlotsNow, nativeSlotsNow],
  );
  const [revealed, setRevealed] = useState<RevealRequest | null>(null);
  /** a model field's range in the Notation view (its element selected), or a file's in its tab */
  const revealLocation = useCallback(
    (location: { document: string; from: number; to: number }) => {
      const element = /^model:(.*):[^:]*$/.exec(location.document)?.[1];
      if (element !== undefined) {
        setModelTab('notation');
        select(element, 'problems');
      } else openProjectFile(location.document);
      setRevealed((prev) => ({ ...location, seq: (prev?.seq ?? 0) + 1 }));
    },
    [openProjectFile, select],
  );
  const parsedResources = useMemo(
    () =>
      pistar ? {} : parseResources(engine, resourceSlotsNow, resourceTexts),
    [engine, pistar, resourceSlotsNow, resourceTexts],
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
    const path = openPathIn(open);
    return open && path !== undefined
      ? withModelText(open, path, textRef.current)
      : open;
  }, [openPathIn]);

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

  /**
   * Write changes to the open project (a read-only one becomes a browser
   * copy) and make the result the open project.
   */
  const writeProject = useCallback(
    async (open: Project, changes: Record<string, string>, next: Project) => {
      const left = leaving();
      const result = await toWritable(open, changes, next);
      // the original as it was left (with its edits), kept in Recent
      if (left) rememberRecent(left);
      // the files written, known already (the rest read again only if the store changed)
      const written = Object.entries(changes).filter(
        ([path]) =>
          path !== PROJECT_FILE && !result.models.some((m) => m.path === path),
      );
      textsOf.current = result.store;
      for (const [path] of written) textStore.current.set(path, result.store);
      for (const path of Object.keys(resourceTextsRef.current))
        if (result.store !== open.store) textStore.current.delete(path);
      setResourceTexts((prev) => ({
        ...(result.store === open.store ? prev : {}),
        ...Object.fromEntries(written),
      }));
      setProject(result);
      setModel((prev) => ({
        ...prev,
        projectSource: result.source,
        aside: undefined,
      }));
      // the model's own text, promoted (its options moved to project.json)
      const opened = result.models.find((m) => m.path === openPathIn(result));
      if (opened && opened.text !== textRef.current)
        setText(opened.text, 'settings');
      return result;
    },
    [leaving, toWritable, setText, openPathIn],
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
      await writeProject(open, changes, added);
    },
    [currentProject, writeProject],
  );

  /** another model of the open project, in its own framework (goal-controller#329) */
  const openProjectModel = useCallback(
    (path: string) => {
      const open = currentProject();
      const left = openPathIn(open);
      if (!open || path === left) return;
      if (left !== undefined)
        leftModels.current.set(left, modelRef.current.savedText);
      openProject(open, {
        model: path,
        ...(leftModels.current.has(path) && {
          savedText: leftModels.current.get(path),
        }),
      });
    },
    [currentProject, openPathIn, openProject],
  );
  // a model file added to the project, in its own framework, then opened (#329)
  const addModelFile = useCallback(
    async (fileName: string, text: string) => {
      const open = currentProject();
      if (!open) return openModelFile(fileName, text);
      const opened = inItsFramework(text);
      const mismatch = addingMismatch(opened);
      if (mismatch) throw new Error(`${fileName}: ${mismatch}`);
      const { project: added, changes } = withModel(
        open,
        { name: fileName, text: opened },
        frameworkOfModel(opened),
      );
      const path = added.models[added.models.length - 1]!.path;
      const result = await writeProject(open, changes, added);
      const left = openPathIn(result);
      const { savedText } = modelRef.current;
      openProject(result, { model: path, setup: true });
      if (left !== undefined) leftModels.current.set(left, savedText);
    },
    [currentProject, openModelFile, writeProject, openPathIn, openProject],
  );

  // a resource edited in its tab: kept, and saved where the project can be written
  // one timer per file: an edit of several files at once saves each
  const saves = useRef(saveQueue());
  const setResourceText = useCallback((path: string, text: string) => {
    setResourceTexts((prev) => ({ ...prev, [path]: text }));
    const open = projectRef.current;
    if (open) textStore.current.set(path, open.store);
    if (!open || open.store.readOnly) return;
    saves.current.schedule(path, () => {
      void open.store.write(path, text).catch(() => {});
    });
  }, []);

  /** a read-only project (a file, an example) copied to the browser, to edit its resources */
  const copyToBrowser = useCallback(async () => {
    const open = currentProject();
    if (!open || !open.store.readOnly) return;
    const left = leaving();
    const copy = await toWritable(open, resourceTextsRef.current, open);
    if (left) rememberRecent(left);
    textsOf.current = copy.store;
    // the texts are the copy's now (written into it)
    for (const path of Object.keys(resourceTextsRef.current))
      textStore.current.set(path, copy.store);
    setProject(copy);
    setModel((prev) => ({
      ...prev,
      projectSource: copy.source,
      aside: undefined,
    }));
  }, [currentProject, leaving, toWritable]);

  // ---- native files (goal-controller#143) ----------------------------------------
  // what is known of the open project's native files (held, in sync with which model)
  const [tracking, setTracking] = useState<NativeTracking | null>(null);
  const trackingNow = trackingFor(tracking, project?.store ?? null);
  // the texts read from the open project's store (not another project's, still in state)
  const storeTexts = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(resourceTexts).filter(
          ([path]) =>
            !!project && textStore.current.get(path) === project.store,
        ),
      ),
    [resourceTexts, project],
  );
  const nativeContext = useCallback(
    (slot: NativeSlot) => ({
      modelName: (slot.model.split('/').pop() ?? slot.model).replace(
        /\.[^.]*$/,
        '',
      ),
      projectResources: Object.fromEntries(
        resourceSlotsNow.map((resource) => [
          resource.kind,
          Object.fromEntries(
            resource.paths.flatMap((path) =>
              storeTexts[path] === undefined ? [] : [[path, storeTexts[path]!]],
            ),
          ),
        ]),
      ),
      options: settings.options,
    }),
    [resourceSlotsNow, storeTexts, settings.options],
  );
  // each native file, checked against the model once its text is read
  useEffect(() => {
    const store = project?.store ?? null;
    setTracking((prev) =>
      checkNatives(
        trackingFor(prev, store),
        nativeSlotsNow,
        storeTexts,
        textRef.current,
        nativeContext,
      ),
    );
  }, [project, nativeSlotsNow, storeTexts, nativeContext]);
  const nativeStatesNow = useMemo(
    () =>
      nativeStates(
        nativeSlotsNow,
        storeTexts,
        model.text,
        trackingNow,
        nativeContext,
      ),
    [nativeSlotsNow, storeTexts, model.text, trackingNow, nativeContext],
  );
  // a file that follows the model: written from it as the model is edited,
  // once per model text, and saved where the project can be written (as a
  // resource's edit is; a read-only project keeps it with the model: Recent
  // reopens the edited model, and the file then reads to it)
  useEffect(() => {
    const { writes, tracking: next } = followed(
      trackingNow,
      nativeStatesNow,
      textRef.current,
    );
    if (!writes.length) return;
    setTracking(next);
    for (const { path, text } of writes) setResourceText(path, text);
  }, [nativeStatesNow, trackingNow, setResourceText]);
  const regenerateNative = useCallback(
    (path: string) =>
      setTracking((prev) =>
        inSyncNow(
          trackingFor(prev, projectRef.current?.store ?? null),
          path,
          '',
        ),
      ),
    [],
  );
  const reimportModel = useCallback(
    (path: string) => {
      const slot = nativeSlotsNow.find((s) => s.path === path);
      const text = storeTexts[path];
      if (!slot || text === undefined) return;
      const read = slot.definition.read(text, nativeContext(slot));
      if (!read.model) return;
      const next = modelText(read.model);
      setText(next, 'convert');
      setTracking((prev) =>
        inSyncNow(
          trackingFor(prev, projectRef.current?.store ?? null),
          path,
          next,
        ),
      );
    },
    [nativeSlotsNow, storeTexts, nativeContext, setText],
  );
  // a native file its dialect writes, absent when the project opens: written
  // from the model at once, beside it (in the project's files, saved where
  // the project can be written), once per project
  const absentDone = useRef<ProjectStore | null>(null);
  const [absentFailed, setAbsentFailed] = useState<{
    store: ProjectStore;
    problems: Problem[];
  } | null>(null);
  useEffect(() => {
    const store = project?.store ?? null;
    if (!store || absentDone.current === store) return;
    // a writer reads the project's resources too (GRL's strategies): once they are read
    if (
      resourceSlotsNow.some((slot) =>
        slot.paths.some((path) => storeTexts[path] === undefined),
      )
    )
      return;
    absentDone.current = store;
    const generated = generateAbsent(
      nativeSlotsNow,
      textRef.current,
      nativeContext,
    );
    setAbsentFailed({ store, problems: absentProblems(generated) });
    const made = generated.filter(({ write }) => write.text !== null);
    if (!made.length) return;
    for (const { slot, write } of made) {
      setResourceText(slot.path, write.text!);
      setTracking((prev) =>
        inSyncNow(
          trackingFor(prev, store),
          slot.path,
          textRef.current,
          write.diagnostics,
        ),
      );
    }
    setProject((prev) =>
      prev && prev.store === store
        ? {
            ...prev,
            files: [
              ...new Set([...prev.files, ...made.map(({ slot }) => slot.path)]),
            ].sort(),
          }
        : prev,
    );
  }, [
    project,
    nativeSlotsNow,
    resourceSlotsNow,
    storeTexts,
    nativeContext,
    setResourceText,
  ]);
  const nativeProblemsNow = useMemo(
    () => [
      ...nativeProblems(nativeStatesNow),
      ...(absentFailed && absentFailed.store === project?.store
        ? absentFailed.problems
        : []),
    ],
    [nativeStatesNow, absentFailed, project],
  );

  // ---- variables -------------------------------------------------------------
  const variables = useMemo(
    () => (isPrismEngine(engine) ? (analysis?.variables ?? []) : []),
    [analysis, engine],
  );
  // what M6's host tools read, fresh on each call (goal-controller#415):
  // the pool's documents, and what the Notation editor checks against
  workspaceRef.current = () => ({
    tree,
    resources: resourceSlotsNow.flatMap((slot) =>
      slot.paths.flatMap((path) =>
        resourceTexts[path] === undefined
          ? []
          : [{ kind: slot.kind, path, text: resourceTexts[path] }],
      ),
    ),
    variables,
    projectResources,
  });
  const [storedValues, setStoredValues] = useState<VariableValues>(
    initial.current?.variables ?? {},
  );
  // the Edge engines' variables.json, when the project has it: its values are the
  // model's (over the panel's), and the panel's edits are written to it
  const variablesFile = isPrismEngine(engine)
    ? resourceSlotsNow.find(
        (slot) => slot.kind === 'variables' && !slot.missing,
      )?.paths[0]
    : undefined;
  const fileValues = variablesFile
    ? (parsedResources.variables?.data as VariableValues | undefined)
    : undefined;
  const fileValuesRef = useRef(fileValues);
  fileValuesRef.current = fileValues;
  const values = useMemo(() => {
    const result: VariableValues = {};
    for (const variable of variables) {
      const stored = fileValues?.[variable.name] ?? storedValues[variable.name];
      result[variable.name] =
        typeof stored === (variable.kind === 'context' ? 'boolean' : 'number')
          ? (stored as boolean | number)
          : defaultValue(variable);
    }
    return result;
  }, [variables, storedValues, fileValues]);
  /** write values: into variables.json when the project has it, else the workbench's */
  const writeValues = useCallback(
    (next: VariableValues) => {
      if (variablesFile && fileValuesRef.current) {
        setResourceText(
          variablesFile,
          `${JSON.stringify({ ...fileValuesRef.current, ...next }, null, 2)}\n`,
        );
        return;
      }
      setStoredValues((prev) => ({ ...prev, ...next }));
    },
    [variablesFile, setResourceText],
  );
  const setValue = useCallback(
    (name: string, value: boolean | number) => writeValues({ [name]: value }),
    [writeValues],
  );
  const setValues = useCallback(
    (next: VariableValues) => writeValues(next),
    [writeValues],
  );
  const resetValues = useCallback(
    () =>
      writeValues(
        Object.fromEntries(
          variables.map((variable) => [variable.name, defaultValue(variable)]),
        ),
      ),
    [variables, writeValues],
  );

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
  const transformsInFlight = useRef(0);
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

  // the actual transform() call runs in the engine worker (#413), against
  // its mirror's current model; this thread only sends the options text
  // can't carry (fileName, the engine's options, PRISM's variable values)
  const generate = useCallback(() => {
    const {
      text,
      fileName,
      engine: runEngine,
      options: runOptions,
      values: runValues,
      inputsSignature: requestedSignature,
      runs: priorRuns,
    } = latest.current;
    if (!text.trim() || requestedSignature === null) return;
    // an analysis engine generates nothing (its values are Analyse's)
    if (!generatesFiles(runEngine)) return;
    if (!latest.current.variablesReady) {
      setPendingGenerate(true);
      return;
    }
    setPendingGenerate(false);
    const started = performance.now();
    transformsInFlight.current += 1;
    setGenerating(true);
    // an Edge engine reads the previous run's primary file
    const previousOutput = runOptions.clean
      ? undefined
      : previousOutputOf(priorRuns, runEngine);
    void engineWorker
      .transform({
        engine: runEngine,
        fileName: fileName.replace(/\.(txt|json)$/i, '') || 'model',
        previousOutput,
        ...optionsFor(runEngine, runOptions),
        ...(isPrismEngine(runEngine) &&
          Object.keys(runValues).length > 0 && { variables: runValues }),
      })
      .then((result) => {
        // generating while any transform is in flight: a superseded one
        // settles first, and the one that replaced it clears it
        transformsInFlight.current -= 1;
        if (transformsInFlight.current === 0) setGenerating(false);
        // cancelled (superseded, or its model closed): no run, no error
        if (result.status === 'cancelled') return;
        const { outcome } = result;
        runId.current += 1;
        // labeled with what the worker actually ran against, not what this
        // thread guessed when it asked (goal-controller#432 review): the
        // worker's own model may have moved on by the time it answers
        const signature =
          outcome.modelSignature === null
            ? requestedSignature
            : JSON.stringify([
                outcome.modelSignature,
                runEngine,
                optionsFor(runEngine, runOptions),
                isPrismEngine(runEngine) ? runValues : null,
              ]);
        const run: Run = outcome.ok
          ? {
              id: runId.current,
              at: Date.now(),
              engine: runEngine,
              durationMs: performance.now() - started,
              signature,
              files: outcome.files,
              report: outcome.report,
              error: null,
            }
          : {
              id: runId.current,
              at: Date.now(),
              engine: runEngine,
              durationMs: performance.now() - started,
              signature,
              files: null,
              report: null,
              error: outcome.error,
            };
        setRuns((prev) => [run, ...prev].slice(0, 20));
      });
  }, [engineWorker.transform]);

  useEffect(() => {
    if (pendingGenerate && variablesReady) generate();
  }, [pendingGenerate, variablesReady, generate]);

  // the chosen engine's runs: another engine's are kept, not shown
  const { current, lastGood } = engineRuns(runs, engine);
  const stale = !!current && !generatedFrom(current, inputsSignature);

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
    if (current && generatedFrom(current, debouncedSignature)) return;
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

  // lastGood: the last successful output (a failed run keeps showing the previous output)
  const shownFile = lastGood?.files
    ? activeFileOf(lastGood.files, outputFile)
    : undefined;
  const trace = useMemo(
    () =>
      shownFile
        ? traceOfFile(
            shownFile,
            nodeIds,
            (owner) => tree?.byIStarId.get(owner)?.key ?? owner,
          )
        : null,
    [shownFile, nodeIds, tree],
  );

  // an analysis: run on a click, on the model as it is now and its input's
  // files as the tabs hold them; never written to the model
  const analysisEngine = ENGINE_ANALYSES[engine] ?? null;
  const analyses = analysisEngine?.analyses ?? null;
  // (declared with the runs above; cleared with them when a model is opened or closed)
  useEffect(() => setAnalysisRun(null), [engine]);
  const runAnalysisNow = useCallback(
    (id: string) => {
      const analysis = analyses?.[id];
      if (!analysis || !analysisEngine) return;
      setAnalysisRun(
        analyse(
          id,
          analysis,
          textRef.current,
          // read fresh, not the hook's render-time storeModel: both are now
          // synchronous reads, so they stay paired regardless of when this
          // runs relative to the last render (#451 review)
          sessionRef.current.store.getModel(),
          analysisEngine.model,
          analysisResource(
            analysis,
            resourceSlotsNow,
            resourceTextsRef.current,
          ),
          analysisContext(
            analysis,
            resourceSlotsNow,
            resourceTextsRef.current,
            optionsFor(engine, options),
          ),
        ),
      );
    },
    [analyses, analysisEngine, resourceSlotsNow, engine, options],
  );
  const setAnalysisCase = useCallback(
    (caseId: string) =>
      setAnalysisRun((run) => (run ? { ...run, caseId, step: 0 } : run)),
    [],
  );
  const stepAnalysis = useCallback(
    (delta: number) =>
      setAnalysisRun((run) => (run ? stepped(run, delta) : run)),
    [],
  );
  const clearAnalysis = useCallback(() => setAnalysisRun(null), []);

  /** the latest output of the engine as the project keeps it (none: no output yet) */
  const latestOutputs = useCallback(
    (open: Project) => {
      const { lastGood: run } = engineRuns(
        latest.current.runs,
        latest.current.engine,
      );
      const path = openPathIn(open);
      return (run && path !== undefined && outputsToSave(run, path)) || null;
    },
    [openPathIn],
  );

  // the latest output's files, kept in the project: out/, one manifest entry each
  const saveOutputs = useCallback(async () => {
    const open = currentProject();
    const outputs = open && latestOutputs(open);
    if (!open || !outputs) return;
    const { project: next, changes } = withOutputs(open, outputs);
    await writeProject(open, changes, next);
  }, [currentProject, latestOutputs, writeProject]);

  // the project as a .tar.gz: as it is now, with the latest output as saveOutputs keeps it
  const exportProject = useCallback(async () => {
    const open = currentProject();
    if (!open) return;
    const outputs = latestOutputs(open);
    const { project: next, changes } = outputs
      ? withOutputs(open, outputs)
      : { project: open, changes: {} };
    // the project resources and files open in tabs, with their unsaved edits;
    // the open model is as it is now (currentProject), never a tab's older text
    const { [openPathIn(open) ?? '']: _model, ...tabs } =
      resourceTextsRef.current;
    const { fileName, bytes } = await exportArchive(next, {
      ...tabs,
      ...changes,
    });
    downloadBytes(fileName, bytes, 'application/gzip');
  }, [currentProject, latestOutputs, openPathIn]);

  // a project's outputs, when it has some for the model and engine: shown
  // until the first generation (stale if the model changed since)
  const outputsOf = project ? `${openPathIn(project)}\n${engine}` : null;
  useEffect(() => {
    const open = projectRef.current;
    const path = openPathIn(open);
    const hasRun = () =>
      engineRuns(latest.current.runs, engine).runs.length > 0;
    if (!open || path === undefined || pistar || hasRun()) return undefined;
    let cancelled = false;
    void readOutputs(open, path, engine)
      .then((saved) => {
        if (cancelled || !saved || hasRun()) return;
        runId.current += 1;
        const run: Run = savedRun(saved, {
          id: runId.current,
          engine,
          at: Date.now(),
        });
        setRuns((prev) => [...withSavedRun(prev, run)]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // a project's outputs are read once per project, model and engine
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outputsOf, project?.store, pistar]);

  // ---- problems ----------------------------------------------------------------
  // what the language services say of the open documents (editors, fields),
  // and the engine worker's own analysis (goal-controller#433): its
  // per-element findings publish to the same store (which, like its
  // comment says, holds diagnostics about elements only), under the
  // current session's id so a session switch retracts the old one's
  // rather than leaving it stuck. A run-wide finding (no element: a crash,
  // a parse failure) has nowhere to anchor in that store, so it stays on
  // the direct path below, as it always was.
  const serviceProblems = useServiceDiagnostics();
  useEffect(() => {
    const document = String(session.id);
    publishDiagnostics(
      ENGINE_DIAGNOSTICS_SERVICE,
      document,
      analysis && !jsonError
        ? analysis.problems.filter((problem) => problem.elementId !== undefined)
        : [],
    );
    return () => publishDiagnostics(ENGINE_DIAGNOSTICS_SERVICE, document, []);
  }, [analysis, jsonError, session.id]);
  // the active mode's guard report (goal-controller#471): an import or an
  // open applies as written, the mode's own rules checked afterwards and
  // shown as Problems instead of rejecting it; re-published under the
  // current session's id, as the engine's own diagnostics are, so a session
  // switch retracts the old one's
  useEffect(() => {
    const document = String(session.id);
    publishDiagnostics(GUARD_REPORT_SERVICE, document, guardReport);
    return () => publishDiagnostics(GUARD_REPORT_SERVICE, document, []);
  }, [guardReport, session.id]);
  const problems = useMemo(() => {
    const list: Problem[] = [];
    if (jsonError) list.push(jsonError);
    // what the model's manifest holds that is not used (its options are the file's)
    else list.push(...modelOptions.problems);
    // what is wrong in the project's resources (Model group, by the resource's label)
    list.push(...resourceProblemsNow);
    // the model's native files: out of sync, unreadable, or not written (goal-controller#143)
    list.push(...nativeProblemsNow);
    // a framework's model (goal-controller#171): what its dialect says of it,
    // in its modelling mode or its engine's
    const framework = pistar
      ? isFrameworkMode(dialect)
        ? FRAMEWORK_DIALECTS[dialect]
        : null
      : (frameworkEditorOf(engine)?.definition ?? null);
    // with the vocabulary profile the model records (a CAIRIS model's, #192)
    if (framework && model.text.trim() && !jsonError)
      list.push(
        ...frameworkProblems(
          storeModel,
          dialectForModel(framework, storeModel),
          projectResources,
        ),
      );
    // piStar mode: only whether the file parses; the engine checks do not apply
    if (pistar) return list;
    // the checks of iStar's notations: none in another framework
    if (tree && !jsonError && !framework) {
      list.push(...treeProblems(tree, engine));
      // the shared language on the model's own document, editors open or not
      if (isDialectEngine(engine))
        list.push(
          ...modelLanguageProblems(engine, tree, variables, projectResources),
        );
    }
    if (analysis && !jsonError)
      list.push(
        ...analysis.problems.filter(
          (problem) => problem.elementId === undefined,
        ),
      );
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
    jsonError,
    model.text,
    storeModel,
    modelOptions,
    resourceProblemsNow,
    nativeProblemsNow,
    projectResources,
    pistar,
    dialect,
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
    openArchive,
    openNativeFile,
    openCairisFile,
    openRecent,
    project,
    openFolder,
    resourceSlots: resourceSlotsNow,
    listing,
    openedFiles,
    openProjectFile,
    resourceTexts,
    parsedResources,
    projectResources,
    addResource,
    setResourceText,
    copyToBrowser,
    resourceNotice,
    nativeSlots: nativeSlotsNow,
    nativeStates: nativeStatesNow,
    regenerateNative,
    reimportModel,
    projectSource: model.projectSource,
    closeModel,
    setText,
    renameFile,
    markSaved,
    undo,
    redo,
    canUndo: session.store.canUndo(),
    canRedo: session.store.canRedo(),
    session,
    dispatcherFor: session.dispatcherFor,
    glspEnabled,
    setGlspEnabled,
    glspSession,
    agentWorkspace,
    editRejected,
    notifyEditRejected,
    dismissEditRejected,
    recent,
    forgetRecent,
    tree,
    jsonError,
    engine,
    engineLocked: lockedEngine !== null,
    mode,
    recordedEngine,
    requestMode,
    conversion,
    openConversion,
    applyConversion,
    cancelConversion,
    openModelFile,
    addModelFile,
    modelPath,
    openProjectModel,
    frameworkSwitch,
    confirmFrameworkSwitch,
    cancelFrameworkSwitch,
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
    analysisSlow,
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
    lastGood,
    stale,
    outputFile,
    setOutputFile,
    trace,
    saveOutputs,
    analyses,
    analysisRun,
    analysisStale: !!analysisRun && analysisRun.text !== model.text,
    runAnalysis: runAnalysisNow,
    setAnalysisCase,
    stepAnalysis,
    clearAnalysis,
    exportProject,
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
    revealed,
    revealLocation,
  };

  return (
    <WorkbenchContext.Provider value={value}>
      {children}
    </WorkbenchContext.Provider>
  );
}
