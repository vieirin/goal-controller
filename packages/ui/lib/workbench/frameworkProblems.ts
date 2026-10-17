/**
 * What is wrong with a KAOS or NFR model (goal-controller#171), as problems
 * of the diagnostics protocol: each link istar-ts's validator rejects, by
 * its constraint code (DSM3's rules: `invalid-source`, `invalid-target`,
 * `duplicate-link`, `self-link`, and a hub's, `hub-target` and
 * `incomplete-hub`), anchored on the link or the hub; each link whose
 * label isn't one its dialect's `linkLabels` lists (an NFR contribution's);
 * and goal-controller#181's: a link of a `leafTargets` kind onto a refined
 * element (a KAOS obstacle obstructing a refined goal), and a `reference`
 * value naming no element of its kinds (a resolution's `Anchor`).
 */
import { validateModel, type IstarModel } from '@istar-ts/core';
import { refinementsOf } from '@goal-controller/goal-tree';
import type { AnyDialect, PropertyDefinition } from '@goal-controller/dialect';
import type { Problem } from './types';

/** A link kind as people read it: `nfr.ContributionLink` is "Contribution link". */
const linkLabel = (kind: string): string =>
  kind
    .replace(/^[^.]+\./, '')
    .replace(/Link$/, ' link')
    .replace(/([a-z])([A-Z])/g, '$1 $2');

/** The model's problems as its framework's dialect says them (source: the dialect's name). */
export const frameworkProblems = (
  model: IstarModel,
  definition: Pick<AnyDialect, 'name' | 'linkLabels'> &
    Partial<
      Pick<
        AnyDialect,
        'framework' | 'refinements' | 'leafTargets' | 'properties' | 'links'
      >
    >,
): Problem[] => [
  ...leafTargetProblems(model, definition),
  ...referenceProblems(model, definition),
  ...validateModel(model).map((issue): Problem => ({
    severity: 'error',
    source: definition.name,
    elementId: issue.linkId,
    code: issue.code,
    message: issue.message,
  })),
  ...[...model.links.values()].flatMap((link): Problem[] => {
    const labels = definition.linkLabels?.[link.kind];
    if (!labels || (link.label !== undefined && labels.includes(link.label)))
      return [];
    return [
      {
        severity: 'error',
        source: definition.name,
        elementId: link.id,
        code: 'unknown-label',
        message: `A ${linkLabel(link.kind).toLowerCase()}'s label is one of ${labels.join(', ')}, not ${link.label === undefined ? 'none' : `"${link.label}"`}`,
      },
    ];
  }),
];

/** An element as people read it: its text, quoted. */
const quoted = (model: IstarModel, id: string): string =>
  `"${model.elements.get(id)?.name ?? id}"`;

/** Links of a `leafTargets` kind onto an element a refinement refines. */
const leafTargetProblems = (
  model: IstarModel,
  definition: Pick<AnyDialect, 'name'> &
    Partial<Pick<AnyDialect, 'framework' | 'refinements' | 'leafTargets'>>,
): Problem[] => {
  const kinds = definition.leafTargets ?? [];
  if (!kinds.length) return [];
  const refined = new Set(
    [...refinementsOf(model as never, definition).byLink.values()].map(
      (refinement) => refinement.parent,
    ),
  );
  return [...model.links.values()]
    .filter((link) => kinds.includes(link.kind) && refined.has(link.target))
    .map((link) => ({
      severity: 'warning',
      source: definition.name,
      elementId: link.id,
      code: 'not-a-leaf',
      message: `A ${linkLabel(link.kind).toLowerCase()} targets a leaf, and ${quoted(model, link.target)} is refined: link its sub-elements instead`,
    }));
};

/** The element a reference names: by its piStar id, or the id its text starts with (`G1: …`). */
const referenced = (model: IstarModel, value: string) =>
  model.elements.get(value) ??
  [...model.elements.values()].find((element) =>
    element.name.startsWith(`${value}: `),
  );

/** The `reference` properties of a list (an element kind's, a link kind's). */
const referencesOf = (list: readonly PropertyDefinition[] | undefined) =>
  (list ?? []).flatMap((property) =>
    !('when' in property.value) && property.value.type === 'reference'
      ? [{ key: property.key, kinds: property.value.kinds }]
      : [],
  );

/** Each `reference` value, on an element or a link, that names no element of its kinds. */
const referenceProblems = (
  model: IstarModel,
  definition: Pick<AnyDialect, 'name'> &
    Partial<Pick<AnyDialect, 'properties' | 'links'>>,
): Problem[] => {
  const owners = [
    ...[...model.elements.values()].map((element) => ({
      owner: element,
      list: definition.properties?.[element.kind],
    })),
    ...[...model.links.values()].map((link) => ({
      owner: link,
      list: definition.links?.[link.kind],
    })),
  ];
  return owners.flatMap(({ owner, list }) =>
    referencesOf(list).flatMap(({ key, kinds }): Problem[] => {
      const value = owner.customProperties?.[key]?.trim();
      if (!value) return [];
      const element = referenced(model, value);
      if (element && (kinds as readonly string[]).includes(element.kind))
        return [];
      return [
        {
          severity: 'error',
          source: definition.name,
          elementId: owner.id,
          key,
          code: 'dangling-reference',
          message: element
            ? `${key}: ${value} is a ${element.kind}, not a ${kinds.join(' or ')}`
            : `${key}: ${value} is not an element of this model`,
        },
      ];
    }),
  );
};
