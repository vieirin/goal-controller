/**
 * jUCMNav's `.jucm` (EMF XMI 2.0) read into GRL's own terms
 * (`seg.jUCMNav/src/seg/jUCMNav/emf/grl.ecore`): the `grlspec`'s elements,
 * links, actors and strategies, and where the `GRLGraph` diagrams of the
 * `urndef` draw them. Each XMI element's attributes are typed by a zod
 * schema over lib's XML reader (#105: no Ecore runtime). EMF writes no
 * attribute that has its default, so the schemas' defaults are the
 * metamodel's. Nothing here knows piStar.
 */
import * as z from 'zod/mini';
import {
  GRL_CONTRIBUTIONS,
  GRL_DECOMPOSITIONS,
  GRL_IMPORTANCES,
  GRL_QUALITATIVE_LABELS,
} from '../../engines/grl/vocabulary';
import {
  readXmi,
  type XmiNode,
  type XmiReader,
} from '@goal-controller/goal-language/formats';

/**
 * IntentionalElementType; `Feature` is the 2014 metamodel's (SmartHome2's),
 * which jUCMNavPlus moved to its feature models.
 */
export const GRL_ELEMENT_TYPES = [
  'Softgoal',
  'Goal',
  'Task',
  'Ressource',
  'Indicator',
  'Feature',
] as const;
export type GrlElementType = (typeof GRL_ELEMENT_TYPES)[number];

/** an int attribute, EMF's default when it is not written */
const int = (fallback: number) =>
  z.prefault(
    z.pipe(
      z.string().check(z.regex(/^-?\d+$/, 'an integer')),
      z.transform((value) => Number.parseInt(value, 10)),
    ),
    String(fallback),
  );

/** an enum attribute, EMF's default when it is not written */
const literal = <const T extends readonly [string, ...string[]]>(
  literals: T,
  fallback: T[number],
) => z.prefault(z.enum(literals), fallback);

/** an id list attribute (`linksSrc="62 63"`) */
const idList = z.prefault(
  z.pipe(
    z.string(),
    z.transform((value) => value.split(/\s+/).filter(Boolean)),
  ),
  '',
);

const named = { id: z.string(), name: z.prefault(z.string(), '') };

const IntElement = z.object({
  ...named,
  'xsi:type': z.optional(z.string()),
  type: literal(GRL_ELEMENT_TYPES, 'Softgoal'),
  decompositionType: literal(GRL_DECOMPOSITIONS, 'And'),
  importance: literal(GRL_IMPORTANCES, 'None'),
  importanceQuantitative: int(0),
  description: z.optional(z.string()),
});

const Link = z.object({
  id: z.string(),
  'xsi:type': z.string(),
  src: z.string(),
  dest: z.string(),
  contribution: literal(GRL_CONTRIBUTIONS, 'Help'),
  quantitativeContribution: int(25),
  correlation: z.prefault(
    z.pipe(
      z.enum(['true', 'false']),
      z.transform((v) => v === 'true'),
    ),
    'false',
  ),
});

const Actor = z.object({
  ...named,
  importance: literal(GRL_IMPORTANCES, 'None'),
  importanceQuantitative: int(0),
});

const Group = z.object({ ...named, strategies: idList });

const Strategy = z.object({
  ...named,
  author: z.optional(z.string()),
  group: z.optional(z.string()),
  includedStrategies: idList,
});

const Evaluation = z.object({
  intElement: z.string(),
  evaluation: int(0),
  qualitativeEvaluation: literal(GRL_QUALITATIVE_LABELS, 'None'),
});

const NodeRef = z.object({
  id: z.string(),
  'xsi:type': z.string(),
  name: z.prefault(z.string(), ''),
  description: z.optional(z.string()),
  x: int(0),
  y: int(0),
  def: z.optional(z.string()),
  contRef: z.optional(z.string()),
});

const ActorRef = z.object({
  id: z.string(),
  contDef: z.string(),
  x: int(0),
  y: int(0),
  width: int(0),
  height: int(0),
  nodes: idList,
});

const Connection = z.object({
  'xsi:type': z.string(),
  source: z.string(),
  target: z.string(),
});

export type GrlElement = Omit<
  z.infer<typeof IntElement>,
  'xsi:type' | 'type'
> & {
  type: GrlElementType;
  /** a `grl:Feature` or a 2014 `Feature` (read as a task: feature models are not ported) */
  feature: boolean;
  /** its metadata (`ST_Legal`, a tool's own) */
  metadata: Record<string, string>;
};

