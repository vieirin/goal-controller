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
import { generationProblems, jsonProblem, treeProblems } from '@/lib/workbench/localProblems';
import { buildViewTree, type ViewTree } from '@/lib/workbench/pistar';
import { modelSignature } from '@/lib/workbench/signature';
import {
  loadRecent,
  loadWorkspace,
  rememberRecent,
  saveWorkspace,
  forgetRecent as forgetRecentFile,
  type RecentFile,
} from '@/lib/workbench/storage';
import { buildTraceIndex, type TraceIndex } from '@/lib/workbench/trace';
import {
  DEFAULT_OPTIONS,
  type AnalyzeResponse,
  type GenerationOptions,
  type Problem,
  type VariableInfo,
} from '@/lib/workbench/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Which part of the workbench last changed the model. */
export type ChangeSource = 'open' | 'canvas' | 'source' | 'inspector' | 'undo' | 'restore';
/** Which part of the workbench made the selection. */
export type SelectOrigin = 'tree' | 'canvas' | 'source' | 'output' | 'inspector' | 'problems' | 'variables';

export type ModelTab = 'tree' | 'source';
export type OutputTab = 'output' | 'diff' | 'report';
export type BottomTab = 'problems' | 'variables' | 'log';

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

type Persisted = {
  fileName: string;
  text: string;
  savedText: string;
  engine: TransformEngine;
  options: GenerationOptions;
  live: boolean;
  variables: VariableValues;
};

export type Workbench = {
  // model
  fileName: string;
  text: string;
  hasModel: boolean;
  dirty: boolean;
  changeSource: ChangeSource;
  revision: number;
  openModel: (fileName: string, text: string) => void;
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
  options: GenerationOptions;
  setOptions: (patch: Partial<GenerationOptions>) => void;

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

  // selection & navigation
  selected: string | null;
  selectOrigin: SelectOrigin | null;
  selectSeq: number;
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
  if (!value) throw new Error('useWorkbench must be used inside <WorkbenchProvider>');
  return value;
};

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

const optionsFor = (engine: TransformEngine, options: GenerationOptions): Record<string, unknown> =>
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

