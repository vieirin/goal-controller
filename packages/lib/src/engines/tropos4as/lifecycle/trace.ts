/**
 * A run's trace as text: one line per rule that fired, `step | goal | rule
 * | state | Γ`, under a header naming the scenario, its steps and the
 * goals. The stress test compares it with the references exactly.
 */
import type { Tropos4asModel } from '../model';
import type { LifecycleRun, TraceRow } from './run';

const line = (row: TraceRow) =>
  `${row.step} | ${row.goal} | ${row.rule} | ${row.state} | {${row.gamma.join(', ')}}`;

/** The rows of `goal` that change its state (Fig. 3's arrows): its adoption, its drop, and every rule from one state to another. */
export const stateChanges = (
  rows: readonly TraceRow[],
  goal: string,
): TraceRow[] => {
  let state: TraceRow['state'] | undefined;
  return rows.filter((row) => {
    if (row.goal !== goal || row.rule === 'outcome') return false;
    const changes = row.state !== state;
    state = row.state;
    return changes;
  });
};

/**
 * The trace's text. With `only`, the state changes of that goal alone
 * (what AAMAS 2009's Fig. 3 draws of RoomClean).
 */
export const traceText = (
  model: Tropos4asModel,
  run: LifecycleRun,
  only?: string,
): string => {
  const rows = only ? stateChanges(run.rows, only) : run.rows;
  const named = model.goals
    .concat(model.ofKind('task'))
    .map((element) => `${element.label} = ${element.name}`);
  return [
    `# scenario: ${run.scenario.label}`,
    `# steps: ${run.scenario.steps.map((step, i) => `${i + 1} ${step.label}`).join('; ')}`,
    `# elements: ${named.join(', ')}`,
    ...(only ? [`# the state changes of ${only}`] : []),
    'step | goal | rule | state | Γ',
    ...rows.map(line),
    '',
  ].join('\n');
};
