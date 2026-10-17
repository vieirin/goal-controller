/**
 * kaosdoc's template (goal-controller#171): a KAOS model as a requirements
 * document, in Markdown, one table per concern, in the order van
 * Lamsweerde's goal-oriented requirements documents follow: the goals
 * (each with its fit criterion), their refinements, the domain properties
 * they rely on, the leaf goals as requirements and expectations, the agents
 * responsible for them, and the conflicts with their boundary conditions.
 *
 * Goals are in the order of their refinement trees (depth first, a goal
 * refining several parents once); every element is named by its text as
 * written. A goal's FormalSpec is listed as text: typing it as LTL is later
 * work (#58's typed assertions are the pattern).
 */
import type { GoalNode, TreeNode } from '@goal-controller/goal-tree';
import { KAOS_REFINEMENT_HUB } from '@istar-ts/dsm3-kaos/metamodel';
import { singleFileOutput, type EngineOutput } from '../output';
import type {
  KaosdocGoalModel,
  KaosdocNodeProps,
  KaosdocProperties,
} from './mapper';

const GOAL_KINDS = new Set(['kaos.BehavioralGoal', 'kaos.Softgoal']);
const AGENT_KINDS = new Set(['kaos.Agent', 'kaos.EnvironmentAgent']);
const KIND_LABEL: Readonly<Record<string, string>> = {
  'kaos.BehavioralGoal': 'Behavioral goal',
  'kaos.Softgoal': 'Softgoal',
  'kaos.Agent': 'Agent',
  'kaos.EnvironmentAgent': 'Environment agent',
  'kaos.DomainProperty': 'Domain property',
};
/** an n-ary refinement's legs (sub-goal to hub) and end (hub to goal), as core generates them */
const LEG = 'kaos.RefinementLinkStart';
const END = 'kaos.RefinementLinkEnd';

/** A table cell: one line, its pipes escaped. */
const cell = (text: string | undefined): string =>
  (text ?? '').trim().replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');

/** A Markdown table, or `None.` without rows. */
const table = (head: readonly string[], rows: readonly string[][]): string =>
  rows.length === 0
    ? 'None.'
    : [
        `| ${head.join(' | ')} |`,
        `| ${head.map(() => '---').join(' | ')} |`,
        ...rows.map((row) => `| ${row.map(cell).join(' | ')} |`),
      ].join('\n');

/** The goal nodes of the trees, depth first, each once. */
const inTreeOrder = (
  trees: readonly TreeNode<KaosdocNodeProps>[],
): GoalNode<KaosdocNodeProps>[] => {
  const seen = new Set<string>();
  const order: GoalNode<KaosdocNodeProps>[] = [];
  const visit = (node: GoalNode<KaosdocNodeProps>) => {
    if (seen.has(node.iStarId)) return;
    seen.add(node.iStarId);
    order.push(node);
    node.children?.forEach(visit);
  };
  for (const tree of trees) if (tree.type === 'goal') visit(tree);
  return order;
};

