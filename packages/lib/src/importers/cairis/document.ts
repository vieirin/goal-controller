/**
 * A CAIRIS model file (`<cairis_model>`, DTD `-//CAIRIS//DTD MODEL 1.0//EN`:
 * `cairis/config/cairis_model.dtd` with `goals.dtd` and `associations.dtd`,
 * cairis-platform/cairis at `44cc57d`, Apache 2.0) as a document: what of it
 * is KAOS's goal and obstacle model (goal-controller#192). That is the
 * environments, goals and obstacles with their per-environment definitions,
 * requirements, domain properties, roles, the assets' environments (where a
 * requirement is situated), and the associations, each in the file's order
 * with its text as written. Every other part of the file (risk analysis,
 * usability, use cases, countermeasures, data flows, …) is counted, not read.
 * Read with lib's XML reader.
 */
import {
  readXml,
  type XmlElement,
} from '@goal-controller/goal-language/formats';
import type { ImportDiagnostic } from '../types';

/** The root element a CAIRIS model file has. */
export const CAIRIS_ROOT = 'cairis_model';

/** Its DOCTYPE's public identifier. */
export const CAIRIS_PUBLIC_ID = '-//CAIRIS//DTD MODEL 1.0//EN';

/** A goal association's `ref_type` (`associations.dtd:35`). */
export const CAIRIS_REF_TYPES = [
  'and',
  'or',
  'conflict',
  'responsible',
  'obstruct',
  'resolve',
] as const;
export type CairisRefType = (typeof CAIRIS_REF_TYPES)[number];

const isRefType = (text: string): text is CairisRefType =>
  (CAIRIS_REF_TYPES as readonly string[]).includes(text);

/** An end of an association: an element's name and its dimension (`goal`, `obstacle`, `requirement`, `role`, `task`, …). */
export type CairisEnd = { name: string; dim: string };

export type CairisEnvironment = {
  name: string;
  shortCode: string;
  definition: string;
};

export type CairisGoalEnvironment = {
  environment: string;
  category: string;
  priority: string;
  definition: string;
  fitCriterion: string;
  issue: string;
  /** the assets it concerns, by name */
  concerns: string[];
};

export type CairisGoal = {
  name: string;
  originator: string;
  tags: string[];
  environments: CairisGoalEnvironment[];
};

export type CairisObstacleEnvironment = {
  environment: string;
  category: string;
  definition: string;
  concerns: string[];
  /** `<probability value>` with its rationale (`goals.dtd:64-66`); null when the file has none */
  probability: { value: string; rationale: string } | null;
};

export type CairisObstacle = {
  name: string;
  originator: string;
  tags: string[];
  environments: CairisObstacleEnvironment[];
};

export type CairisRequirement = {
  /** its name, or `label` when it has none (`name` is `#IMPLIED`) */
  name: string;
  reference: string;
  referenceType: string;
  label: string;
  type: string;
  priority: string;
  description: string;
  rationale: string;
  fitCriterion: string;
  originator: string;
};

export type CairisDomainProperty = {
  name: string;
  type: string;
  originator: string;
  definition: string;
  tags: string[];
};

export type CairisRole = {
  name: string;
  type: string;
  shortCode: string;
  description: string;
};

/** A `goal_association`, in its environment. */
export type CairisAssociation = {
  environment: string;
  goal: CairisEnd;
  /** as written; one of CAIRIS_REF_TYPES, or null when the file has another */
  refType: CairisRefType | null;
  refTypeText: string;
  subgoal: CairisEnd;
  alternative: boolean;
  rationale: string;
  /** its text as written */
  source: string;
};

/** A `manual_association`: no environment. */
export type CairisManualAssociation = {
  from: CairisEnd;
  to: CairisEnd;
  source: string;
};

/**
 * A use case step's exception against a goal or a requirement: CAIRIS makes
 * it an obstacle obstructing that goal, in the use case's environment, when
 * it imports the file (`addUseCaseStepException`, cairis/sql/procs.sql).
 */
export type CairisStepException = {
  environment: string;
  usecase: string;
  name: string;
  /** `goal` or `requirement` (the file's `type`, lower case, as CAIRIS reads it) */
  dim: 'goal' | 'requirement';
  /** the goal's or requirement's name (`value`) */
  target: string;
  category: string;
  definition: string;
};

