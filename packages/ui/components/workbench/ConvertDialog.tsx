'use client';

import { parsePistar } from '@istar-ts/core';
import { AlertCircle, AlertTriangle, CheckCircle2, Loader2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { TransformEngine } from '@/lib/types';
import { treeProblems } from '@/lib/workbench/localProblems';
import { buildViewTree, planConversion, type Conversion } from '@/lib/workbench/pistar';
import type { AnalyzeResponse, Problem } from '@/lib/workbench/types';
import { useWorkbench } from './WorkbenchContext';
import { Button, IconButton, cx } from './ui';

const ENGINES: Array<{ id: TransformEngine; label: string; output: string }> = [
  { id: 'edgev2', label: 'EdgeV2', output: 'PRISM' },
  { id: 'edge', label: 'Edge', output: 'PRISM' },
  { id: 'sleec', label: 'SLEEC', output: 'SLEEC' },
];
const LABEL = Object.fromEntries(ENGINES.map((e) => [e.id, e.label])) as Record<TransformEngine, string>;

type Plan = Conversion | { error: string };
type Check = { state: 'checking' } | { state: 'done'; errors: Problem[]; warnings: Problem[] };
type Status = 'checking' | 'ready' | 'warnings' | 'blocked';

const localProblems = (text: string, engine: TransformEngine): Problem[] => {
  try {
    return treeProblems(buildViewTree(text, engine), engine);
  } catch {
    return [];
  }
};

/**
 * Switching a model to an engine. Every engine the model could go to is checked: what
 * the conversion changes by itself, what has to be fixed by hand, and whether the engine
 * accepts the converted model. Any engine can be chosen; the check says which ones accept it.
 */
export default function ConvertDialog({ target }: { target: TransformEngine }) {
  const wb = useWorkbench();
  const candidates = useMemo(
    () => ENGINES.filter((engine) => wb.mode === 'pistar' || engine.id !== wb.mode),
    // the choices are for the model as it was when the dialog opened
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const plans = useMemo(() => {
    const result = {} as Record<TransformEngine, Plan>;
    for (const { id } of candidates) {
      try {
        result[id] = planConversion(wb.text, id);
      } catch (error) {
        result[id] = { error: error instanceof Error ? error.message : String(error) };
      }
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates]);
  const [checks, setChecks] = useState<Partial<Record<TransformEngine, Check>>>({});
  const [selected, setSelected] = useState<TransformEngine>(
    candidates.some((c) => c.id === target) ? target : (candidates[0]?.id ?? target),
  );

  const empty = useMemo(() => {
    const plan = plans[selected];
    if (!plan || 'error' in plan) return false;
    try {
      return parsePistar(plan.text).elements.size === 0;
    } catch {
      return false;
    }
  }, [plans, selected]);

  // an empty model has nothing to convert
  useEffect(() => {
    const plan = plans[selected];
    if (empty && plan && !('error' in plan)) wb.applyConversion(selected, plan.text);
    // once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empty]);

  // ask every engine whether it accepts its converted model
  useEffect(() => {
    if (empty) return undefined;
    const controller = new AbortController();
    for (const { id } of candidates) {
      const plan = plans[id];
      if (!plan || 'error' in plan || plan.blockers.length > 0) continue;
      setChecks((prev) => ({ ...prev, [id]: { state: 'checking' } }));
      fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelJson: plan.text, engine: id }),
        signal: controller.signal,
      })
        .then((response) => response.json())
        .then((data: AnalyzeResponse | { success: false; error: string }) => {
          const all: Problem[] = [
            ...(data.success ? data.problems : [{ severity: 'error' as const, source: 'engine' as const, message: data.error }]),
            ...localProblems(plan.text, id),
          ];
          setChecks((prev) => ({
            ...prev,
            [id]: { state: 'done', errors: all.filter((p) => p.severity === 'error'), warnings: all.filter((p) => p.severity === 'warning') },
          }));
        })
        .catch((error: Error) => {
          if (error.name === 'AbortError') return;
          setChecks((prev) => ({
            ...prev,
            [id]: { state: 'done', errors: [{ severity: 'error', source: 'engine', message: `Could not check the model: ${error.message}` }], warnings: [] },
          }));
        });
    }
    return () => controller.abort();
  }, [candidates, plans, empty]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') wb.cancelConversion();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [wb]);

  const statusOf = (id: TransformEngine): Status => {
    const plan = plans[id];
    if (!plan || 'error' in plan || plan.blockers.length > 0) return 'blocked';
    const check = checks[id];
    if (!check || check.state === 'checking') return 'checking';
    if (check.errors.length > 0) return 'blocked';
    return check.warnings.length > 0 ? 'warnings' : 'ready';
  };

  if (empty) return null;

  const plan = plans[selected];
  const check = checks[selected];
  const label = LABEL[selected];
  const status = statusOf(selected);
  const compatible = status === 'ready' || status === 'warnings';
  // converting is always possible (unless the file does not parse): the status says whether the engine accepts it
  const convertible = !!plan && !('error' in plan);
  const from = wb.mode === 'pistar' ? 'piStar mode' : LABEL[wb.mode];

  return (
    <div className='fixed inset-0 z-50 flex justify-center bg-white sm:items-center sm:bg-ink/30 sm:p-6'>
      <div
        role='dialog'
        aria-modal='true'
        aria-labelledby='convert-title'
        className='flex h-[100dvh] w-full flex-col bg-white sm:h-auto sm:max-h-[92dvh] sm:max-w-lg sm:rounded-xl sm:shadow-2xl'
      >
        <header className='flex items-start gap-3 border-b border-line px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5 sm:py-4'>
          <div className='min-w-0 flex-1'>
            <h2 id='convert-title' className='text-[15px] font-semibold text-ink'>
              Convert the model
            </h2>
            <p className='mt-0.5 text-[13px] text-ink-muted'>
              From {from} to one of the engines; each is checked to show whether it accepts the model. The engine is recorded in the model, so it opens that way again
              (piStar keeps it as a diagram property).
            </p>
          </div>
          <IconButton icon={X} label='Cancel the conversion' onClick={wb.cancelConversion} />
        </header>

        <div className='min-h-0 flex-1 space-y-4 overflow-auto px-4 py-4 text-[13px] sm:px-5'>
          <fieldset className='space-y-1.5'>
            <legend className='mb-1.5 text-2xs font-semibold uppercase tracking-wider text-ink-muted'>Convert to</legend>
            <div className='grid gap-1.5 sm:grid-cols-3'>
              {candidates.map((engine) => {
                const cardStatus = statusOf(engine.id);
                const warnings = checks[engine.id]?.state === 'done' ? (checks[engine.id] as { warnings: Problem[] }).warnings.length : 0;
                const active = engine.id === selected;
                return (
                  <label
                    key={engine.id}
                    className={cx(
                      'flex cursor-pointer flex-col rounded-lg border px-3 py-2 text-left transition-colors',
                      active ? 'border-ink bg-panel ring-1 ring-ink' : 'border-line hover:border-line-strong',
                    )}
                  >
                    <input
                      type='radio'
                      name='convert-target'
                      value={engine.id}
                      checked={active}
                      onChange={() => setSelected(engine.id)}
                      className='sr-only'
                    />
                    <span className='flex items-baseline justify-between gap-2'>
                      <span className='text-[13px] font-semibold text-ink'>{engine.label}</span>
                      <span className='font-mono text-2xs text-ink-muted'>{engine.output}</span>
                    </span>
                    <span
                      className={cx(
                        'mt-1 flex items-center gap-1 text-2xs',
                        cardStatus === 'ready'
                          ? 'text-and'
                          : cardStatus === 'warnings'
                            ? 'text-caution'
                            : cardStatus === 'blocked'
                              ? 'text-danger'
                              : 'text-ink-muted',
                      )}
                    >
                      {cardStatus === 'checking' ? (
                        <Loader2 className='h-3 w-3 animate-spin' aria-hidden />
                      ) : cardStatus === 'ready' ? (
                        <CheckCircle2 className='h-3 w-3' aria-hidden />
                      ) : cardStatus === 'warnings' ? (
                        <AlertTriangle className='h-3 w-3' aria-hidden />
                      ) : (
                        <AlertCircle className='h-3 w-3' aria-hidden />
                      )}
                      {cardStatus === 'checking'
                        ? 'checking…'
                        : cardStatus === 'ready'
                          ? 'accepts the model'
                          : cardStatus === 'warnings'
                            ? `accepts, with ${warnings} warning${warnings > 1 ? 's' : ''}`
                            : 'has problems'}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {!plan || 'error' in plan ? (
            <Section title='The model does not parse'>
              <p className='text-danger'>{plan && 'error' in plan ? plan.error : ''}</p>
            </Section>
          ) : (
            <>
              <Section title='Changes the conversion makes'>
                {plan.changes.length === 0 ? (
                  <p className='text-ink-muted'>None.</p>
                ) : (
                  <ul className='list-disc space-y-0.5 pl-5 text-ink-soft'>
                    {plan.changes.map((change) => (
                      <li key={change}>{change}</li>
                    ))}
                  </ul>
                )}
              </Section>

              {plan.blockers.length > 0 ? (
                <Section title={`What ${label} cannot read`}>
                  <Problems items={plan.blockers} />
                  <p className='mt-2 text-2xs text-ink-muted'>Convert anyway and fix them in the model, or change them in piStar mode first.</p>
                </Section>
              ) : (
                <Section title={`Checked with ${label}`}>
                  {!check || check.state === 'checking' ? (
                    <p className='flex items-center gap-2 text-ink-muted'>
                      <Loader2 className='h-4 w-4 animate-spin' aria-hidden /> Checking the converted model…
                    </p>
                  ) : check.errors.length === 0 && check.warnings.length === 0 ? (
                    <p className='flex items-center gap-2 text-and'>
                      <CheckCircle2 className='h-4 w-4' aria-hidden /> {label} accepts the model.
                    </p>
                  ) : check.errors.length === 0 ? (
                    <>
                      <p className='flex items-center gap-2 text-caution'>
                        <AlertTriangle className='h-4 w-4' aria-hidden /> {label} accepts the model, with{' '}
                        {check.warnings.length} warning{check.warnings.length > 1 ? 's' : ''}:
                      </p>
                      <ul className='space-y-1 pl-6 text-caution'>
                        {check.warnings.map((p, index) => (
                          <li key={`${p.message}-${index}`}>{p.message}</li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <>
                      <Problems items={check.errors.map((p) => p.message)} />
                      <p className='mt-2 text-2xs text-ink-muted'>Convert anyway and they show in Problems, or fix them in piStar mode first.</p>
                    </>
                  )}
                </Section>
              )}
            </>
          )}
        </div>

        <footer className='flex items-center justify-end gap-2 border-t border-line px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5'>
          <Button variant='outline' onClick={wb.cancelConversion}>
            Stay in {from}
          </Button>
          <Button
            variant='primary'
            disabled={!convertible}
            onClick={() => {
              if (plan && !('error' in plan)) wb.applyConversion(selected, plan.text);
            }}
          >
            {compatible || status === 'checking' ? `Convert to ${label}` : `Convert anyway to ${label}`}
          </Button>
        </footer>
      </div>
    </div>
  );
}

function Problems({ items }: { items: string[] }) {
  return (
    <ul className='space-y-1'>
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className='flex gap-2 text-danger'>
          <AlertCircle className='mt-0.5 h-4 w-4 shrink-0' aria-hidden /> {item}
        </li>
      ))}
    </ul>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className='space-y-1.5'>
      <h3 className='text-2xs font-semibold uppercase tracking-wider text-ink-muted'>{title}</h3>
      {children}
    </section>
  );
}