export function WorkbenchProvider({
  lockedEngine,
  children,
}: {
  lockedEngine: TransformEngine | null;
  children: ReactNode;
}) {
  const initial = useRef<Persisted | null>(loadWorkspace<Persisted>());

  // ---- model -------------------------------------------------------------
  const [model, setModel] = useState(() => ({
    fileName: initial.current?.fileName ?? '',
    text: initial.current?.text ?? '',
    savedText: initial.current?.savedText ?? '',
    source: 'restore' as ChangeSource,
    revision: 0,
  }));
  const undoStack = useRef<string[]>([]);
  const redoStack = useRef<string[]>([]);
  const lastPush = useRef(0);
  const [, forceHistory] = useState(0);
  const [recent, setRecent] = useState<RecentFile[]>(() => loadRecent());

  // latest text, updated synchronously so the undo bookkeeping stays outside
  // state updaters (React may run updaters twice)
  const textRef = useRef(model.text);
  const commit = useCallback((text: string, source: ChangeSource) => {
    textRef.current = text;
    setModel((prev) => ({ ...prev, text, source, revision: prev.revision + 1 }));
    forceHistory((n) => n + 1);
  }, []);

  const setText = useCallback(
    (text: string, source: ChangeSource) => {
      if (textRef.current === text) return;
      const now = Date.now();
      // coalesce bursts (typing, dragging) into one undo step
      if (now - lastPush.current > COALESCE_MS || undoStack.current.length === 0) {
        undoStack.current = [...undoStack.current, textRef.current].slice(-UNDO_LIMIT);
      }
      lastPush.current = now;
      redoStack.current = [];
      commit(text, source);
    },
    [commit],
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

  // ---- selection & navigation ---------------------------------------------
  const [selection, setSelection] = useState<{ id: string | null; origin: SelectOrigin | null; seq: number }>({
    id: null,
    origin: null,
    seq: 0,
  });
  const select = useCallback((id: string | null, origin: SelectOrigin) => {
    setSelection((prev) => ({ id, origin, seq: prev.seq + 1 }));
  }, []);
  const [modelTab, setModelTab] = useState<ModelTab>('tree');
  const [outputTab, setOutputTab] = useState<OutputTab>('output');
  const [bottomTab, setBottomTabState] = useState<BottomTab>('problems');
  const [bottomRevealSeq, setBottomRevealSeq] = useState(0);
  const setBottomTab = useCallback((tab: BottomTab) => {
    setBottomTabState(tab);
    setBottomRevealSeq((n) => n + 1);
  }, []);
  const [sourceLine, setSourceLine] = useState<{ line: number; seq: number } | null>(null);
  const revealSourceLine = useCallback((line: number) => {
    setModelTab('source');
    setSourceLine((prev) => ({ line, seq: (prev?.seq ?? 0) + 1 }));
  }, []);

  // ---- generation state (declared early: openModel resets it) --------------
  const [runs, setRuns] = useState<Run[]>([]);

  const modelRef = useRef(model);
  modelRef.current = model;

  const openModel = useCallback(
    (fileName: string, text: string) => {
      const previous = modelRef.current;
      if (previous.text && previous.text !== previous.savedText) {
        // keep unsaved edits reachable from Recent
        rememberRecent({ fileName: previous.fileName, text: previous.text });
      }
      setRecent(rememberRecent({ fileName, text }));
      textRef.current = text;
      setModel((prev) => ({ fileName, text, savedText: text, source: 'open', revision: prev.revision + 1 }));
      undoStack.current = [];
      redoStack.current = [];
      setRuns([]);
      setSelection((prev) => ({ id: null, origin: null, seq: prev.seq + 1 }));
      forceHistory((n) => n + 1);
    },
    [],
  );

  const renameFile = useCallback((fileName: string) => {
    setModel((prev) => ({ ...prev, fileName }));
  }, []);

  const markSaved = useCallback(() => {
    setModel((prev) => ({ ...prev, savedText: prev.text }));
  }, []);

  const forgetRecent = useCallback((fileName: string) => setRecent(forgetRecentFile(fileName)), []);

  // ---- engine & options ----------------------------------------------------
  const [engineState, setEngineState] = useState<TransformEngine>(
    lockedEngine ?? initial.current?.engine ?? 'edgev2',
  );
  const engine = lockedEngine ?? engineState;
  const setEngine = useCallback((next: TransformEngine) => setEngineState(next), []);
  const [options, setOptionsState] = useState<GenerationOptions>({
    ...DEFAULT_OPTIONS,
    ...(initial.current?.options ?? {}),
  });
  const setOptions = useCallback(
    (patch: Partial<GenerationOptions>) => setOptionsState((prev) => ({ ...prev, ...patch })),
    [],
  );
  const [live, setLive] = useState<boolean>(initial.current?.live ?? true);

  // ---- structure (client-side, immediate) -----------------------------------
  const parsed = useMemo(() => {
    if (!model.text.trim()) return { tree: null, error: null };
    try {
      return { tree: buildViewTree(model.text, engine), error: null };
    } catch (error) {
      return { tree: null, error: jsonProblem(model.text, error as Error) };
    }
  }, [model.text, engine]);
  // keep showing the last good tree while the JSON is being edited
  const lastTree = useRef<ViewTree | null>(null);
  if (parsed.tree) lastTree.current = parsed.tree;
  if (!model.text.trim()) lastTree.current = null;
  const tree = parsed.tree ?? lastTree.current;
  const nodeIds = useMemo(() => new Set(tree ? [...tree.nodes.keys()] : []), [tree]);

  // ---- analysis (server, debounced) ------------------------------------------
  const debouncedText = useDebounced(model.text, 400);
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  useEffect(() => {
    if (!debouncedText.trim() || modelSignature(debouncedText) === null) return undefined;
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
        if (data.success) {
          setAnalysis(data);
        } else {
          setAnalysis({
            success: true,
            variables: [],
            knownProperties: { goal: [], task: [], resource: [] },
            problems: [{ severity: 'error', source: 'engine', message: data.error }],
          });
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!controller.signal.aborted) setAnalyzing(false);
      });
    return () => controller.abort();
  }, [debouncedText, engine]);
  useEffect(() => {
    if (!model.text.trim()) setAnalysis(null);
  }, [model.text]);

  // ---- variables -------------------------------------------------------------
  const variables = useMemo(
    () => (isPrismEngine(engine) ? analysis?.variables ?? [] : []),
    [analysis, engine],
  );
  const [storedValues, setStoredValues] = useState<VariableValues>(initial.current?.variables ?? {});
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
    (name: string, value: boolean | number) => setStoredValues((prev) => ({ ...prev, [name]: value })),
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
      : JSON.stringify([content, engine, optionsFor(engine, options), isPrismEngine(engine) ? values : null]);
  }, [model.text, engine, options, values]);

  const [generating, setGenerating] = useState(false);
  const runId = useRef(0);
  const inflight = useRef<AbortController | null>(null);
  const latest = useRef({ text: model.text, fileName: model.fileName, engine, options, values, inputsSignature });
  latest.current = { text: model.text, fileName: model.fileName, engine, options, values, inputsSignature };

  const generate = useCallback(() => {
    const { text, fileName, engine: runEngine, options: runOptions, values: runValues, inputsSignature: signature } =
      latest.current;
    if (!text.trim() || signature === null) return;
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
        ...(isPrismEngine(runEngine) && Object.keys(runValues).length > 0 && { variables: runValues }),
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
          report: data.success ? data.report ?? null : null,
          error: data.success ? null : [data.error, data.details].filter(Boolean).join('\n'),
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

  const current = runs[0] ?? null;
  const stale = !!current && current.signature !== inputsSignature;

  // live: regenerate when what generation depends on changes
  const debouncedSignature = useDebounced(inputsSignature, 700);
  useEffect(() => {
    if (!live || debouncedSignature === null || !model.text.trim()) return;
    if (current?.signature === debouncedSignature) return;
    generate();
    // current is read for comparison only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, debouncedSignature, generate]);

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
    if (tree && !parsed.error) list.push(...treeProblems(tree, engine));
    if (analysis && !parsed.error) list.push(...analysis.problems);
    if (current && !stale) {
      const checked = new Set(list.filter((p) => p.source === 'model' && p.nodeId).map((p) => p.nodeId));
      list.push(
        ...generationProblems(current.error, current.report?.log ?? null, nodeIds).filter(
          // the engine repeats notation problems the model check already reports
          (p) => !(p.severity === 'warning' && p.nodeId && checked.has(p.nodeId) && /notation/i.test(p.message)),
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
  }, [parsed.error, tree, engine, analysis, current, stale, nodeIds]);

  // ---- autosave -------------------------------------------------------------------
  const persisted = useDebounced<Persisted>(
    {
      fileName: model.fileName,
      text: model.text,
      savedText: model.savedText,
      engine: engineState,
      options,
      live,
      variables: storedValues,
    },
    500,
  );
  useEffect(() => {
    saveWorkspace(persisted);
  }, [persisted]);

  const value: Workbench = {
    fileName: model.fileName,
    text: model.text,
    hasModel: model.text.trim().length > 0,
    dirty: model.text !== model.savedText,
    changeSource: model.source,
    revision: model.revision,
    openModel,
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
    setEngine,
    options,
    setOptions,
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
    generating,
    runs,
    current,
    stale,
    trace,
    problems,
    selected: selection.id,
    selectOrigin: selection.origin,
    selectSeq: selection.seq,
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

  return <WorkbenchContext.Provider value={value}>{children}</WorkbenchContext.Provider>;
}