/** A `dependency` between roles, in its environment: no KAOS link is one. */
export type CairisDependency = { environment: string; source: string };

export type CairisDocument = {
  /** `project_settings`' name */
  project: string;
  environments: CairisEnvironment[];
  goals: CairisGoal[];
  obstacles: CairisObstacle[];
  requirements: CairisRequirement[];
  domainProperties: CairisDomainProperty[];
  roles: CairisRole[];
  /** each asset's environments (its `security_property`s'): where a requirement on it is situated */
  assets: { name: string; environments: string[] }[];
  associations: CairisAssociation[];
  manualAssociations: CairisManualAssociation[];
  dependencies: CairisDependency[];
  /** the use cases' step exceptions against a goal or a requirement (CAIRIS's obstacles); a use case is read for these only */
  exceptions: CairisStepException[];
  /** what the file has besides, by element name, with how many: counted, not read */
  unread: { element: string; count: number }[];
};

const children = (element: XmlElement | undefined, name: string) =>
  element?.children.filter((child) => child.name === name) ?? [];
const child = (element: XmlElement, name: string) =>
  element.children.find((c) => c.name === name);
const textOf = (element: XmlElement, name: string) =>
  child(element, name)?.text ?? '';
const attribute = (element: XmlElement, name: string) =>
  element.attributes[name] ?? '';
const tagsOf = (element: XmlElement) =>
  children(element, 'tag').map((tag) => attribute(tag, 'name'));
const concernsOf = (element: XmlElement) =>
  children(element, 'concern').map((c) => attribute(c, 'name'));

/** The sections and the elements of each the document reads (a file's names are open: a Map); any other is counted. */
const READ: ReadonlyMap<string, readonly string[]> = new Map([
  ['cairis', ['environment', 'project_settings']],
  ['riskanalysis', ['role', 'asset']],
  ['goals', ['domainproperty', 'goal', 'obstacle', 'requirement', 'usecase']],
  ['associations', ['goal_association', 'manual_association', 'dependency']],
]);

/** Whether a text is a CAIRIS model file: its DOCTYPE's public identifier, or its root element. */
export const isCairisModel = (text: string): boolean => {
  const head = text.slice(0, 4096);
  return (
    head.includes(CAIRIS_PUBLIC_ID) ||
    new RegExp(`<${CAIRIS_ROOT}[\\s>]`).test(head)
  );
};

