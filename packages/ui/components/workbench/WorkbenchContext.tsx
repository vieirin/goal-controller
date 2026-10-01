'use client';

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
  treeProblems,
} from '@/lib/workbench/localProblems';
import type { GoalView } from '@goal-controller/goal-tree';
import { parsePistar } from '@istar-ts/core';
import {
  readModelMode,
  viewTreeFrom,
  writeModelMode,
  type ModelMode,
  type ViewTree,
} from '@/lib/workbench/pistar';
import { modelSignature } from '@/lib/workbench/signature';
import {
  loadPreferences,
  loadRecent,
  rememberRecent,
  savePreferences,
  forgetRecent as forgetRecentFile,
  type RecentFile,
} from '@/lib/workbench/storage';
import { buildTraceIndex, type TraceIndex } from '@/lib/workbench/trace';
import {
  DEFAULT_OPTIONS,
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
  | 'inspector'
  | 'undo'
  | 'restore'
  | 'convert';
/** Which part of the workbench made the selection. */
export type SelectOrigin =
  | 'canvas'
  | 'source'
  | 'output'
  | 'inspector'
  | 'problems'
  | 'variables';

export type ModelTab = 'diagram' | 'source';
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
};

export type Workbench = {
  // model
  fileName: string;
  text: string;
  hasModel: boolean;
  dirty: boolean;
  changeSource: ChangeSource;
  revision: number;
  openModel: (fileName: string, text: string, how?: OpenOptions) => void;
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
  forgetRecent: (fileName: string) => void;

  // structure
  tree: ViewTree | null;
  jsonError: Problem | null;

  // engine
  engine: TransformEngine;
  engineLocked: boolean;
  setEngine: (engine: TransformEngine) => void;
  /** what the model is for: its engine, or 'pistar' for free modelling */
  mode: ModelMode;
  /**
   * Switch the model to a mode. piStar mode is always possible; an engine goes through a
   * conversion (see `conversion`) that checks the model is valid for it first.
   */
  requestMode: (mode: ModelMode) => void;
  /** the engine recorded in the model file, if any (a piStar view of it can go straight back) */
  recordedEngine: TransformEngine | null;
  /** a conversion waiting for confirmation (ConvertDialog) */
  conversion: { target: TransformEngine } | null;
  /** open the conversion dialog (every engine checked), `target` selected first */
  openConversion: (target: TransformEngine) => void;
  /** apply a checked conversion: the converted model text, now for `target` */
  applyConversion: (target: TransformEngine, text: string) => void;
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

const optionsFor = (
  engine: TransformEngine,
  options: GenerationOptions,
): Record<string, unknown> =>
  engine === 'edgev2'
    ? {
        clean: options.clean,
        generateDecisionVars: options.generateDecisionVars,
        discretisation: options.discretisation,
        taskLayout: options.taskLayout,
      }
    : engine === 'edge'
      ? {
          clean: options.clean,
          generateDecisionVars: options.generateDecisionVars,
          achievabilitySpace: options.achievabilitySpace,
        }
      : { generateFluents: options.generateFluents };

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

  // ---- engine & options ----------------------------------------------------
  const [engineState, setEngineState] = useState<TransformEngine>(
    lockedEngine ?? initial.current?.engine ?? 'edgev2',
  );
  const engine = lockedEngine ?? engineState;
  const setEngine = useCallback(
    (next: TransformEngine) => setEngineState(next),
    [],
  );
  const [options, setOptionsState] = useState<GenerationOptions>({
    ...DEFAULT_OPTIONS,
    ...initial.current?.options,
  });
  const setOptions = useCallback(
    (patch: Partial<GenerationOptions>) =>
      setOptionsState((prev) => ({ ...prev, ...patch })),
    [],
  );
  const [live, setLive] = useState<boolean>(initial.current?.live ?? true);
  const [pistar, setPistar] = useState(false);
  const settings = useMemo<ModelSettings>(
    () => ({ engine, options, live, pistar }),
    [engine, options, live, pistar],
  );
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const applySettings = useCallback((next: ModelSettings) => {
    setEngineState(next.engine);
    setOptionsState({ ...DEFAULT_OPTIONS, ...next.options });
    setLive(next.live);
    setPistar(next.pistar ?? false);
  }, []);
  const [settingsDialog, setSettingsDialog] = useState<'setup' | 'edit' | null>(
    null,
  );
  const openSettings = useCallback(() => setSettingsDialog('edit'), []);
  const closeSettings = useCallback(() => setSettingsDialog(null), []);

  // ---- model (every load starts empty; earlier work is reopened from Recent) ----
  const [model, setModel] = useState(() => ({
    fileName: '',
    text: '',
    savedText: '',
    source: 'restore' as ChangeSource,
    revision: 0,
  }));
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

  // ---- mode: engines and piStar, and conversion between them ---------------
  const recordedEngine = useMemo<TransformEngine | null>(() => {
    const recorded = readModelMode(model.text);
    return recorded && recorded !== 'pistar' ? recorded : null;
  }, [model.text]);
  const [conversion, setConversion] = useState<{
    target: TransformEngine;
  } | null>(null);
  const requestMode = useCallback(
    (target: ModelMode) => {
      const current = settingsRef.current;
      const currentMode: ModelMode = current.pistar
        ? 'pistar'
        : (lockedEngine ?? current.engine);
      const text = textRef.current;
      if (lockedEngine && target !== 'pistar' && target !== lockedEngine)
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
        // the piStar view of any model; the engine recorded in the file stays
        // (only the mode: options applied just before, by the settings dialog, stay)
        setPistar(true);
        return;
      }
      if (recorded === target) {
        // back to the engine the file is for: nothing to convert
        setEngineState(target);
        setPistar(false);
        return;
      }
      setConversion({ target });
    },
    [lockedEngine, setText],
  );
  const applyConversion = useCallback(
    (target: TransformEngine, text: string) => {
      setText(text, 'convert');
      setEngineState(target);
      setPistar(false);
      setConversion(null);
    },
    [setText],
  );
  const cancelConversion = useCallback(() => setConversion(null), []);
  const openConversion = useCallback(
    (target: TransformEngine) => setConversion({ target }),
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

  const openModel = useCallback(
    (
      fileName: string,
      text: string,
      { savedText = text, settings: stored, setup = false }: OpenOptions = {},
    ) => {
      const previous = modelRef.current;
      if (previous.text.trim()) {
        // keep the model being left (and its latest edits) in Recent
        rememberRecent({
          fileName: previous.fileName || 'untitled.txt',
          text: previous.text,
          savedText: previous.savedText,
          settings: settingsRef.current,
        });
      }
      // a model's own settings say whether it is a piStar model (older ones: no)
      // the file says what it is for: its recorded engine, or (none) a piStar model;
      // options and live come from the settings kept with it
      const recorded = readModelMode(text) ?? 'pistar';
      const base = stored
        ? { ...settingsRef.current, ...stored }
        : settingsRef.current;
      const next =
        recorded === 'pistar'
          ? { ...base, pistar: true }
          : { ...base, pistar: false, engine: recorded };
      applySettings(next);
      setSettingsDialog(setup ? 'setup' : null);
      setRecent(rememberRecent({ fileName, text, savedText, settings: next }));
      textRef.current = text;
      setModel((prev) => ({
        fileName,
        text,
        savedText,
        source: 'open',
        revision: prev.revision + 1,
      }));
      undoStack.current = [];
      redoStack.current = [];
      setRuns([]);
      clearSelection();
      setConversion(null);
      forceHistory((n) => n + 1);
    },
    [applySettings, clearSelection],
  );

  const closeModel = useCallback(() => {
    const previous = modelRef.current;
    if (previous.text.trim()) {
      setRecent(
        rememberRecent({
          fileName: previous.fileName || 'untitled.txt',
          text: previous.text,
          savedText: previous.savedText,
          settings: settingsRef.current,
        }),
      );
    }
    // the start screen is not a piStar model
    applySettings({ ...settingsRef.current, pistar: false });
    setSettingsDialog(null);
    textRef.current = '';
    setModel((prev) => ({
      fileName: '',
      text: '',
      savedText: '',
      source: 'open',
      revision: prev.revision + 1,
    }));
    undoStack.current = [];
    redoStack.current = [];
    setRuns([]);
    clearSelection();
    setConversion(null);
    forceHistory((n) => n + 1);
  }, [applySettings, clearSelection]);

  const renameFile = useCallback((fileName: string) => {
    // the entry under the old name is replaced by the next Recent sync
    setRecent(forgetRecentFile(modelRef.current.fileName));
    setModel((prev) => ({ ...prev, fileName }));
  }, []);

  const markSaved = useCallback(() => {
    setModel((prev) => ({ ...prev, savedText: prev.text }));
  }, []);

  const forgetRecent = useCallback(
    (fileName: string) => setRecent(forgetRecentFile(fileName)),
    [],
  );

  // ---- structure -------------------------------------------------------------
  // whether the file parses: immediate, in the browser
  const parsed = useMemo(() => {
    if (!model.text.trim()) return { error: null };
    try {
      parsePistar(model.text);
      return { error: null };
    } catch (error) {
      return { error: jsonProblem(model.text, error as Error) };
    }
  }, [model.text]);
  // the tree: goal-tree's view of the model, read by the server with the engine's grammar
  // (/api/tree); the last one of the same file stays while the next is computed, or while
  // the JSON is being fixed
  const [served, setServed] = useState<{
    fileName: string;
    tree: ViewTree;
  } | null>(null);
  useEffect(() => {
    if (!model.text.trim() || parsed.error) return undefined;
    const controller = new AbortController();
    const fileName = model.fileName;
    fetch('/api/tree', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelJson: model.text, engine }),
      signal: controller.signal,
    })
      .then((response) => response.json())
      .then((data: { success: boolean; view?: GoalView }) => {
        if (data.success && data.view)
          setServed({ fileName, tree: viewTreeFrom(data.view) });
      })
      .catch(() => undefined);
    return () => controller.abort();
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
    // piStar mode has no engine to analyse for
    if (
      pistar ||
      !debouncedText.trim() ||
      modelSignature(debouncedText) === null
    )
      return undefined;
    const controller = new AbortController();
    setAnalyzing(true);
    fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelJson: debouncedText, engine }),
      signal: controller.signal,
    })
      .then((response) => response.json())
      .then((data: AnalyzeResponse | { success: false; error: string }) => {
        const key = analysisKey(debouncedText, engine);
        if (data.success) {
          setAnalysis(data, key);
        } else {
          setAnalysis(
            {
              success: true,
              variables: [],
              knownProperties: { goal: [], task: [], resource: [] },
              problems: [
                { severity: 'error', source: 'engine', message: data.error },
              ],
            },
            key,
          );
        }
      })
      .catch((error: Error) => {
        if (error.name === 'AbortError') return;
        // generation must not wait forever: keep the last variables, marked as done for this text
        setAnalyzed((prev) => ({
          key: analysisKey(debouncedText, engine),
          data: prev?.data ?? {
            success: true,
            variables: [],
            knownProperties: { goal: [], task: [], resource: [] },
            problems: [],
          },
        }));
      })
      .finally(() => {
        if (!controller.signal.aborted) setAnalyzing(false);
      });
    return () => controller.abort();
  }, [debouncedText, engine, pistar, setAnalysis]);
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
  const inflight = useRef<AbortController | null>(null);
  const latest = useRef({
    text: model.text,
    fileName: model.fileName,
    engine,
    options,
    values,
    inputsSignature,
    variablesReady,
  });
  latest.current = {
    text: model.text,
    fileName: model.fileName,
    engine,
    options,
    values,
    inputsSignature,
    variablesReady,
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
    } = latest.current;
    if (!text.trim() || signature === null) return;
    if (!latest.current.variablesReady) {
      setPendingGenerate(true);
      return;
    }
    setPendingGenerate(false);
    inflight.current?.abort();
    const controller = new AbortController();
    inflight.current = controller;
    const started = performance.now();
    setGenerating(true);
    fetch('/api/transform', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        modelJson: text,
        engine: runEngine,
        fileName: fileName.replace(/\.(txt|json)$/i, '') || 'model',
        ...optionsFor(runEngine, runOptions),
        ...(isPrismEngine(runEngine) &&
          Object.keys(runValues).length > 0 && { variables: runValues }),
      }),
    })
      .then(async (response) => {
        const data = await response.json();
        runId.current += 1;
        const run: Run = {
          id: runId.current,
          at: Date.now(),
          engine: runEngine,
          durationMs: performance.now() - started,
          signature,
          output: data.success ? data.output : null,
          report: data.success ? (data.report ?? null) : null,
          error: data.success
            ? null
            : [data.error, data.details].filter(Boolean).join('\n'),
        };
        setRuns((prev) => [run, ...prev].slice(0, 20));
      })
      .catch((error: Error) => {
        if (error.name === 'AbortError') return;
        runId.current += 1;
        setRuns((prev) =>
          [
            {
              id: runId.current,
              at: Date.now(),
              engine: runEngine,
              durationMs: performance.now() - started,
              signature,
              output: null,
              report: null,
              error: `Could not reach the generator: ${error.message}`,
            },
            ...prev,
          ].slice(0, 20),
        );
      })
      .finally(() => {
        if (inflight.current === controller) {
          inflight.current = null;
          setGenerating(false);
        }
      });
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

  // ---- problems ----------------------------------------------------------------
  const problems = useMemo(() => {
    const list: Problem[] = [];
    if (parsed.error) list.push(parsed.error);
    // piStar mode: only whether the file parses; the engine checks do not apply
    if (pistar) return list;
    if (tree && !parsed.error) list.push(...treeProblems(tree, engine));
    if (analysis && !parsed.error) list.push(...analysis.problems);
    if (current && !stale) {
      const checked = new Set(
        list
          .filter((p) => p.source === 'model' && p.nodeId)
          .map((p) => p.nodeId),
      );
      list.push(
        ...generationProblems(
          current.error,
          current.report?.log ?? null,
          nodeIds,
        ).filter(
          // the engine repeats notation problems the model check already reports
          (p) =>
            !(
              p.severity === 'warning' &&
              p.nodeId &&
              checked.has(p.nodeId) &&
              /notation/i.test(p.message)
            ),
        ),
      );
    }
    const seen = new Set<string>();
    const order = { error: 0, warning: 1, info: 2 };
    return list
      .filter((problem) => {
        const key = `${problem.severity}:${problem.message}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => order[a.severity] - order[b.severity]);
  }, [parsed.error, pistar, tree, engine, analysis, current, stale, nodeIds]);

  // ---- persistence ----------------------------------------------------------------
  // the open model is kept in Recent (with its unsaved edits) instead of being reopened
  // model and settings debounced together, so a switch never pairs one model with another's settings
  const snapshot = useDebounced(
    useMemo(() => ({ model, settings }), [model, settings]),
    500,
  );
  useEffect(() => {
    const { fileName, text, savedText } = snapshot.model;
    if (!text.trim()) return;
    setRecent(
      rememberRecent({
        fileName: fileName || 'untitled.txt',
        text,
        savedText,
        settings: snapshot.settings,
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
    openModel,
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
    mode: pistar ? 'pistar' : engine,
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
