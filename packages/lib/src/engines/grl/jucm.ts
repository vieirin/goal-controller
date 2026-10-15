/**
 * A GRL model as jUCMNav's `.jucm` (goal-controller#144 item 1): the piStar
 * model and its `strategies` resource written back as the EMF XMI 2.0 that
 * jUCMNav opens and evaluates, the inverse of the importer
 * (importers/jucm). One GRL graph draws everything, at the model's
 * positions; each element, actor, link and strategy keeps its id when it is
 * one jUCMNav keeps (a number), and the drawings' ids follow the largest.
 * Each value is written as the evaluation reads it (./evaluation/graph), so
 * jUCMNav evaluates the file to what the model evaluates to; EMF's defaults
 * are not written, as EMF doesn't.
 */
import type {
  NativeDiagnostic,
  NativeFileContext,
  NativeWriteResult,
  PistarJson,
} from '@goal-controller/dialect';
import { STRATEGIES_RESOURCE } from '../../importers/jucm';
import type { GrlElementType } from '../../importers/jucm/xmi';
import { readXml, type XmlElement } from '../../formats/xml';
import {
  writeXmi,
  writeXmlTree,
  type XmiWriteNode,
  type XmlTree,
} from '../../importers/xmi';
import { CONTRIBUTION_OF_LABEL, integer, pick } from './evaluation/graph';
import { readStrategyGroups } from './strategies';
import {
  GRL_CONTRIBUTIONS,
  GRL_DECOMPOSITIONS,
  GRL_IMPORTANCES,
  type GrlDecomposition,
} from './vocabulary';

/**
 * What the format can't carry, as piStar paths (#143's `lossy`): the
 * diagram's extent (the importer computes it from the positions) and the
 * actors' display (a box is always written, so an actor without one comes
 * back with one). What can't be written at all is the writer's
 * diagnostics; what a `.jucm` holds that the model doesn't keep is the
 * engine doc's (packages/dialect/docs/grl.md, Native file).
 */
export const JUCM_LOSSY = ['diagram.width', 'diagram.height', 'display'];

/** jUCMNav's namespaces, as it declares them */
const NAMESPACES = {
  grl: 'http:///grl.ecore',
  'grl.kpimodel': 'http:///grl/kpimodel.ecore',
  urn: 'http:///urn.ecore',
};

type Json = Record<string, any>;
type Attribute = [string, string | number | undefined];

/**
 * An element as `writeXmi` takes it: its `xsi:type` apart, the other
 * attributes in EMF's feature order, an undefined one (its default) left out.
 */
const tag = (
  feature: string,
  attributes: Attribute[],
  children: XmiWriteNode[] = [],
): XmiWriteNode => {
  const type = attributes.find(([name]) => name === 'xsi:type')?.[1];
  return {
    feature,
    ...(type !== undefined && { type: String(type) }),
    attributes: Object.fromEntries(
      attributes.filter(([name]) => name !== 'xsi:type'),
    ),
    children,
  };
};

/** The GRL type each kind is written as; a belief is a diagram node, not an element. */
const TYPE_OF_KIND: Readonly<Record<string, GrlElementType>> = {
  'istar.Quality': 'Softgoal',
  'istar.Goal': 'Goal',
  'istar.Task': 'Task',
  'istar.Resource': 'Ressource',
  'grl.Indicator': 'Indicator',
};
const BELIEF = 'grl.Belief';
const ACTOR_KINDS = new Set(['istar.Actor', 'istar.Role', 'istar.Agent']);

/** The element properties GRL keeps; what else a node has, the format can't. */
const GRL_PROPERTIES = new Set([
  'Description',
  'importance',
  'importanceQuantitative',
  'decompositionType',
]);

/** a jUCMNav id: a number as `Long.parseLong` reads it and jUCMNav writes it, short enough to count with */
const isJucmId = (id: string) => /^(0|[1-9]\d{0,14})$/.test(id);

const ints = (ids: readonly string[]) =>
  ids.length ? ids.join(' ') : undefined;

/** an int attribute: undefined (EMF's default, not written) when it is the default */
const unlessDefault = <T>(value: T, fallback: T) =>
  value === fallback ? undefined : value;

/**
 * A GRL piStar model (and its strategies, the context's `strategies`
 * resource) as a `.jucm`, with what the format couldn't carry. Never
 * without a text: a GRL model is always one GRL file.
 */