export const readCairisDocument = (
  text: string,
): { document: CairisDocument | null; diagnostics: ImportDiagnostic[] } => {
  const diagnostics: ImportDiagnostic[] = [];
  const { root, problems } = readXml(text);
  for (const problem of problems)
    diagnostics.push({
      severity: 'error',
      message: problem.message,
      from: problem.from,
      to: problem.to,
    });
  if (!root || root.name !== CAIRIS_ROOT) {
    diagnostics.push({
      severity: 'error',
      message: root
        ? `Not a CAIRIS model: its root is <${root.name}>, not <${CAIRIS_ROOT}>`
        : 'Not a CAIRIS model: no XML element',
    });
    return { document: null, diagnostics };
  }
  const section = (name: string) =>
    root.children.find((element) => element.name === name);
  const sourceOf = (element: XmlElement) =>
    text.slice(element.from, element.to);
  const end = (element: XmlElement, name: string, dim: string): CairisEnd => ({
    name: attribute(element, name),
    dim: attribute(element, dim),
  });

  const unread = new Map<string, number>();
  const count = (name: string) => unread.set(name, (unread.get(name) ?? 0) + 1);
  for (const part of root.children) {
    const read = READ.get(part.name);
    if (!read) count(part.name);
    else
      for (const element of part.children)
        if (!read.includes(element.name)) count(element.name);
  }

  const cairis = section('cairis');
  const goals = section('goals');
  const risk = section('riskanalysis');
  const associations = section('associations');
  const document: CairisDocument = {
    project: attribute(children(cairis, 'project_settings')[0] ?? root, 'name'),
    environments: children(cairis, 'environment').map((e) => ({
      name: attribute(e, 'name'),
      shortCode: attribute(e, 'short_code'),
      definition: textOf(e, 'definition'),
    })),
    goals: children(goals, 'goal').map((g) => ({
      name: attribute(g, 'name'),
      originator: attribute(g, 'originator'),
      tags: tagsOf(g),
      environments: children(g, 'goal_environment').map((e) => ({
        environment: attribute(e, 'name'),
        category: attribute(e, 'category'),
        priority: attribute(e, 'priority'),
        definition: textOf(e, 'definition'),
        fitCriterion: textOf(e, 'fit_criterion'),
        issue: textOf(e, 'issue'),
        concerns: concernsOf(e),
      })),
    })),
    obstacles: children(goals, 'obstacle').map((o) => ({
      name: attribute(o, 'name'),
      originator: attribute(o, 'originator'),
      tags: tagsOf(o),
      environments: children(o, 'obstacle_environment').map((e) => {
        const probability = child(e, 'probability');
        return {
          environment: attribute(e, 'name'),
          category: attribute(e, 'category'),
          definition: textOf(e, 'definition'),
          concerns: concernsOf(e),
          probability: probability
            ? {
                value: attribute(probability, 'value'),
                rationale: textOf(probability, 'rationale'),
              }
            : null,
        };
      }),
    })),
    requirements: children(goals, 'requirement').map((r) => ({
      name: attribute(r, 'name') || attribute(r, 'label'),
      reference: attribute(r, 'reference'),
      referenceType: attribute(r, 'reference_type'),
      label: attribute(r, 'label'),
      type: attribute(r, 'type'),
      priority: attribute(r, 'priority'),
      description: textOf(r, 'description'),
      rationale: textOf(r, 'rationale'),
      fitCriterion: textOf(r, 'fit_criterion'),
      originator: textOf(r, 'originator'),
    })),
    domainProperties: children(goals, 'domainproperty').map((d) => ({
      name: attribute(d, 'name'),
      type: attribute(d, 'type'),
      originator: attribute(d, 'originator'),
      definition: textOf(d, 'definition'),
      tags: tagsOf(d),
    })),
    roles: children(risk, 'role').map((r) => ({
      name: attribute(r, 'name'),
      type: attribute(r, 'type'),
      shortCode: attribute(r, 'short_code'),
      description: textOf(r, 'description'),
    })),
    assets: children(risk, 'asset').map((a) => ({
      name: attribute(a, 'name'),
      environments: [
        ...new Set(
          children(a, 'security_property').map((p) =>
            attribute(p, 'environment'),
          ),
        ),
      ],
    })),
    associations: children(associations, 'goal_association').map((a) => {
      const refTypeText = attribute(a, 'ref_type');
      return {
        environment: attribute(a, 'environment'),
        goal: end(a, 'goal_name', 'goal_dim'),
        refType: isRefType(refTypeText) ? refTypeText : null,
        refTypeText,
        subgoal: end(a, 'subgoal_name', 'subgoal_dim'),
        alternative: attribute(a, 'alternative_id') === '1',
        rationale: textOf(a, 'rationale'),
        source: sourceOf(a),
      };
    }),
    manualAssociations: children(associations, 'manual_association').map(
      (a) => ({
        from: end(a, 'from_name', 'from_dim'),
        to: end(a, 'to_name', 'to_dim'),
        source: sourceOf(a),
      }),
    ),
    dependencies: children(associations, 'dependency').map((d) => ({
      environment: attribute(d, 'environment'),
      source: sourceOf(d),
    })),
    exceptions: children(goals, 'usecase').flatMap((usecase) =>
      children(usecase, 'usecase_environment').flatMap((environment) =>
        children(child(environment, 'flow') ?? environment, 'step').flatMap(
          (step) =>
            children(step, 'exception').flatMap(
              (exception): CairisStepException[] => {
                const dim = attribute(exception, 'type').toLowerCase();
                return dim === 'goal' || dim === 'requirement'
                  ? [
                      {
                        environment: attribute(environment, 'name'),
                        usecase: attribute(usecase, 'name'),
                        name: attribute(exception, 'name'),
                        dim,
                        target: attribute(exception, 'value'),
                        category: attribute(exception, 'category'),
                        definition: textOf(exception, 'definition'),
                      },
                    ]
                  : [];
              },
            ),
        ),
      ),
    ),
    unread: [...unread].map(([element, n]) => ({ element, count: n })),
  };
  return { document, diagnostics };
};
