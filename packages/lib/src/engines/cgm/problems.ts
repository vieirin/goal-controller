/**
 * What is wrong with a contextual goal model as a whole, for its analyses
 * (goal-controller#153): the named checks' rules (./checks), said of every
 * element and link, and what they can't say alone: a formula naming what
 * the model doesn't have, a context on a link kind without one. A formula
 * is the dialect's reading (./values): one written with an error is unset,
 * the dialect's value check reports it.
 */
import { parses } from '@goal-controller/goal-language';
import type { CheckContext, CheckInput } from '../checks';
import type { AnalysisModel } from '../analysis';
import { cgmCheckRegistry } from './checks';
import { cgm as cgmDialect } from './definition';
import { namesOf } from './formulas';
import { readCgmModel } from './model';
import { elementValues, linkValues, type CgmValues } from './values';
import { CGM_KEYS, CGM_KINDS } from './vocabulary';

export type CgmProblem = {
  severity: 'error' | 'warning';
  message: string;
  /** the element's or link's piStar id */
  at?: string;
};

/** The keys holding formulas, and the kinds their names must be. */
const FORMULAS = [
  [CGM_KEYS.activation, [CGM_KINDS.context]],
  [CGM_KEYS.context, [CGM_KINDS.context]],
  [CGM_KEYS.opposite, [CGM_KINDS.context]],
  [CGM_KEYS.formula, [CGM_KINDS.statement, CGM_KINDS.fact]],
  [CGM_KEYS.supportedBy, [CGM_KINDS.statement, CGM_KINDS.fact]],
] as const satisfies readonly (readonly [keyof CgmValues, readonly string[]])[];

/** The properties a link kind declares. */
const propertyKeysOfLink = (kind: string): string[] =>
  (
    (cgmDialect.links as Readonly<Record<string, readonly { key: string }[]>>)[
      kind
    ] ?? []
  ).map((property) => property.key);

export const cgmProblems = (model: AnalysisModel): CgmProblem[] => {
  const cgm = readCgmModel(model);
  const problems: CgmProblem[] = [];
  const children = new Map<string, string[]>();
  for (const element of model.elements)
    children.set(
      cgm.idOf(element.id),
      cgm.refinementsOf(element.id).map((r) => cgm.idOf(r.child)),
    );
  const context = (self: string): CheckContext => ({
    self,
    kindOf: () => undefined,
    elements: Object.fromEntries(
      model.elements.map((element) => [
        cgm.idOf(element.id),
        {
          kind: element.kind,
          children: children.get(cgm.idOf(element.id)) ?? [],
          properties: element.properties,
        },
      ]),
    ),
  });
  const formulas = (at: string, name: string, values: CgmValues) => {
    for (const [key, kinds] of FORMULAS) {
      for (const named of namesOf(values[key])) {
        const element = cgm.byId(named);
        if (!element || !(kinds as readonly string[]).includes(element.kind))
          problems.push({
            severity: 'error',
            at,
            message: `${name}'s ${key} names ${named}, which is no ${kinds.map((k) => k.split('.')[1]!.toLowerCase()).join(' or ')}`,
          });
      }
    }
  };
  for (const element of model.elements) {
    const id = cgm.idOf(element.id);
    const values = elementValues(element);
    formulas(element.id, id, values);
    // what its checks are given, as the editors give it
    const input: CheckInput = {
      props: values,
      raw: element.properties,
      kind: element.kind,
    };
    for (const [key, check] of [
      [CGM_KEYS.activation, 'cgm.goal.activation'],
      [CGM_KEYS.formula, 'cgm.context.monitorable'],
      [CGM_KEYS.supportedBy, 'cgm.statement.supported'],
    ] as const) {
      if (!(key in element.properties) || !parses(input, key)) continue;
      const message = cgmCheckRegistry[check](input, context(id));
      if (message)
        problems.push({
          severity: 'error',
          at: element.id,
          message: `${id}: ${message}`,
        });
    }
    if (
      element.kind === CGM_KINDS.statement &&
      !elementValues(element).supportedBy
    )
      problems.push({
        severity: 'error',
        at: element.id,
        message: `${id}: a statement is supported by a formula (REJ 2010 Def. 6)`,
      });
  }
  for (const link of model.links) {
    const name = `${cgm.idOf(link.source)} → ${cgm.idOf(link.target)}`;
    const values = linkValues(link);
    formulas(link.id, name, values);
    for (const key of [CGM_KEYS.context, CGM_KEYS.opposite])
      if (
        link.properties[key]?.trim() &&
        !propertyKeysOfLink(link.kind).includes(key)
      )
        problems.push({
          severity: 'error',
          at: link.id,
          message: `${name}: a ${link.kind.split('.')[1]} has no ${key} (REJ 2010 Table 1: contexts sit on AND and OR refinements, means-end, dependencies and contributions)`,
        });
    const input: CheckInput = {
      props: values,
      raw: link.properties,
      kind: link.kind,
    };
    const message = parses(input, CGM_KEYS.opposite)
      ? cgmCheckRegistry['cgm.contribution.opposite'](input, context(link.id))
      : null;
    if (message)
      problems.push({
        severity: 'error',
        at: link.id,
        message: `${name}: ${message}`,
      });
  }
  return problems;
};