/** The requirements document of a KAOS model (`kaosdocGoalModel`), titled after it. */
export const kaosdocDocument = (
  model: KaosdocGoalModel,
  { title }: { title: string },
): string => {
  const elements = new Map(model.elements.map((e) => [e.id, e]));
  const nameOf = (id: string) => elements.get(id)?.name.trim() ?? id;
  const nodes = inTreeOrder(model.paper);
  const goals = nodes.filter((node) =>
    GOAL_KINDS.has(node.properties.engine.kind),
  );
  const rank = new Map(nodes.map((node, i) => [node.iStarId, i]));
  const linksOf = (kind: string) =>
    model.links.filter((link) => link.kind === kind);
  const prop = (properties: KaosdocProperties, key: string) =>
    properties[key] ?? '';

  // each refinement, by its hub: what it refines, into what, its properties
  const ends = new Map(linksOf(END).map((link) => [link.source, link.target]));
  const refinements = model.elements
    .filter((e) => e.kind === KAOS_REFINEMENT_HUB && ends.has(e.id))
    .map((hub) => ({
      hub,
      parent: ends.get(hub.id)!,
      children: linksOf(LEG)
        .filter((link) => link.target === hub.id)
        .map((link) => link.source),
    }))
    .sort((a, b) => (rank.get(a.parent) ?? 0) - (rank.get(b.parent) ?? 0));
  const alternatives = (parent: string) =>
    refinements.filter((r) => r.parent === parent).length;
  const nth = new Map<string, number>();

  const assignments = linksOf('kaos.ResponsibilityAssignment');
  const agentsOf = (goal: string) =>
    assignments.filter((a) => a.target === goal).map((a) => a.source);
  const leaves = goals.filter(
    (goal) =>
      goal.properties.engine.kind === 'kaos.BehavioralGoal' &&
      !refinements.some((r) => r.parent === goal.iStarId),
  );
  const domainProperties = model.elements.filter(
    (e) => e.kind === 'kaos.DomainProperty',
  );
  const agents = model.elements.filter((e) => AGENT_KINDS.has(e.kind));

  const sections: Array<[string, string]> = [
    [
      'Goals',
      table(
        ['Goal', 'Kind', 'Type', 'Category', 'Priority', 'Fit criterion'],
        goals.map(({ iStarId, properties: { engine } }) => [
          nameOf(iStarId),
          KIND_LABEL[engine.kind]!,
          prop(engine.properties, 'Type'),
          prop(engine.properties, 'Category'),
          prop(engine.properties, 'Priority'),
          prop(engine.properties, 'FitCriterion'),
        ]),
      ),
    ],
    [
      'Goal details',
      table(
        ['Goal', 'Source', 'Stability', 'Formal specification', 'Issue'],
        goals
          .map(({ iStarId, properties: { engine } }) => [
            nameOf(iStarId),
            ...['Source', 'Stability', 'FormalSpec', 'Issue'].map((key) =>
              prop(engine.properties, key),
            ),
          ])
          .filter(([, ...details]) => details.some(Boolean)),
      ),
    ],
    [
      'Refinements',
      table(
        ['Goal', 'Refined into', 'Alternative', 'Tactic', 'Status', 'System'],
        refinements.map(({ hub, parent, children }) => {
          const n = (nth.get(parent) ?? 0) + 1;
          nth.set(parent, n);
          const of = alternatives(parent);
          return [
            nameOf(parent),
            children.map(nameOf).join(', '),
            of > 1 ? `${n} of ${of}` : '',
            prop(hub.properties, 'Tactic'),
            prop(hub.properties, 'Status'),
            prop(hub.properties, 'SysRef'),
          ];
        }),
      ),
    ],
    [
      'Domain properties',
      table(
        ['Domain property', 'Description', 'In the refinement of'],
        domainProperties.map((property) => [
          property.name,
          prop(property.properties, 'Description'),
          refinements
            .filter((r) => r.children.includes(property.id))
            .map((r) => nameOf(r.parent))
            .join(', '),
        ]),
      ),
    ],
    [
      'Requirements and expectations',
      table(
        ['Goal', 'Assigned to', 'As'],
        leaves.map(({ iStarId }) => {
          const responsible = agentsOf(iStarId);
          const kinds = new Set(
            responsible.map((agent) => elements.get(agent)?.kind),
          );
          return [
            nameOf(iStarId),
            responsible.map(nameOf).join(', '),
            responsible.length === 0
              ? 'unassigned'
              : kinds.size === 1 && kinds.has('kaos.EnvironmentAgent')
                ? 'expectation'
                : kinds.size === 1 && kinds.has('kaos.Agent')
                  ? 'requirement'
                  : 'shared',
          ];
        }),
      ),
    ],
    [
      'Agents',
      table(
        ['Agent', 'Kind', 'Responsible for'],
        agents.map((agent) => [
          agent.name,
          KIND_LABEL[agent.kind]!,
          assignments
            .filter((a) => a.source === agent.id)
            .map((a) => nameOf(a.target))
            .join(', '),
        ]),
      ),
    ],
    [
      'Conflicts',
      table(
        ['Between', 'And', 'Boundary condition'],
        linksOf('kaos.Conflict').map((link) => [
          nameOf(link.source),
          nameOf(link.target),
          prop(link.properties.engine, 'BoundaryCondition'),
        ]),
      ),
    ],
  ];
  return [
    `# Requirements document: ${title}`,
    '',
    'Generated from its KAOS goal model.',
    ...sections.flatMap(([heading, body]) => ['', `## ${heading}`, '', body]),
    '',
  ].join('\n');
};

/** kaosdoc's output: the document, one Markdown file named after the model. */
export const kaosdocOutput = (
  model: KaosdocGoalModel,
  { modelName }: { modelName: string },
): EngineOutput =>
  singleFileOutput({
    id: 'document',
    modelName,
    extension: 'md',
    language: 'text',
    text: kaosdocDocument(model, { title: modelName.replace(/\.[^.]*$/, '') }),
  });
