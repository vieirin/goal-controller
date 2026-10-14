/**
 * A GRL document (./xmi) as a piStar model in the GRL dialect: its elements
 * by kind, its links as iStar's (a contribution's GRL values as the link's
 * properties), its actors with their importance, where jUCMNav draws them,
 * and its strategies as the `strategies` project resource's files. The
 * file's ids are kept, so a model element is the `.jucm`'s (and the
 * oracle's rows join on them).
 */
import { grlMetamodelBlock } from '../../engines/grl/extension';
import {
  strategyFileName,
  writeStrategyFile,
  type GrlStrategyFile,
} from '../../engines/grl/strategies';
import { ISTAR_CONTRIBUTION_OF } from '../../engines/grl/vocabulary';
import type {
  GrlDocument,
  GrlElement,
  GrlElementType,
  GrlNodeRef,
  GrlReadDiagnostic,
} from './xmi';

/** The kind each GRL element type is (iStar's four; the indicator GRL's own). */
export const KIND_OF_TYPE: Readonly<Record<GrlElementType, string>> = {
  Softgoal: 'istar.Quality',
  Goal: 'istar.Goal',
  Task: 'istar.Task',
  Ressource: 'istar.Resource',
  Indicator: 'grl.Indicator',
  // the 2014 metamodel's feature: what a system does, read as a task
  Feature: 'istar.Task',
};

/** The project resource the strategies are, and where its files go. */
export const STRATEGIES_RESOURCE = 'strategies';
export const STRATEGIES_FOLDER = 'strategies/';

type Json = Record<string, unknown>;
type Properties = Record<string, string>;

/** a grid for what no diagram places: below the diagrams */
const GRID = { columns: 6, dx: 160, dy: 100 };
/** the space between two diagrams, one below the other */
const DIAGRAM_GAP = 150;
/** an element's box, for the diagrams' extents */
const NODE = { width: 100, height: 60 };

export type PistarImport = {
  model: Json;
  /** each file of the `strategies` resource, by its path in the project */
  strategies: Record<string, string>;
};

/** An element's properties: those GRL sets that aren't its defaults. */
const elementProperties = (element: GrlElement): Properties => ({
  ...(element.description && { Description: element.description }),
  ...(element.importance !== 'None' && { importance: element.importance }),
  ...(element.importanceQuantitative !== 0 && {
    importanceQuantitative: String(element.importanceQuantitative),
  }),
  // And and Or are their refinement links' kinds; Xor is read as Or (#105 D2)
  ...(element.decompositionType === 'Xor' && { decompositionType: 'Xor' }),
});