export type GrlLink =
  | { kind: 'Decomposition'; id: string; src: string; dest: string }
  | { kind: 'Dependency'; id: string; src: string; dest: string }
  | ({ kind: 'Contribution' } & Pick<
      z.infer<typeof Link>,
      | 'id'
      | 'src'
      | 'dest'
      | 'contribution'
      | 'quantitativeContribution'
      | 'correlation'
    >);

export type GrlActor = z.infer<typeof Actor>;

/** An Evaluation: a strategy's initial value of an element (its KPI value set as written). */
export type GrlEvaluation = z.infer<typeof Evaluation> & {
  kpi?: Record<string, string>;
};

export type GrlStrategy = z.infer<typeof Strategy> & {
  evaluations: GrlEvaluation[];
};

export type GrlStrategiesGroup = z.infer<typeof Group>;

/** A node a diagram draws: where, and in which actor's box. */
export type GrlNodeRef = {
  diagram: string;
  /** the ref's own id */
  ref: string;
  x: number;
  y: number;
  /** the ActorRef it is drawn in */
  actorRef?: string;
};

export type GrlActorRef = {
  diagram: string;
  ref: string;
  actor: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** the refs drawn in it */
  nodes: string[];
};

export type GrlBelief = {
  id: string;
  name: string;
  description?: string;
  at: GrlNodeRef;
};

/** A BeliefLink: from a belief to the element whose ref it targets. */
export type GrlBeliefLink = { belief: string; element: string };

export type GrlDiagram = { id: string; name: string };

export type GrlDocument = {
  name: string;
  /** the URNspec's metadata: `_Use0to100EvaluationRange` among them */
  metadata: Record<string, string>;
  elements: GrlElement[];
  links: GrlLink[];
  actors: GrlActor[];
  groups: GrlStrategiesGroup[];
  strategies: GrlStrategy[];
  diagrams: GrlDiagram[];
  /** each element's refs, by element id, in the file's order */
  elementRefs: Map<string, GrlNodeRef[]>;
  actorRefs: GrlActorRef[];
  beliefs: GrlBelief[];
  beliefLinks: GrlBeliefLink[];
  /** what the file has that a GRL import doesn't read */
  skipped: { ucm: number; featureDiagrams: number };
};

export type GrlReadDiagnostic = {
  severity: 'error' | 'warning' | 'info';
  message: string;
};

const metadataOf = (reader: XmiReader, node: XmiNode): Record<string, string> =>
  Object.fromEntries(
    reader
      .children(node, 'metadata')
      .map((m) => [m.attributes.name ?? '', m.attributes.value ?? '']),
  );

/**
 * A `.jucm` text read as GRL, or the reason it is not one: the error
 * diagnostics. An XMI element whose attributes don't fit its schema is left
 * out, with an error. Read with the shared XMI reader (`../xmi`); jUCMNav
 * keys its elements by `id`.
 */
