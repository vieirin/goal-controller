/**
 * What is wrong with a KAOS or NFR model (goal-controller#171), as problems
 * of the diagnostics protocol: each link istar-ts's validator rejects, by
 * its constraint code (DSM3's rules: `invalid-source`, `invalid-target`,
 * `duplicate-link`, `self-link`, and a hub's, `hub-target` and
 * `incomplete-hub`), anchored on the link or the hub; each link whose
 * label isn't one its dialect's `linkLabels` lists (an NFR contribution's);
 * and goal-controller#181's: a link of a `leafTargets` kind onto a refined
 * element (a KAOS obstacle obstructing a refined goal), and a name that
 * resolves to nothing of its target (goal-controller#354): a `reference`
 * value naming no element of its kinds (a resolution's `Anchor`), a keyed
 * key naming no entry of its resource (an expert's `Probability[e9]`).
 */
import { validateModel } from '@istar-ts/core';
import { refinementsOf } from '@goal-controller/goal-tree';
import {
  danglingName,
  enumOptionOf,
  valueOf,
  type AnyDialect,
  type ProjectResourceContext,
  type PropertyDefinition,
  type Target,
  type TargetScope,
} from '@goal-controller/dialect';
import { keyedKeyOf } from '@goal-controller/goal-language';
import type { AnyModel } from '@goal-controller/lib';
import type { Problem } from './types';

/** A link kind as people read it: `nfr.ContributionLink` is "Contribution link". */
const linkLabel = (kind: string): string =>
  kind
    .replace(/^[^.]+\./, '')
    .replace(/Link$/, ' link')
    .replace(/([a-z])([A-Z])/g, '$1 $2');

/** The model's problems as its framework's dialect says them (source: the dialect's name). */
export const frameworkProblems = (
  model: AnyModel,
  definition: Pick<AnyDialect, 'name' | 'linkLabels'> &
    Partial<
      Pick<
        AnyDialect,
        | 'framework'
        | 'refinements'
        | 'leafTargets'
        | 'properties'
        | 'links'
        | 'projectResources'
      >
    >,
  /** the project's resources, parsed (their entries are what a keyed key may name) */
  resources?: Readonly<Record<string, ProjectResourceContext>>,
): Problem[] => [
  ...leafTargetProblems(model, definition),
  ...referenceProblems(model, definition, resources),
  ...enumValueProblems(model, definition),
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
const quoted = (model: AnyModel, id: string): string =>
  `"${model.elements.get(id)?.name ?? id}"`;

/** Links of a `leafTargets` kind onto an element a refinement refines. */
const leafTargetProblems = (
  model: AnyModel,
  definition: Pick<AnyDialect, 'name'> &
    Partial<Pick<AnyDialect, 'framework' | 'refinements' | 'leafTargets'>>,
): Problem[] => {
  const kinds = definition.leafTargets ?? [];
  if (!kinds.length) return [];
  const refined = new Set(
    [...refinementsOf(model, definition).byLink.values()].map(
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
const referenced = (model: AnyModel, value: string) =>
  model.elements.get(value) ??
  [...model.elements.values()].find((element) =>
    element.name.startsWith(`${value}: `),
  );

/** The texts of an owner's properties (a model may hold other values). */
const textsOf = (properties: Readonly<Record<string, unknown>> | undefined) =>
  Object.fromEntries(
    Object.entries(properties ?? {}).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );

/**
 * What an owner's properties name (goal-controller#354): each `reference`
 * value's one name, and each keyed key's name (`Probability[e1]`), with the
 * target it is one of.
 */
const namesOf = (
  list: readonly PropertyDefinition[] | undefined,
  properties: Readonly<Record<string, string>>,
): { key: string; name: string; target: Target }[] => [
  ...(list ?? []).flatMap((property) => {
    const value = valueOf(property, properties);
    const name = properties[property.key]?.trim();
    return value.type === 'reference' && name
      ? [{ key: property.key, name, target: value.target }]
      : [];
  }),
  ...Object.keys(properties).flatMap((key) => {
    const keyed = keyedKeyOf(key);
    const property = keyed && list?.find((p) => p.key === keyed.key && p.keyed);
    return keyed && property?.keyed
      ? [{ key, name: keyed.name, target: property.keyed }]
      : [];
  }),
];

/**
 * Each name, on an element or a link, that resolves to nothing of its target
 * (goal-controller#354): a `reference` naming no element of its kinds (a
 * resolution's `Anchor`), a keyed key naming no entry of its resource
 * (kaosexpert's `Probability[e9]`, where the project's experts are read).
 */
const referenceProblems = (
  model: AnyModel,
  definition: Pick<AnyDialect, 'name'> &
    Partial<Pick<AnyDialect, 'properties' | 'links' | 'projectResources'>>,
  resources: Readonly<Record<string, ProjectResourceContext>> = {},
): Problem[] => {
  const scope: TargetScope = {
    kindOf: (id) => referenced(model, id)?.kind,
    entriesOf: (resource) => resources[resource]?.entries,
  };
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
    namesOf(list, textsOf(owner.customProperties)).flatMap(
      ({ key, name, target }): Problem[] => {
        const dangling = danglingName(
          target,
          name,
          scope,
          definition.projectResources,
        );
        return dangling
          ? [
              {
                severity: 'error',
                source: definition.name,
                elementId: owner.id,
                key,
                code: 'dangling-reference',
                message: `${key}: ${dangling}`,
              },
            ]
          : [];
      },
    ),
  );
};

/**
 * A property's value, when it isn't one its dialect's enum lists (a typo in
 * `initialLabel`), as `unknown-label` reports one for a link's label. An
 * `open` enum (free text besides its options) and an unset value (`''`,
 * which a schema's enum keeps as "unset", goal-controller#327) are not
 * problems.
 */
const enumValueProblems = (
  model: AnyModel,
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
  return owners.flatMap(({ owner, list }) => {
    const properties = textsOf(owner.customProperties);
    return (list ?? []).flatMap((property): Problem[] => {
      const config = valueOf(property, properties);
      const value = properties[property.key];
      if (config.type !== 'enum' || config.open || !value) return [];
      if (enumOptionOf(config, value) !== undefined) return [];
      const options = config.options
        .map((option) => option.value)
        .filter((option) => option !== '');
      return [
        {
          severity: 'error',
          source: definition.name,
          elementId: owner.id,
          key: property.key,
          code: 'unknown-property-value',
          message: `${property.key} is one of ${options.join(', ')}, not "${value}"`,
        },
      ];
    });
  });
};
