/**
 * kaosdoc's template (goal-controller#171): a KAOS model as a requirements
 * document, in Markdown, one table per concern, in the order van
 * Lamsweerde's goal-oriented requirements documents follow: the goals
 * (each with its fit criterion), their refinements, the domain properties
 * they rely on, the leaf goals as requirements and expectations, the agents
 * responsible for them, and the conflicts with their boundary conditions;
 * then, in a model with obstacle analysis (goal-controller#181), the
 * obstacles: what each obstructs and the goals resolving it, with how;
 * then, in a model with an anti-goal (van Lamsweerde ICSE'04, #212: an
 * obstacle whose Category is AntiGoal), the Threats section.
 *
 * Goals are in the order of their refinement trees (depth first, a goal
 * refining several parents once); every element is named by its text as
 * written. A goal's FormalSpec is listed as text: typing it as LTL is later
 * work (#58's typed assertions are the pattern). Hubs and obstacle Category
 * are read through their entries (goal-controller#226); an unset Anchor is
 * not written as "anchored on nowhere" (goal-controller#243).
 */
import { singleFileOutput, type EngineOutput } from '../output';
import type { KaosdocGoalModel, KaosdocNode } from './mapper';

const GOAL_KINDS = ['kaos.BehavioralGoal', 'kaos.Softgoal'] as const;
const AGENT_KINDS = ['kaos.Agent', 'kaos.EnvironmentAgent'] as const;
const KIND_LABEL: Readonly<
  Record<
    | 'kaos.BehavioralGoal'
    | 'kaos.Softgoal'
    | 'kaos.Agent'
    | 'kaos.EnvironmentAgent'
    | 'kaos.DomainProperty',
    string
  >
> = {
  'kaos.BehavioralGoal': 'Behavioral goal',
  'kaos.Softgoal': 'Softgoal',
  'kaos.Agent': 'Agent',
  'kaos.EnvironmentAgent': 'Environment agent',
  'kaos.DomainProperty': 'Domain property',
};
const OBSTACLE = 'kaosObstacles.Obstacle';
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

/** The keys across a union of property bags (a link entry's several kinds'). */
type KeysOfUnion<P> = P extends unknown ? keyof P : never;

/**
 * A key's value, '' when unset (`mapper.ts`'s `set` already trimmed it):
 * `properties` may be one of several kinds' bags (a link's), so indexing by
 * a key only some of them have needs this one cast (none has an index
 * signature; the key itself is still one of the union's, never arbitrary).
 */
const prop = <P extends Record<string, unknown>>(
  properties: P,
  key: KeysOfUnion<P> & string,
): string => (properties as Record<string, string | undefined>)[key] ?? '';

/** A node of one of these kinds (narrows `properties.engine` with it). */
const nodeIs =
  <K extends KaosdocNode['kind']>(...kinds: readonly K[]) =>
  (node: KaosdocNode): node is Extract<KaosdocNode, { kind: K }> =>
    (kinds as readonly string[]).includes(node.kind);

const isGoalNode = nodeIs(...GOAL_KINDS);
const isDomainPropertyNode = nodeIs('kaos.DomainProperty');
const isObstacleNode = nodeIs(OBSTACLE);

/** A model element of one of these kinds (narrows its `kind`). */
const elementIs =
  <K extends KaosdocGoalModel['elements'][number]['kind']>(
    ...kinds: readonly K[]
  ) =>
  (
    e: KaosdocGoalModel['elements'][number],
  ): e is Extract<KaosdocGoalModel['elements'][number], { kind: K }> =>
    (kinds as readonly string[]).includes(e.kind);

const isAgentElement = elementIs(...AGENT_KINDS);