export const toPistar = (
  document: GrlDocument,
  diagnostics: GrlReadDiagnostic[],
): PistarImport => {
  const warn = (message: string) =>
    diagnostics.push({ severity: 'warning', message });
  const info = (message: string) =>
    diagnostics.push({ severity: 'info', message });
  const elementIds = new Set(document.elements.map((e) => e.id));

  // the diagrams one below the other: each one's vertical offset
  const extent = new Map<string, number>();
  const grow = (diagram: string, bottom: number) =>
    extent.set(diagram, Math.max(extent.get(diagram) ?? 0, bottom));
  for (const refs of document.elementRefs.values())
    for (const ref of refs) grow(ref.diagram, ref.y + NODE.height);
  for (const ref of document.actorRefs) grow(ref.diagram, ref.y + ref.height);
  for (const belief of document.beliefs)
    grow(belief.at.diagram, belief.at.y + NODE.height);
  const offset = new Map<string, number>();
  let top = 0;
  for (const diagram of document.diagrams) {
    offset.set(diagram.id, top);
    top += (extent.get(diagram.id) ?? 0) + DIAGRAM_GAP;
  }
  const place = (at: GrlNodeRef) => ({
    x: at.x,
    y: at.y + (offset.get(at.diagram) ?? 0),
  });
  let grid = 0;
  const gridPlace = () => {
    const at = {
      x: 40 + (grid % GRID.columns) * GRID.dx,
      y: top + 40 + Math.floor(grid / GRID.columns) * GRID.dy,
    };
    grid++;
    return at;
  };

  // actors: at their first ActorRef; an element is in the actor its first ref is drawn in
  const actorOfRef = new Map(document.actorRefs.map((r) => [r.ref, r]));
  const actorAt = new Map<string, (typeof document.actorRefs)[number]>();
  for (const ref of document.actorRefs)
    if (!actorAt.has(ref.actor)) actorAt.set(ref.actor, ref);
  const actorOfElement = new Map<string, string>();
  const unplaced: string[] = [];
  for (const element of document.elements) {
    const refs = document.elementRefs.get(element.id) ?? [];
    if (!refs.length) {
      unplaced.push(element.id);
      continue;
    }
    const actors = new Set(
      refs.map((r) =>
        r.actorRef ? actorOfRef.get(r.actorRef)?.actor : undefined,
      ),
    );
    const first = refs[0]!.actorRef
      ? actorOfRef.get(refs[0]!.actorRef)?.actor
      : undefined;
    if (first) actorOfElement.set(element.id, first);
    if (actors.size > 1)
      warn(
        `element ${element.id} (${element.name}) is drawn in more than one actor: it is in the first one's (${first ?? 'none'})`,
      );
  }
  if (unplaced.length)
    warn(
      `${unplaced.length} element(s) are in no diagram (${unplaced.join(', ')}): placed in a grid below the diagrams`,
    );

  // dependencies: a dependum is the element between a depender and a
  // dependee, outside every actor (piStar's); a GRL dependency link from
  // `src` (the dependee) to `dest` (the depender) is iStar's DependencyLink
  // from the depender to the dependee either way
  const dependencies = document.links.filter((l) => l.kind === 'Dependency');
  const dependums = new Map<string, { depender: string; dependee: string }>();
  for (const element of document.elements) {
    const dependedOn = dependencies.filter((l) => l.src === element.id);
    const dependsOn = dependencies.filter((l) => l.dest === element.id);
    if (
      dependedOn.length === 1 &&
      dependsOn.length === 1 &&
      !actorOfElement.has(element.id)
    )
      dependums.set(element.id, {
        depender: dependedOn[0]!.dest,
        dependee: dependsOn[0]!.src,
      });
  }
  for (const link of dependencies)
    if (!dependums.has(link.src) && !dependums.has(link.dest))
      warn(
        `dependency ${link.id} joins ${link.dest} to ${link.src} directly: piStar draws a dependency through a dependum, so the workbench may report it`,
      );

  const node = (element: GrlElement) => {
    const refs = document.elementRefs.get(element.id) ?? [];
    return {
      id: element.id,
      text: element.name,
      type: KIND_OF_TYPE[element.type],
      ...(refs[0] ? place(refs[0]) : gridPlace()),
      customProperties: elementProperties(element),
    };
  };

  const actors = document.actors.map((actor) => {
    const ref = actorAt.get(actor.id);
    const at = ref ? place({ ...ref, diagram: ref.diagram }) : gridPlace();
    return {
      id: actor.id,
      text: actor.name,
      type: 'istar.Actor',
      ...at,
      customProperties: {
        ...(actor.importance !== 'None' && { importance: actor.importance }),
        ...(actor.importanceQuantitative !== 0 && {
          importanceQuantitative: String(actor.importanceQuantitative),
        }),
      },
      nodes: document.elements
        .filter((e) => actorOfElement.get(e.id) === actor.id)
        .map(node),
    };
  });
  const display: Record<string, Json> = {};
  for (const [actor, ref] of actorAt)
    display[actor] = { width: ref.width, height: ref.height };

  const orphans = [
    ...document.elements
      .filter((e) => !actorOfElement.has(e.id) && !dependums.has(e.id))
      .map(node),
    ...document.beliefs.map((belief) => ({
      id: belief.id,
      text: belief.name,
      type: 'grl.Belief',
      ...place(belief.at),
      customProperties: belief.description
        ? { Description: belief.description }
        : {},
    })),
  ];
  const dependencyElements = document.elements
    .filter((e) => dependums.has(e.id))
    .map((e) => ({
      ...node(e),
      source: dependums.get(e.id)!.depender,
      target: dependums.get(e.id)!.dependee,
    }));

  const parentOf = new Map(document.elements.map((e) => [e.id, e]));
  const links = document.links.flatMap((link): Json[] => {
    if (!elementIds.has(link.src) || !elementIds.has(link.dest)) {
      warn(
        `link ${link.id} joins an element the file doesn't have: not imported`,
      );
      return [];
    }
    switch (link.kind) {
      case 'Decomposition':
        return [
          {
            id: link.id,
            type:
              parentOf.get(link.dest)?.decompositionType === 'And'
                ? 'istar.AndRefinementLink'
                : 'istar.OrRefinementLink',
            source: link.src,
            target: link.dest,
          },
        ];
      case 'Dependency':
        return [
          {
            id: link.id,
            type: 'istar.DependencyLink',
            source: link.dest,
            target: link.src,
          },
        ];
      case 'Contribution':
        return [
          {
            id: link.id,
            type: 'istar.ContributionLink',
            source: link.src,
            target: link.dest,
            label: ISTAR_CONTRIBUTION_OF[link.contribution],
            customProperties: {
              contribution: link.contribution,
              quantitativeContribution: String(link.quantitativeContribution),
              ...(link.correlation && { correlation: 'true' }),
            },
          },
        ];
    }
  });
  for (const beliefLink of document.beliefLinks)
    links.push({
      id: `${beliefLink.belief}-${beliefLink.element}`,
      type: 'grl.BeliefLink',
      source: beliefLink.belief,
      target: beliefLink.element,
    });

  // what is read differently, said once
  const features = document.elements.filter((e) => e.feature);
  if (features.length)
    info(
      `${features.length} feature(s) read as their intentional type, a 2014 Feature as a task (feature models are not imported)`,
    );
  const notLegal = document.elements.filter(
    (e) => e.metadata.ST_Legal === 'No',
  );
  if (notLegal.length)
    warn(
      `${notLegal.length} element(s) are tagged ST_Legal = No (${notLegal.map((e) => e.id).join(', ')}): jUCMNav leaves them out of AND decompositions and actor values; the import doesn't`,
    );
  const withMetadata = document.elements.filter(
    (e) => Object.keys(e.metadata).length,
  ).length;
  if (withMetadata)
    info(`the metadata of ${withMetadata} element(s) is not imported`);
  if (document.skipped.ucm)
    info(
      `the file's Use Case Maps (${document.skipped.ucm} diagram(s)) are not imported: GRL only`,
    );
  if (document.skipped.featureDiagrams)
    info(
      `${document.skipped.featureDiagrams} feature model diagram(s) are not imported`,
    );

  // the strategies: a file per group (the ungrouped in one of their own)
  const positive = document.metadata._Use0to100EvaluationRange === 'true';
  const files: GrlStrategyFile[] = [];
  const grouped = new Set<string>();
  const entryOf = (id: string) => {
    const strategy = document.strategies.find((s) => s.id === id);
    if (!strategy) {
      warn(`a strategies group names unknown strategy ${id}`);
      return [];
    }
    grouped.add(id);
    return [
      {
        id: strategy.id,
        name: strategy.name,
        ...(strategy.author && { author: strategy.author }),
        ...(strategy.includedStrategies.length && {
          includes: strategy.includedStrategies,
        }),
        evaluations: Object.fromEntries(
          strategy.evaluations.map((evaluation) => {
            if (!elementIds.has(evaluation.intElement))
              warn(
                `strategy ${strategy.id} evaluates ${evaluation.intElement}, which the file doesn't have`,
              );
            return [
              evaluation.intElement,
              {
                value: evaluation.evaluation,
                label: evaluation.qualitativeEvaluation,
                ...(evaluation.kpi && { kpi: evaluation.kpi }),
              },
            ];
          }),
        ),
      },
    ];
  };
  const preferences = positive
    ? { preferences: { range: 'positive' as const } }
    : {};
  for (const group of document.groups)
    files.push({
      group: group.name,
      ...preferences,
      strategies: group.strategies.flatMap(entryOf),
    });
  const ungrouped = document.strategies.filter((s) => !grouped.has(s.id));
  if (ungrouped.length)
    files.push({
      group: 'Strategies',
      ...preferences,
      strategies: ungrouped.flatMap((s) => entryOf(s.id)),
    });
  const strategies: Record<string, string> = {};
  for (const file of files) {
    let path = `${STRATEGIES_FOLDER}${strategyFileName(file.group)}`;
    for (let n = 2; path in strategies; n++)
      path = `${STRATEGIES_FOLDER}${strategyFileName(`${file.group}-${n}`)}`;
    strategies[path] = writeStrategyFile(file);
  }

  const width = Math.max(
    1000,
    ...[...document.elementRefs.values()].flat().map((r) => r.x + NODE.width),
    ...document.actorRefs.map((r) => r.x + r.width),
  );
  const model: Json = {
    actors,
    orphans,
    dependencies: dependencyElements,
    links,
    display,
    tool: 'pistar.2.1.0',
    istar: '2.0',
    diagram: {
      width,
      height: Math.max(
        700,
        top + 40 + Math.ceil(grid / GRID.columns) * GRID.dy,
      ),
      name: document.name,
      customProperties: { engine: 'grl' },
    },
    metamodel: grlMetamodelBlock(),
  };
  return { model, strategies };
};