export const writeJucm = (
  pistar: PistarJson,
  { projectResources = {} }: Pick<NativeFileContext, 'projectResources'> = {},
): NativeWriteResult & { text: string } => {
  const model = pistar as Json;
  const diagnostics: NativeDiagnostic[] = [];
  const warn = (message: string) =>
    diagnostics.push({ severity: 'warning', message });
  const info = (message: string) =>
    diagnostics.push({ severity: 'info', message });

  const actors: Json[] = model.actors ?? [];
  const nodes: Json[] = [
    ...actors.flatMap((actor) => actor.nodes ?? []),
    ...(model.orphans ?? []),
    ...(model.dependencies ?? []),
  ];
  const actorOf = new Map<string, Json>();
  for (const actor of actors)
    for (const node of actor.nodes ?? []) actorOf.set(node.id, actor);
  const elements = nodes.filter((node) => {
    if (node.type in TYPE_OF_KIND || node.type === BELIEF) return true;
    warn(
      `node ${node.id} is a ${node.type}, which GRL has no element for: not written`,
    );
    return false;
  });
  const intentional = elements.filter((node) => node.type !== BELIEF);
  const beliefs = elements.filter((node) => node.type === BELIEF);
  const written = new Set(elements.map((node) => node.id as string));

  // the links GRL has, and its belief links (a drawing's, without an id)
  const links: Json[] = [];
  const beliefLinks: Json[] = [];
  for (const link of model.links ?? []) {
    if (!written.has(link.source) || !written.has(link.target)) {
      warn(`link ${link.id} joins a node that is not written: not written`);
      continue;
    }
    switch (link.type) {
      case 'istar.AndRefinementLink':
      case 'istar.OrRefinementLink':
      case 'istar.DependencyLink':
      case 'istar.ContributionLink':
        links.push(link);
        break;
      case 'grl.BeliefLink':
        beliefLinks.push(link);
        break;
      default:
        warn(
          `link ${link.id} is a ${link.type}, which GRL has no link for: not written`,
        );
    }
  }

  const { groups, diagnostics: strategyDiagnostics } = readStrategyGroups(
    Object.entries(projectResources[STRATEGIES_RESOURCE] ?? {}).map(
      ([path, text]) => ({ path, text }),
    ),
  );
  for (const d of strategyDiagnostics)
    diagnostics.push({
      severity: d.severity,
      message: `${d.path}: ${d.message}`,
    });
  const strategies = groups.flatMap((group) => group.strategies);

  // ids: a model's numeric ids kept, the others (and a repeated one) the next free ones
  const taken = new Set<string>();
  const renumber = new Map<string, string>();
  let next =
    Math.max(
      0,
      ...[...actors, ...intentional, ...beliefs, ...links, ...strategies]
        .map((item) => String(item.id))
        .filter(isJucmId)
        .map(Number),
    ) + 1;
  const fresh = () => {
    while (taken.has(String(next))) next++;
    const id = String(next++);
    taken.add(id);
    return id;
  };
  const keep = (id: string, what: string) => {
    if (isJucmId(id) && !taken.has(id)) {
      taken.add(id);
      return id;
    }
    const given = fresh();
    renumber.set(`${what}:${id}`, given);
    return given;
  };
  const elementId = new Map<string, string>();
  for (const node of [...intentional, ...beliefs])
    elementId.set(node.id, keep(node.id, 'node'));
  const actorId = new Map<string, string>();
  for (const actor of actors) actorId.set(actor.id, keep(actor.id, 'actor'));
  const linkId = new Map<string, string>();
  for (const link of links) linkId.set(link.id, keep(link.id, 'link'));
  const strategyId = new Map<string, string>();
  for (const strategy of strategies)
    if (strategyId.has(strategy.id))
      warn(`strategy ${strategy.id} is defined twice: the first is written`);
    else strategyId.set(strategy.id, keep(strategy.id, 'strategy'));
  if (renumber.size)
    info(
      `${renumber.size} id(s) are not jUCMNav's (a number, once): renumbered (${[...renumber].map(([from, to]) => `${from.slice(from.indexOf(':') + 1)} → ${to}`).join(', ')})`,
    );
  // the drawings: the diagram, an ActorRef per actor, a ref per element and belief, a group's id
  const diagramId = fresh();
  const actorRefId = new Map(
    actors.map((actor) => [actor.id as string, fresh()]),
  );
  // a belief is its diagram node (the importer reads its id from there)
  const nodeRefId = new Map([
    ...intentional.map((node): [string, string] => [node.id, fresh()]),
    ...beliefs.map((node): [string, string] => [
      node.id,
      elementId.get(node.id)!,
    ]),
  ]);
  const groupId = groups.map(() => fresh());

  // decompositions: an element's property (Xor), else its refinement links' kind, else And
  const refinementKind = new Map<string, GrlDecomposition>();
  for (const link of links)
    if (!refinementKind.has(link.target))
      if (link.type === 'istar.AndRefinementLink')
        refinementKind.set(link.target, 'And');
      else if (link.type === 'istar.OrRefinementLink')
        refinementKind.set(link.target, 'Or');
  // a GRL link's ends: a dependency's src is iStar's target (the dependee's side)
  const ends = (link: Json) =>
    link.type === 'istar.DependencyLink'
      ? { src: link.target as string, dest: link.source as string }
      : { src: link.source as string, dest: link.target as string };
  const linksSrc = new Map<string, string[]>();
  const linksDest = new Map<string, string[]>();
  for (const link of links) {
    const { src, dest } = ends(link);
    linksSrc.set(src, [...(linksSrc.get(src) ?? []), linkId.get(link.id)!]);
    linksDest.set(dest, [...(linksDest.get(dest) ?? []), linkId.get(link.id)!]);
  }

  const unkept = new Set<string>();
  const intElements = intentional.map((node) => {
    const properties: Json = node.customProperties ?? {};
    for (const key of Object.keys(properties))
      if (!GRL_PROPERTIES.has(key)) unkept.add(key);
    const type = TYPE_OF_KIND[node.type]!;
    const decomposition = pick(
      properties.decompositionType,
      GRL_DECOMPOSITIONS,
      refinementKind.get(node.id) ?? 'And',
    );
    return tag('intElements', [
      ['xsi:type', type === 'Indicator' ? 'grl.kpimodel:Indicator' : undefined],
      ['name', node.text ?? ''],
      ['id', elementId.get(node.id)],
      ['description', properties.Description || undefined],
      ['linksDest', ints(linksDest.get(node.id) ?? [])],
      ['linksSrc', ints(linksSrc.get(node.id) ?? [])],
      ['type', unlessDefault(type, 'Softgoal')],
      ['refs', nodeRefId.get(node.id)],
      ['decompositionType', unlessDefault(decomposition, 'And')],
      [
        'importance',
        unlessDefault(
          pick(properties.importance, GRL_IMPORTANCES, 'None'),
          'None',
        ),
      ],
      [
        'importanceQuantitative',
        unlessDefault(integer(properties.importanceQuantitative, 0), 0),
      ],
    ]);
  });
  if (unkept.size)
    info(
      `element properties GRL doesn't have are not written: ${[...unkept].sort().join(', ')}`,
    );

  const actorTags = actors.map((actor) => {
    if (actor.type !== 'istar.Actor')
      info(
        `actor ${actor.id} is a ${ACTOR_KINDS.has(actor.type) ? actor.type : 'node'}: written as a GRL actor`,
      );
    const properties: Json = actor.customProperties ?? {};
    return tag('actors', [
      ['name', actor.text ?? ''],
      ['id', actorId.get(actor.id)],
      ['contRefs', actorRefId.get(actor.id)],
      [
        'importance',
        unlessDefault(
          pick(properties.importance, GRL_IMPORTANCES, 'None'),
          'None',
        ),
      ],
      [
        'importanceQuantitative',
        unlessDefault(integer(properties.importanceQuantitative, 0), 0),
      ],
    ]);
  });

  const linkTags = links.map((link) => {
    const id = linkId.get(link.id)!;
    const { src, dest } = ends(link);
    const common: Attribute[] = [
      ['id', id],
      ['dest', elementId.get(dest)],
      ['src', elementId.get(src)],
    ];
    if (link.type !== 'istar.ContributionLink') {
      const kind =
        link.type === 'istar.DependencyLink' ? 'Dependency' : 'Decomposition';
      return tag('links', [
        ['xsi:type', `grl:${kind}`],
        ['name', `${kind}${id}`],
        ...common,
      ]);
    }
    const properties: Json = link.customProperties ?? {};
    return tag('links', [
      ['xsi:type', 'grl:Contribution'],
      ['name', `Contribution${id}`],
      ...common,
      [
        'contribution',
        unlessDefault(
          pick(
            properties.contribution,
            GRL_CONTRIBUTIONS,
            CONTRIBUTION_OF_LABEL[link.label ?? ''] ?? 'Help',
          ),
          'Help',
        ),
      ],
      [
        'quantitativeContribution',
        unlessDefault(integer(properties.quantitativeContribution, 25), 25),
      ],
      ['correlation', properties.correlation === 'true' ? 'true' : undefined],
    ]);
  });

  // strategies: a group per file, its evaluations as the file has them
  const ranges = new Set(groups.map((group) => group.preferences.range));
  if (ranges.size > 1)
    warn(
      'the strategies groups have different evaluation ranges: a .jucm has one, written as 0..100',
    );
  if (groups.some((group) => group.preferences.tolerance !== 10))
    info(
      "a strategies group's tolerance is jUCMNav's preference, not the file's: not written",
    );
  const groupTags = groups.map((group, index) =>
    tag('groups', [
      ['name', group.group],
      ['id', groupId[index]],
      [
        'strategies',
        ints(group.strategies.flatMap((s) => strategyId.get(s.id) ?? [])),
      ],
    ]),
  );
  const writtenStrategies = new Set<string>();
  const strategyTags = groups.flatMap((group, index) =>
    group.strategies.flatMap((strategy) => {
      if (writtenStrategies.has(strategy.id)) return [];
      writtenStrategies.add(strategy.id);
      const includes = strategy.includes.flatMap((id) => {
        const included = strategyId.get(id);
        if (!included)
          warn(
            `strategy ${strategy.id} includes unknown strategy ${id}: left out`,
          );
        return included ?? [];
      });
      const evaluations = [...strategy.evaluations].flatMap(
        ([element, evaluation]) => {
          const id = elementId.get(element);
          if (!id || !intentional.some((node) => node.id === element)) {
            warn(
              `strategy ${strategy.id} evaluates ${element}, which the model doesn't have: left out`,
            );
            return [];
          }
          return [
            tag(
              'evaluations',
              [
                ['evaluation', unlessDefault(evaluation.value, 0)],
                [
                  'qualitativeEvaluation',
                  unlessDefault(evaluation.label, 'None'),
                ],
                ['intElement', id],
              ],
              evaluation.kpi
                ? [
                    tag(
                      'kpiEvalValueSet',
                      Object.entries(evaluation.kpi).map(([name, value]) => [
                        name,
                        String(value),
                      ]),
                    ),
                  ]
                : [],
            ),
          ];
        },
      );
      return [
        tag(
          'strategies',
          [
            ['name', strategy.name],
            ['id', strategyId.get(strategy.id)],
            ['author', strategy.author],
            ['group', groupId[index]],
            ['includedStrategies', ints(includes)],
          ],
          evaluations,
        ),
      ];
    }),
  );

  // the diagram: every element where the model puts it, in its actor's box
  const position = (node: Json) => ({
    x: Math.round(Number(node.x) || 0),
    y: Math.round(Number(node.y) || 0),
  });
  const nodeRefs = [
    ...intentional.map((node) => {
      const actor = actorOf.get(node.id);
      const at = position(node);
      return tag('nodes', [
        ['xsi:type', 'grl:IntentionalElementRef'],
        ['id', nodeRefId.get(node.id)],
        ['x', unlessDefault(at.x, 0)],
        ['y', unlessDefault(at.y, 0)],
        ['contRef', actor && actorRefId.get(actor.id)],
        ['def', elementId.get(node.id)],
      ]);
    }),
    ...beliefs.map((node) => {
      const at = position(node);
      return tag('nodes', [
        ['xsi:type', 'grl:Belief'],
        ['name', node.text ?? ''],
        ['id', nodeRefId.get(node.id)],
        ['x', unlessDefault(at.x, 0)],
        ['y', unlessDefault(at.y, 0)],
        ['description', node.customProperties?.Description || undefined],
      ]);
    }),
  ];
  // an actor's box: the model's size, else around its nodes
  const display: Json = model.display ?? {};
  const actorRefs = actors.map((actor) => {
    const at = position(actor);
    const members: Json[] = (actor.nodes ?? []).filter((n: Json) =>
      written.has(n.id),
    );
    const size = display[actor.id] ?? {};
    // the model's (0 too: jUCMNav's files may leave a box unsized)
    const sized = (value: unknown, around: number) =>
      Math.round(
        Number.isFinite(Number(value)) && value !== undefined
          ? Number(value)
          : around,
      );
    const width = sized(
      size.width,
      Math.max(200, ...members.map((n) => position(n).x - at.x + 140)),
    );
    const height = sized(
      size.height,
      Math.max(200, ...members.map((n) => position(n).y - at.y + 100)),
    );
    return tag(
      'contRefs',
      [
        ['xsi:type', 'grl:ActorRef'],
        ['id', actorRefId.get(actor.id)],
        ['name', actor.text ?? ''],
        ['x', unlessDefault(at.x, 0)],
        ['y', unlessDefault(at.y, 0)],
        ['width', unlessDefault(width, 0)],
        ['height', unlessDefault(height, 0)],
        ['contDef', actorId.get(actor.id)],
        ['nodes', ints(members.map((n) => nodeRefId.get(n.id)!))],
      ],
      [tag('label', [])],
    );
  });
  const connections = [
    ...links.map((link) => {
      const { src, dest } = ends(link);
      return tag('connections', [
        ['xsi:type', 'grl:LinkRef'],
        ['source', nodeRefId.get(src)],
        ['target', nodeRefId.get(dest)],
        ['link', linkId.get(link.id)],
      ]);
    }),
    ...beliefLinks.map((link) =>
      tag('connections', [
        ['xsi:type', 'grl:BeliefLink'],
        ['source', nodeRefId.get(link.source)],
        ['target', nodeRefId.get(link.target)],
      ]),
    ),
  ];

  const name = String(model.diagram?.name ?? '') || 'GRL model';
  const root = tag(
    'urn:URNspec',
    [
      ['name', name],
      ['specVersion', '1'],
      ['urnVersion', '1.27'],
      ['nextGlobalID', next],
    ],
    [
      tag(
        'grlspec',
        [],
        [
          ...intElements,
          ...actorTags,
          ...linkTags,
          ...groupTags,
          ...strategyTags,
        ],
      ),
      tag(
        'urndef',
        [],
        [
          tag(
            'specDiagrams',
            [
              ['xsi:type', 'grl:GRLGraph'],
              ['name', name],
              ['id', diagramId],
            ],
            [...nodeRefs, ...actorRefs, ...connections],
          ),
        ],
      ),
      ...(ranges.has('positive')
        ? [
            tag('metadata', [
              ['name', '_Use0to100EvaluationRange'],
              ['value', 'true'],
            ]),
          ]
        : []),
    ],
  );
  // ids are attributes here (jUCMNav writes `name` before `id`)
  const xmi = writeXmi(root, { namespaces: NAMESPACES });
  return {
    text: xmi.text,
    diagnostics: [...diagnostics, ...xmi.diagnostics],
  };
};