/** The tree nodes, depth first, each once. */
const inTreeOrder = (trees: readonly KaosdocNode[]): KaosdocNode[] => {
  const seen = new Set<string>();
  const order: KaosdocNode[] = [];
  const visit = (node: KaosdocNode) => {
    if (seen.has(node.iStarId)) return;
    seen.add(node.iStarId);
    order.push(node);
    node.children?.forEach(visit);
  };
  for (const tree of trees) visit(tree);
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
  const goals = nodes.filter(isGoalNode);
  const rank = new Map(nodes.map((node, i) => [node.iStarId, i]));
  const linksOf = (kind: string) =>
    model.links.filter((link) => link.kind === kind);

  // each refinement, by its hub: what it refines, into what, its properties
  // as the hub's entry maps them (goal-controller#226)
  const ends = new Map(linksOf(END).map((link) => [link.source, link.target]));
  const refinements = model.elements
    .flatMap((hub) =>
      hub.as === 'refinement' && ends.has(hub.id)
        ? [{ id: hub.id, properties: hub.engine ?? {} }]
        : [],
    )
    .map(({ id, properties }) => ({
      parent: ends.get(id)!,
      children: linksOf(LEG)
        .filter((link) => link.target === id)
        .map((link) => link.source),
      properties,
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
      goal.kind === 'kaos.BehavioralGoal' &&
      !refinements.some((r) => r.parent === goal.iStarId),
  );
  const domainProperties = nodes.filter(isDomainPropertyNode);
  const agents = model.elements.filter(isAgentElement);
  // obstacles in their trees' order, then any no tree holds
  const obstacles = [
    ...nodes
      .filter((node) => node.type === 'obstacle')
      .map((node) => node.iStarId),
    ...model.elements
      .filter((e) => e.kind === OBSTACLE && !rank.has(e.id))
      .map((e) => e.id),
  ];
  /** an anchor, by piStar id or the id its text starts with, by its name */
  const anchorName = (anchor: string) =>
    elements.has(anchor)
      ? nameOf(anchor)
      : (model.elements.find((e) => e.name.startsWith(`${anchor}: `))?.name ??
        anchor);

  const sections: Array<[string, string]> = [
    [
      'Goals',
      table(
        ['Goal', 'Kind', 'Type', 'Category', 'Priority', 'Fit criterion'],
        goals.map(({ iStarId, properties: { engine } }) => {
          const { kind, properties } = engine;
          return [
            nameOf(iStarId),
            KIND_LABEL[kind]!,
            prop(properties, 'Type'),
            prop(properties, 'Category'),
            prop(properties, 'Priority'),
            prop(properties, 'FitCriterion'),
          ];
        }),
      ),
    ],
    [
      'Goal details',
      table(
        ['Goal', 'Source', 'Stability', 'Formal specification', 'Issue'],
        goals
          .map(({ iStarId, properties: { engine } }) => [
            nameOf(iStarId),
            ...(['Source', 'Stability', 'FormalSpec', 'Issue'] as const).map(
              (key) => prop(engine.properties, key),
            ),
          ])
          .filter(([, ...details]) => details.some(Boolean)),
      ),
    ],
    [
      'Refinements',
      table(
        ['Goal', 'Refined into', 'Alternative', 'Tactic', 'Status', 'System'],
        refinements.map(({ parent, children, properties }) => {
          const n = (nth.get(parent) ?? 0) + 1;
          nth.set(parent, n);
          const of = alternatives(parent);
          return [
            nameOf(parent),
            children.map(nameOf).join(', '),
            of > 1 ? `${n} of ${of}` : '',
            prop(properties, 'Tactic'),
            prop(properties, 'Status'),
            prop(properties, 'SysRef'),
          ];
        }),
      ),
    ],
    [
      'Domain properties',
      table(
        ['Domain property', 'Description', 'In the refinement of'],
        domainProperties.map((property) => [
          nameOf(property.iStarId),
          prop(property.properties.engine.properties, 'Description'),
          refinements
            .filter((r) => r.children.includes(property.iStarId))
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
  // an anti-goal (van Lamsweerde ICSE'04, #212): an obstacle whose Category
  // is AntiGoal, riding on the obstacle machinery (#196 D2, logged on #189
  // and frameworks.md's "KAOS stress test, step 8: anti-models"); a leaf's
  // responsible agent (`kaos.ResponsibilityAssignment`, extended here to an
  // obstacle source, same link kind the goal side uses) tells an
  // anti-requirement (the attacker's own) from a vulnerability (the
  // attackee's), the same way "Requirements and expectations" tells a
  // requirement from an expectation
  const antiGoals = obstacles.filter((id) => {
    const obstacleNode = nodes.find(
      (node): node is Extract<KaosdocNode, { kind: typeof OBSTACLE }> =>
        isObstacleNode(node) && node.iStarId === id,
    );
    return (
      !!obstacleNode &&
      prop(obstacleNode.properties.engine.properties, 'Category') === 'AntiGoal'
    );
  });
  if (antiGoals.length)
    sections.push([
      'Threats',
      table(
        ['Anti-goal', 'Obstructs', 'Assigned to', 'As'],
        antiGoals.map((id) => {
          const responsible = agentsOf(id);
          const malicious = new Set(
            responsible.map((agent) => {
              const element = elements.get(agent);
              return (
                !!element &&
                isAgentElement(element) &&
                prop(element.engine?.properties ?? {}, 'Type') === 'malicious'
              );
            }),
          );
          return [
            nameOf(id),
            linksOf('kaosObstacles.ObstructionLink')
              .filter((link) => link.source === id)
              .map((link) => nameOf(link.target))
              .join(', '),
            responsible.map(nameOf).join(', '),
            responsible.length === 0
              ? 'anti-goal'
              : malicious.size > 1
                ? 'shared'
                : malicious.has(true)
                  ? 'anti-requirement'
                  : 'vulnerability',
          ];
        }),
      ),
    ]);
  // only a model with obstacles has the section (DSM3's KAOS has none)
  if (obstacles.length)
    sections.push([
      'Obstacles',
      table(
        ['Obstacle', 'Category', 'Obstructs', 'Resolved by', 'Resolution'],
        obstacles.map((id) => {
          const resolutions = linksOf('kaosObstacles.ResolutionLink').filter(
            (link) => link.target === id,
          );
          const obstacleNode = nodes.find(
            (node): node is Extract<KaosdocNode, { kind: typeof OBSTACLE }> =>
              isObstacleNode(node) && node.iStarId === id,
          );
          const category = obstacleNode
            ? prop(obstacleNode.properties.engine.properties, 'Category')
            : '';
          return [
            nameOf(id),
            category,
            linksOf('kaosObstacles.ObstructionLink')
              .filter((link) => link.source === id)
              .map((link) => nameOf(link.target))
              .join(', '),
            resolutions.map((link) => nameOf(link.source)).join(', '),
            resolutions
              .map(({ properties: { engine } }) => {
                const type = prop(engine, 'ResolutionType');
                const anchor = prop(engine, 'Anchor');
                // #243: an unset Anchor writes only the type (no "anchored on nowhere")
                return anchor
                  ? `${type || 'unspecified'}, anchored on ${anchorName(anchor)}`
                  : type;
              })
              .join('; '),
          ];
        }),
      ),
    ]);
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
