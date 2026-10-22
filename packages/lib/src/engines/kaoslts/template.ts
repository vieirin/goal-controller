/**
 * kaoslts's files (goal-controller#209): the system's FSP (primary), one
 * FSP file per agent, and the completeness report. Each FSP file stands
 * alone, as LTSA reads one file: its fluents, its processes and its
 * composition. The system's is every agent's, composed (ASE'08 §4, step
 * 5), with the requirements as `assert`s; an agent's, the processes it is
 * composed of.
 */
import { outputBaseName, type EngineOutput } from '../output';
import {
  operationalisationCompleteness,
  type CompletenessVerdict,
} from './completeness';
import { ltsModel, type FspDefinition, type LtsModel } from './fsp';
import type { KaosltsGoalModel } from './mapper';
import { operationModelOf, type OperationModel } from './operations';

/** Lines, each with the model elements it belongs to. */
class Lines {
  readonly text: string[] = [];
  readonly owners: string[][] = [];
  add(line: string, owners: readonly string[] = []) {
    this.text.push(line);
    this.owners.push([...owners]);
  }
  definition({ lines, owners }: FspDefinition) {
    for (const line of lines) this.add(line, owners);
  }
  blank() {
    if (this.text.length && this.text.at(-1) !== '') this.add('');
  }
}

/** The system's name in the FSP: its composition. */
export const SYSTEM_PROCESS = 'System';

const header = (lines: Lines, title: string, what: string) => {
  lines.add(`// ${title}: ${what}`);
  lines.add(
    "// kaoslts: KAOS2LTSA's derivation (Letier, Kramer, Magee and Uchitel, ASE'08 §4)",
  );
  lines.blank();
};

const fluentLines = (lines: Lines, lts: LtsModel) => {
  lines.add('// step 2: fluents, from the operations’ domain postconditions');
  for (const fluent of lts.fluents) {
    const set = (events: readonly string[]) =>
      events.length === 1 ? events[0]! : `{${events.join(', ')}}`;
    lines.add(
      `fluent ${fluent.name} = <${set(fluent.initiating)}, ${set(fluent.terminating)}>${fluent.initially ? ' initially 1' : ''}`,
      [fluent.variable.object],
    );
  }
  lines.blank();
};

/** An agent's processes, then its composition. */
const agentLines = (
  lines: Lines,
  name: string,
  owner: string | null,
  {
    constraints,
    processes,
  }: Pick<LtsModel['shared'], 'constraints' | 'processes'>,
) => {
  for (const process of processes) lines.definition(process);
  for (const constraint of constraints) lines.definition(constraint);
  const parts = [...processes, ...constraints].map((d) => d.name);
  if (parts.length)
    lines.add(
      `minimal ||${name} = (${parts.join(' || ')}).`,
      owner ? [owner] : [],
    );
  lines.blank();
};

const notesLines = (lines: Lines, notes: readonly string[]) => {
  if (!notes.length) return;
  lines.add('// not translated:');
  for (const note of notes) lines.add(`//   ${note}`);
  lines.blank();
};

/** The system's FSP: every agent, composed, and the requirements to check. */
const systemFile = (lts: LtsModel, title: string): Lines => {
  const lines = new Lines();
  header(lines, title, 'the system, its agents composed');
  notesLines(lines, lts.notes);
  fluentLines(lines, lts);
  const parts: string[] = [];
  for (const agent of lts.agents) {
    if (!agent.constraints.length && !agent.processes.length) continue;
    lines.add(`// ${agent.name}`, [agent.id]);
    agentLines(lines, agent.name, agent.id, agent);
    parts.push(agent.name);
  }
  if (lts.shared.constraints.length || lts.shared.processes.length) {
    lines.add('// no one agent performs these');
    for (const process of lts.shared.processes) lines.definition(process);
    for (const constraint of lts.shared.constraints)
      lines.definition(constraint);
    parts.push(
      ...[...lts.shared.processes, ...lts.shared.constraints].map(
        (d) => d.name,
      ),
    );
    lines.blank();
  }
  if (parts.length) {
    lines.add('// step 5: the system');
    lines.add(`||${SYSTEM_PROCESS} = (${parts.join(' || ')}).`);
    lines.blank();
  }
  if (lts.asserts.length) {
    lines.add(
      '// the requirements, synchronous in KAOS, encoded with ticks (ASE’08 §2.2.3)',
    );
    for (const assertion of lts.asserts) lines.definition(assertion);
    lines.blank();
  }
  return lines;
};

const agentFile = (
  lts: LtsModel,
  agent: LtsModel['agents'][number],
  title: string,
): Lines => {
  const lines = new Lines();
  header(lines, title, `the agent ${agent.name}`);
  fluentLines(lines, lts);
  agentLines(lines, agent.name, agent.id, agent);
  return lines;
};

/** The completeness report: each operationalised requirement's verdict. */
export const completenessReport = (
  model: OperationModel,
  verdicts: readonly CompletenessVerdict[],
  title: string,
): string => {
  const nameOf = (id: string) =>
    model.requirements.find((r) => r.id === id)?.name ?? id;
  const cell = (text: string) => text.replace(/\|/g, '\\|');
  const rows = verdicts.map((verdict) => {
    const detail =
      verdict.status === 'complete'
        ? verdict.pattern
        : verdict.status === 'incomplete'
          ? `${verdict.pattern}: ${verdict.problems.map((p) => p.message).join('; ')}`
          : verdict.reason;
    return `| ${cell(nameOf(verdict.requirement))} | ${verdict.status} | ${cell(detail)} |`;
  });
  return [
    `# ${title}: completeness of the operationalisations`,
    '',
    "Each operationalised requirement's required conditions against its formal definition (FSE'02, Definition 3, condition 1), decided for Immediate Achieve (C ⇒ ○T, FSE'02 Fig. 1); any other is undecided.",
    '',
    ...(rows.length
      ? ['| Requirement | Verdict | Detail |', '| --- | --- | --- |', ...rows]
      : ['No requirement is operationalised.']),
    '',
  ].join('\n');
};

const text = (lines: Lines) => `${lines.text.join('\n').trimEnd()}\n`;

/** kaoslts's files for a KAOS model's IR (`kaosltsGoalModel`). */
export const kaosltsOutput = (
  goalModel: KaosltsGoalModel,
  { modelName }: { modelName: string },
): EngineOutput => {
  const base = outputBaseName(modelName);
  const model = operationModelOf(goalModel);
  const lts = ltsModel(model);
  const system = systemFile(lts, base);
  return {
    files: [
      {
        id: 'system',
        fileName: `${base}.lts`,
        text: text(system),
        language: 'text',
        primary: true,
        owners: system.owners,
      },
      ...lts.agents
        .filter((agent) => agent.constraints.length || agent.processes.length)
        .map((agent) => {
          const lines = agentFile(lts, agent, base);
          return {
            id: `agent-${agent.id}`,
            fileName:
              agent.name === base
                ? `${agent.name}-agent.lts`
                : `${agent.name}.lts`,
            text: text(lines),
            language: 'text',
            owners: lines.owners,
          };
        }),
      {
        id: 'completeness',
        fileName: `${base}.completeness.md`,
        text: completenessReport(
          model,
          operationalisationCompleteness(model),
          base,
        ),
        language: 'text',
      },
    ],
  };
};