/** the attributes whose values are ids (a list of them, space-separated) */
const REFERENCES = new Set([
  'linksDest',
  'linksSrc',
  'refs',
  'contRefs',
  'dest',
  'src',
  'strategies',
  'group',
  'includedStrategies',
  'intElement',
  'contRef',
  'def',
  'contDef',
  'nodes',
  'source',
  'target',
  'link',
]);

/** the metamodel's defaults, by element: a file may write them, EMF doesn't */
const IMPORTANCE_DEFAULTS = { importance: 'None', importanceQuantitative: '0' };
const BOX_DEFAULTS = { x: '0', y: '0', width: '0', height: '0' };
const DEFAULTS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  intElements: {
    type: 'Softgoal',
    decompositionType: 'And',
    ...IMPORTANCE_DEFAULTS,
  },
  actors: IMPORTANCE_DEFAULTS,
  links: {
    contribution: 'Help',
    quantitativeContribution: '25',
    correlation: 'false',
  },
  evaluations: { evaluation: '0', qualitativeEvaluation: 'None' },
  nodes: BOX_DEFAULTS,
  contRefs: BOX_DEFAULTS,
};

/** what changes on every save, not the model */
const UNSAVED = new Set(['created', 'modified', 'nextGlobalID']);

/**
 * A `.jucm` in the form byte comparisons use (#143's `canonical`): ids
 * renumbered in the file's order (and every reference with them), the
 * attributes sorted, the metamodel's defaults, the dates and
 * `nextGlobalID` left out, two-space indentation; the text as it is when
 * it isn't XML (as `canonicalXml`).
 */
export const canonicalJucm = (text: string): string => {
  const { root, problems } = readXml(text);
  if (!root || problems.length) return text;
  const ids = new Map<string, string>();
  const collect = (element: XmlElement) => {
    const id = element.attributes.id;
    if (id !== undefined && !ids.has(id)) ids.set(id, String(ids.size + 1));
    element.children.forEach(collect);
  };
  collect(root);
  const toTree = (element: XmlElement): XmlTree => ({
    name: element.name,
    attributes: Object.entries(element.attributes)
      .filter(
        ([name, value]) =>
          !UNSAVED.has(name) && DEFAULTS[element.name]?.[name] !== value,
      )
      .map(([name, value]): [string, string] => [
        name,
        name === 'id'
          ? (ids.get(value) ?? value)
          : REFERENCES.has(name)
            ? value
                .split(/\s+/)
                .filter(Boolean)
                .map((id) => ids.get(id) ?? id)
                .join(' ')
            : value,
      ])
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
    children: element.children.map(toTree),
    ...(element.text && { text: element.text }),
  });
  return writeXmlTree(toTree(root));
};
