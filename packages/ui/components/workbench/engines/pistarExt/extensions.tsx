'use client';

import {
  ISTAR_ACTOR_KINDS,
  annotationsOf,
  metamodelExtensionOf,
  writeAnnotations,
  type ExtensionDefinition,
} from '@goal-controller/definitions';
import type { IstarElement } from '@istar-ts/core';
import {
  DefaultActorComponent,
  DefaultElementComponent,
  LINE_DASHES,
  type ElementComponentProps,
  type IstarExtension,
} from '@istar-ts/react';
import type { ReactElement } from 'react';
import { DIALECTS, DIALECT_DEFINITIONS } from '@/lib/workbench/dialects';

/**
 * piStar-ext in the diagram: iStar4RationalAgents' kinds with their shapes (the
 * canvas adds them to the palette, from the model's metamodel), and every
 * element's stereotype and tagged value above it, as piStar-ext draws them.
 */

const dialect: ExtensionDefinition = DIALECTS.pistarext;
const definition = DIALECT_DEFINITIONS.pistarext;

/** What an element carries before its name, by its kind's annotations: `<<goal-based>> {Id = G1}`. */
export const labelAnnotations = (element: IstarElement): string | null =>
  writeAnnotations(
    annotationsOf(definition, element.kind),
    element.customProperties ?? {},
  );

function LabelAnnotations({
  element,
}: Pick<ElementComponentProps, 'element'>): ReactElement | null {
  const text = labelAnnotations(element);
  return text ? (
    <span
      className='pointer-events-none absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[10px] italic leading-4 text-ink-soft'
      title={text}
    >
      {text}
    </span>
  ) : null;
}

function AnnotatedNode(props: ElementComponentProps): ReactElement {
  return (
    <div className='relative h-full w-full'>
      <DefaultElementComponent {...props} />
      <LabelAnnotations element={props.element} />
    </div>
  );
}

function AnnotatedActor(props: ElementComponentProps): ReactElement {
  return (
    <div className='relative h-full w-full'>
      <DefaultActorComponent {...props} />
      <LabelAnnotations element={props.element} />
    </div>
  );
}

/** Whether a kind of the dialect's definition is an actor (iStar's, or one behaving like one). */
const isActorKind = (kind: string): boolean => {
  const own = dialect.elements.find((e) => e.kind === kind);
  const behaves = own?.behavesLike ?? kind;
  return (
    own?.category === 'actor' ||
    (ISTAR_ACTOR_KINDS as readonly string[]).includes(behaves)
  );
};

export const PISTAR_EXT_EXTENSION: IstarExtension<string, string> = {
  name: 'pistar-ext',
  metamodel: metamodelExtensionOf(dialect),
  elements: Object.fromEntries(
    Object.keys(definition.elements).map((kind) => {
      const shape = dialect.elements.find((e) => e.kind === kind)?.shape;
      return [
        kind,
        {
          component: isActorKind(kind) ? AnnotatedActor : AnnotatedNode,
          ...(shape ? { shape: { path: shape } } : {}),
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
