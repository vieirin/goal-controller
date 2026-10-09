'use client';

import {
  ISTAR_ACTOR_KINDS,
  ISTAR_NODE_KINDS,
  annotationKeys,
  metamodelExtensionOf,
  profileOf,
  type ExtensionDefinition,
} from '@goal-controller/definitions';
import { defineProperties, prop } from '@istar-ts/core';
import {
  DefaultActorComponent,
  DefaultElementComponent,
  LINE_DASHES,
  type ElementComponentProps,
  type IstarExtension,
} from '@istar-ts/react';
import type { ReactElement } from 'react';
import { DIALECTS, labelAnnotations } from '@/lib/workbench/dialects';

/**
 * The dialects in the diagram (lib/workbench/dialects.ts): their kinds with
 * their shapes and lines, every element's stereotype and tagged value above it
 * (as piStar-ext draws them), and fields for them in piStar mode's inspector.
 */

/** An element's stereotype and tagged value, above it: `<<goal-based>> {Id = G1}`. */
function LabelAnnotations({
  element,
}: Pick<ElementComponentProps, 'element'>): ReactElement | null {
  const text = labelAnnotations(element.customProperties);
  return text ? (
    <span
      className='pointer-events-none absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[10px] italic leading-4 text-ink-soft'
      title={text}
    >
      {text}
    </span>
  ) : null;
}

/** An intentional element as istar-ts draws it, with its annotations. */
export function AnnotatedNode(props: ElementComponentProps): ReactElement {
  return (
    <div className='relative h-full w-full'>
      <DefaultElementComponent {...props} />
      <LabelAnnotations element={props.element} />
    </div>
  );
}

/** An actor as istar-ts draws it, with its annotations. */
function AnnotatedActor(props: ElementComponentProps): ReactElement {
  return (
    <div className='relative h-full w-full'>
      <DefaultActorComponent {...props} />
      <LabelAnnotations element={props.element} />
    </div>
  );
}

const ACTORS: readonly string[] = ISTAR_ACTOR_KINDS;

/** A dialect for the canvas: its kinds, how they look, and its annotations on every element. */
const dialectExtension = (
  dialect: ExtensionDefinition,
): IstarExtension<string, string> => {
  const keys = annotationKeys(dialect);
  const isActor = (kind: string): boolean => {
    const own = dialect.elements.find((e) => e.kind === kind);
    return own
      ? own.category === 'actor' || ACTORS.includes(own.behavesLike ?? '')
      : ACTORS.includes(kind);
  };
  const kinds = [
    ...ISTAR_ACTOR_KINDS,
    ...ISTAR_NODE_KINDS,
    ...dialect.elements.map((e) => e.kind),
  ];
  return {
    name: `dialect-${dialect.name}`,
    metamodel: metamodelExtensionOf(dialect),
    elements: Object.fromEntries(
      kinds.map((kind) => {
        const { stereotypes, tags } = profileOf(dialect, kind);
        const shape = dialect.elements.find((e) => e.kind === kind)?.shape;
        return [
          kind,
          {
            component: isActor(kind) ? AnnotatedActor : AnnotatedNode,
            ...(shape ? { shape: { path: shape } } : {}),
            // the tagged value's value is free text here (no field depends on another)
            properties: defineProperties(kind, {
              ...(stereotypes.length
                ? { [keys.stereotype]: prop.enum(stereotypes) }
                : {}),
              [keys.tag]: prop.enum(
                tags.map((tag) => (typeof tag === 'string' ? tag : tag.name)),
              ),
              ...(keys.tagValue ? { [keys.tagValue]: prop.string() } : {}),
            }),
          },
        ];
      }),
    ),
    links: Object.fromEntries(
      dialect.links.flatMap(({ kind, line }) =>
        line
          ? [
              [
                kind,
                {
                  line: {
                    dash: LINE_DASHES[line.dash],
                    marker: line.marker,
                    markerFilled: line.markerFilled,
                  },
                },
              ],
            ]
          : [],
      ),
    ),
  };
};

/** Every dialect, for every canvas: before a mode's own extensions, which may draw over them. */
export const DIALECT_EXTENSIONS: readonly IstarExtension<string, string>[] =
  DIALECTS.map(dialectExtension);

/** The dialects' kinds, hidden from a palette whose engine cannot read them. */
export const DIALECT_KINDS_HIDDEN: IstarExtension<string, string>['elements'] =
  Object.fromEntries(
    DIALECTS.flatMap((dialect) =>
      dialect.elements.map((element) => [element.kind, { palette: false }]),
    ),
  );
