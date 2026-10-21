'use client';

import { useMemo } from 'react';
import { kaosExtension } from '@istar-ts/dsm3-kaos';
import { nfrExtension } from '@istar-ts/dsm3-nfr';
import type { AnyDialect } from '@goal-controller/dialect';
import {
  defineProperties,
  type IstarModel,
  type PropertySchema,
  type PropertyShape,
} from '@istar-ts/core';
import { IstarInspector, type IstarExtension } from '@istar-ts/react';
import { nextFrameworkId } from '@/lib/workbench/frameworkOpen';
import {
  itemKeyedProperties,
  linkSchemaOf,
  schemaOf,
  type ResourceEntries,
} from '@/lib/workbench/frameworkProperties';
import type { FrameworkMode } from '@/lib/workbench/frameworkModes';
import WorkbenchCanvas from '../shared/WorkbenchCanvas';
import { useWorkbench } from '../../WorkbenchContext';
import { useProfiledDefinition } from './useProfiledDefinition';
import { keyedElementInspector, keyedLinkInspector } from './KeyedInspector';

/**
 * A framework's registry parts as the workbench's canvas takes them. The
 * workbench types every model, and so its store and provider, as an iStar
 * 2.0 one (lib/workbench/dialects.ts: a model keeps its own metamodel, which
 * istar-ts reads at run time), so an extension typed with KAOS's or NFR's
 * kinds is widened here, the one place it is (goal-controller#171).
 */
const forCanvas = <EK extends string, LK extends string>(
  extension: IstarExtension<EK, LK>,
): IstarExtension => extension as unknown as IstarExtension;

/** A kind's name as people read it: `kaos.BehavioralGoal` is "Behavioral Goal". */
const labelOf = (kind: string): string =>
  kind.replace(/^[^.]+\./, '').replace(/([a-z])([A-Z])/g, '$1 $2');

/**
 * What the workbench adds to a framework's registry parts, from its dialect
 * (goal-controller#171): a new element named with its next id (`G3:
 * Behavioral Goal`), so its Notation line names it; kinds sharing a prefix
 * (KAOS's two goals) share its numbering. Each kind's fill is istar-ts's
 * (its shape's `fill`, the dialect's too: KAOS_FILL, NFR_FILL). Properties a
 * kind's definition declares (nfrprop's `initialLabel`, goal-controller#327)
 * are typed here too, element kinds and link kinds alike; a kind with
 * properties keyed by names an item has (kaossim's quality variables,
 * goal-controller#376) gets the inspector that adds their fields.
 */
export const dialectParts = (
  definition: AnyDialect,
  entries?: ResourceEntries,
): IstarExtension =>
  ({
    name: `${definition.id}-dialect`,
    elements: Object.fromEntries(
      [
        ...new Set([
          ...Object.keys(definition.elements),
          ...Object.keys(definition.properties),
        ]),
      ].flatMap((kind) => {
        const element = (definition.elements as AnyDialect['elements'])[kind];
        const properties = schemaOf(definition, kind, entries);
        const keyed = itemKeyedProperties(definition.properties[kind]);
        if (!element?.prefix && !properties && !keyed.length) return [];
        return [
          [
            kind,
            {
              ...(element?.prefix && {
                defaultName: ({ model }: { model: IstarModel }) =>
                  `${nextFrameworkId(model, element.prefix!)}: ${labelOf(kind)}`,
              }),
              ...(properties && { properties }),
              ...(keyed.length > 0 && {
                inspector: keyedElementInspector(keyed),
              }),
            },
          ],
        ];
      }),
    ),
    links: Object.fromEntries(
      Object.keys(definition.links ?? {}).flatMap((kind) => {
        const properties = linkSchemaOf(definition, kind);
        const keyed = itemKeyedProperties(definition.links?.[kind]);
        return properties || keyed.length
          ? [
              [
                kind,
                {
                  ...(properties && { properties }),
                  ...(keyed.length > 0 && {
                    inspector: keyedLinkInspector(keyed),
                  }),
                },
              ],
            ]
          : [];
      }),
    ),
  }) as IstarExtension;

/**
 * A kind's registry part, with its own `properties` kept alongside the
 * dialect's added ones (goal-controller#327): `applyExtensions` replaces a
 * kind's `properties` whole when a later extension sets one (istar-ts's
 * `IstarExtension`), so a kind both istar-ts's extension and the dialect
 * type (KAOS's goals: istar-ts's `behavioralGoalProperties`, the dialect's
 * same keys) would lose whichever typed it first. Merged here before either
 * is applied; the dialect's own value wins a key both give (there is none
 * today: the dialect types exactly istar-ts's keys, goal-controller#229).
 */
export const withOwnProperties = (
  dialect: IstarExtension,
  own: IstarExtension,
): IstarExtension => ({
  ...dialect,
  elements: mergedProperties(dialect.elements, own.elements),
  links: mergedProperties(dialect.links, own.links),
});

type PropertyOwners =
  | Readonly<
      Record<string, { properties?: PropertySchema<PropertyShape, string> }>
    >
  | undefined;

const mergedProperties = (
  dialectKinds: PropertyOwners,
  ownKinds: PropertyOwners,
): PropertyOwners =>
  dialectKinds &&
  Object.fromEntries(
    Object.entries(dialectKinds).map(([kind, config]) => {
      const ownSchema = ownKinds?.[kind]?.properties;
      const { properties } = config;
      if (!ownSchema || !properties) return [kind, config];
      return [
        kind,
        {
          ...config,
          properties: defineProperties<PropertyShape, string>(kind, {
            ...ownSchema.shape,
            ...properties.shape,
          }),
        },
      ];
    }),
  );

/** Each framework's look: istar-ts's registry parts for it. */
const BASE_EXTENSIONS: Readonly<Record<FrameworkMode, IstarExtension>> = {
  kaos: forCanvas(kaosExtension),
  nfr: forCanvas(nfrExtension),
};

/**
 * A KAOS or NFR model (goal-controller#171): the canvas with its framework's
 * shapes and palette (hubs, link-anchored links and nodes on the paper are
 * istar-ts's), and istar-ts's inspector beside it. `definition` is the
 * dialect whose properties it types (goal-controller#327): the framework's
 * modelling dialect for a `kaos`/`nfr` model, a framework engine's own
 * (nfrprop's `initialLabel`) for one of its models.
 */
export default function FrameworkDiagram({
  mode,
  definition: given,
  entries,
}: {
  mode: FrameworkMode;
  definition: AnyDialect;
  /** the project resources' entries a keyed property has a field per (kaosexpert's experts, goal-controller#190, #354) */
  entries?: ResourceEntries;
}) {
  const base = BASE_EXTENSIONS[mode];
  // with the vocabulary profile the model records (a CAIRIS model's, #192)
  const definition = useProfiledDefinition(given, useWorkbench().text);
  // by content: the resources are parsed again on every edit of theirs
  const entriesKey = JSON.stringify(entries ?? {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableEntries = useMemo(() => entries, [entriesKey]);
  const extensions = useMemo(
    () => [
      base,
      withOwnProperties(dialectParts(definition, stableEntries), base),
    ],
    [base, definition, stableEntries],
  );
  return (
    <WorkbenchCanvas
      extensions={extensions}
      aside={<IstarInspector />}
      paletteOnTop
      fitKey={mode}
    />
  );
}
