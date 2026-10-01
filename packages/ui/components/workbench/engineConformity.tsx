'use client';

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { TransformEngine } from '@/lib/types';
import { treeProblems } from '@/lib/workbench/localProblems';
import { planConversion, type Conversion } from '@/lib/workbench/pistar';
import type { AnalyzeResponse, Problem } from '@/lib/workbench/types';
import { analyze, treeView } from '@/services';
import { cx } from './ui';

export const ENGINES: Array<{
  id: TransformEngine;
  label: string;
  output: string;
}> = [
  { id: 'edgev2', label: 'EdgeV2', output: 'PRISM' },
  { id: 'edge', label: 'Edge', output: 'PRISM' },
  { id: 'sleec', label: 'SLEEC', output: 'SLEEC' },
];
export const ENGINE_LABEL = Object.fromEntries(
  ENGINES.map((e) => [e.id, e.label]),
) as Record<TransformEngine, string>;

export type Plan = Conversion | { error: string };
export type Check =
  | { state: 'checking' }
  | { state: 'done'; errors: Problem[]; warnings: Problem[] };
export type Status = 'checking' | 'ready' | 'warnings' | 'blocked';

/** The workbench's own model checks, on the view read with the engine's grammar. */
const localProblems = (text: string, engine: TransformEngine): Problem[] => {
  try {
    return treeProblems(treeView(text, engine), engine);
  } catch {
    return [];
  }
};

/**
 * How well a model conforms to each engine: the conversion each would need (automatic
 * fixes, what it cannot read) and whether the engine accepts the converted model. The
 * model text is read once (when the hook mounts); `skip` holds the engine checks back.
 */
export function useEngineConformity(
  text: string,
  engines: readonly TransformEngine[],
  skip = false,
) {
  const plans = useMemo(() => {
    const result = {} as Record<TransformEngine, Plan>;
    for (const id of engines) {
      try {
        result[id] = planConversion(text, id);
      } catch (error) {
        result[id] = {
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
    return result;
    // the plans are for the model as it was when the dialog opened
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engines.join()]);
  const [checks, setChecks] = useState<Partial<Record<TransformEngine, Check>>>(
    {},
  );

  useEffect(() => {
    if (skip) return;
    for (const id of engines) {
      const plan = plans[id];
      if (!plan || 'error' in plan || plan.blockers.length > 0) continue;
      setChecks((prev) => ({ ...prev, [id]: { state: 'checking' } }));
      try {
        const data: AnalyzeResponse = analyze(plan.text, id);
        const all: Problem[] = [
          ...data.problems,
          ...localProblems(plan.text, id),
        ];
        setChecks((prev) => ({
          ...prev,
          [id]: {
            state: 'done',
            errors: all.filter((p) => p.severity === 'error'),
            warnings: all.filter((p) => p.severity === 'warning'),
          },
        }));
      } catch (error) {
        setChecks((prev) => ({
          ...prev,
          [id]: {
            state: 'done',
            errors: [
              {
                severity: 'error',
                source: 'engine',
                message: `Could not check the model: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            warnings: [],
          },
        }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plans, skip]);

  const statusOf = (id: TransformEngine): Status => {
    const plan = plans[id];
    if (!plan || 'error' in plan || plan.blockers.length > 0) return 'blocked';
    const check = checks[id];
    if (!check || check.state === 'checking') return 'checking';
    if (check.errors.length > 0) return 'blocked';
    return check.warnings.length > 0 ? 'warnings' : 'ready';
  };
  const warningsOf = (id: TransformEngine): number => {
    const check = checks[id];
    return check?.state === 'done' ? check.warnings.length : 0;
  };
  return { plans, checks, statusOf, warningsOf };
}

/** One line on an engine card: checking / accepts / accepts with warnings / has problems. */
export function ConformityStatus({
  status,
  warnings,
}: {
  status: Status;
  warnings: number;
}) {
  return (
    <span
      className={cx(
        'mt-1 flex items-center gap-1 text-2xs',
        status === 'ready'
          ? 'text-and'
          : status === 'warnings'
            ? 'text-caution'
            : status === 'blocked'
              ? 'text-danger'
              : 'text-ink-muted',
      )}
    >
      {status === 'checking' ? (
        <Loader2 className='h-3 w-3 animate-spin' aria-hidden />
      ) : status === 'ready' ? (
        <CheckCircle2 className='h-3 w-3' aria-hidden />
      ) : status === 'warnings' ? (
        <AlertTriangle className='h-3 w-3' aria-hidden />
      ) : (
        <AlertCircle className='h-3 w-3' aria-hidden />
      )}
      {status === 'checking'
        ? 'checking…'
        : status === 'ready'
          ? 'accepts the model'
          : status === 'warnings'
            ? `accepts, with ${warnings} warning${warnings > 1 ? 's' : ''}`
            : 'has problems'}
    </span>
  );
}