export const readJucm = (
  text: string,
): { document: GrlDocument | null; diagnostics: GrlReadDiagnostic[] } => {
  const read = readXmi(text, { idAttribute: 'id' });
  // as jUCMNav's reader said them: a severity and a message
  const diagnostics = (): GrlReadDiagnostic[] =>
    read.diagnostics.map(({ severity, message }) => ({ severity, message }));
  const { reader } = read;
  if (!reader) return { document: null, diagnostics: diagnostics() };
  const root = reader.document.root;
  if (root.feature !== 'urn:URNspec') {
    reader.diagnostics.push({
      severity: 'error',
      message: `not a jUCMNav file: its root is <${root.feature}>, not <urn:URNspec>`,
    });
    return { document: null, diagnostics: diagnostics() };
  }
  const childrenNamed = reader.children;
  const typed = reader.typed;

  const grlspec = childrenNamed(root, 'grlspec')[0];
  const urndef = childrenNamed(root, 'urndef')[0];

  const elements = childrenNamed(grlspec, 'intElements').flatMap(
    (element): GrlElement[] => {
      const read = typed(IntElement, element);
      if (!read) return [];
      const { 'xsi:type': xsiType = '', type, ...rest } = read;
      return [
        {
          ...rest,
          // a kpimodel Indicator is one whatever its type says
          type: xsiType.endsWith(':Indicator') ? 'Indicator' : type,
          feature: xsiType === 'grl:Feature' || type === 'Feature',
          metadata: metadataOf(reader, element),
        },
      ];
    },
  );

  const links = childrenNamed(grlspec, 'links').flatMap(
    (element): GrlLink[] => {
      const read = typed(Link, element);
      if (!read) return [];
      const { id, src, dest } = read;
      switch (read['xsi:type']) {
        case 'grl:Decomposition':
          return [{ kind: 'Decomposition', id, src, dest }];
        case 'grl:Dependency':
          return [{ kind: 'Dependency', id, src, dest }];
        case 'grl:Contribution':
          return [
            {
              kind: 'Contribution',
              id,
              src,
              dest,
              contribution: read.contribution,
              quantitativeContribution: read.quantitativeContribution,
              correlation: read.correlation,
            },
          ];
        default:
          reader.diagnostics.push({
            severity: 'warning',
            message: `link ${id}: ${read['xsi:type']} is not read`,
          });
          return [];
      }
    },
  );

  const actors = childrenNamed(grlspec, 'actors').flatMap(
    (element) => typed(Actor, element) ?? [],
  );
  const groups = childrenNamed(grlspec, 'groups').flatMap(
    (element) => typed(Group, element) ?? [],
  );
  const strategies = childrenNamed(grlspec, 'strategies').flatMap(
    (element): GrlStrategy[] => {
      const read = typed(Strategy, element);
      if (!read) return [];
      const evaluations = childrenNamed(element, 'evaluations').flatMap(
        (evaluation): GrlEvaluation[] => {
          const value = typed(Evaluation, evaluation);
          if (!value) return [];
          const kpi = childrenNamed(evaluation, 'kpiEvalValueSet')[0];
          return [{ ...value, ...(kpi && { kpi: { ...kpi.attributes } }) }];
        },
      );
      return [{ ...read, evaluations }];
    },
  );

  // the diagrams: GRL graphs read, UCM maps and feature diagrams counted
  const diagrams: GrlDiagram[] = [];
  const elementRefs = new Map<string, GrlNodeRef[]>();
  const actorRefs: GrlActorRef[] = [];
  const beliefs: GrlBelief[] = [];
  const beliefLinks: GrlBeliefLink[] = [];
  const skipped = { ucm: 0, featureDiagrams: 0 };
  for (const diagram of childrenNamed(urndef, 'specDiagrams')) {
    const type = diagram.attributes['xsi:type'];
    if (type === 'grl:FeatureModel' || type === 'fm:FeatureDiagram') {
      skipped.featureDiagrams++;
      continue;
    }
    if (type !== 'grl:GRLGraph') {
      skipped.ucm++;
      continue;
    }
    const id = diagram.attributes.id ?? '';
    diagrams.push({ id, name: diagram.attributes.name ?? '' });
    /** a node ref's element, by the ref's id: for belief links */
    const refElement = new Map<string, string>();
    for (const node of childrenNamed(diagram, 'nodes')) {
      const read = typed(NodeRef, node);
      if (!read) continue;
      const at: GrlNodeRef = {
        diagram: id,
        ref: read.id,
        x: read.x,
        y: read.y,
        ...(read.contRef !== undefined && { actorRef: read.contRef }),
      };
      if (read['xsi:type'] === 'grl:IntentionalElementRef' && read.def) {
        refElement.set(at.ref, read.def);
        elementRefs.set(read.def, [...(elementRefs.get(read.def) ?? []), at]);
      } else if (read['xsi:type'] === 'grl:Belief')
        beliefs.push({
          id: read.id,
          name: read.name,
          ...(read.description !== undefined && {
            description: read.description,
          }),
          at,
        });
    }
    for (const ref of childrenNamed(diagram, 'contRefs'))
      if (ref.attributes['xsi:type'] === 'grl:ActorRef') {
        const read = typed(ActorRef, ref);
        if (read)
          actorRefs.push({
            diagram: id,
            ref: read.id,
            actor: read.contDef,
            x: read.x,
            y: read.y,
            width: read.width,
            height: read.height,
            nodes: read.nodes,
          });
      }
    for (const connection of childrenNamed(diagram, 'connections'))
      if (connection.attributes['xsi:type'] === 'grl:BeliefLink') {
        const read = typed(Connection, connection);
        const element = read && refElement.get(read.target);
        if (read && element) beliefLinks.push({ belief: read.source, element });
      }
  }
  // the UCM half of a file (its maps, responsibilities, components)
  skipped.ucm += childrenNamed(root, 'ucmspec').length;

  return {
    document: {
      name: root.attributes.name ?? '',
      metadata: metadataOf(reader, root),
      elements,
      links,
      actors,
      groups,
      strategies,
      diagrams,
      elementRefs,
      actorRefs,
      beliefs,
      beliefLinks,
      skipped,
    },
    diagnostics: diagnostics(),
  };
};
