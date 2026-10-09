'use client';

import {
  ISTAR_ACTOR_KINDS,
  ISTAR_LINK_KINDS,
  ISTAR_NODE_KINDS,
  metamodelExtensionOf,
  type ExtensionDefinition,
} from '@goal-controller/dialect';
import { writeAnnotations } from '@goal-controller/goal-language/light';
import type { IstarElement, IstarLink } from '@istar-ts/core';
import { LINE_DASHES, TEXT_BOXES, type IstarExtension } from '@istar-ts/react';

/**
 * piStar-ext in the diagram: iStar4RationalAgents' kinds and the model's own,
 * with their shapes (the canvas adds them to the palette, from the model's
 * metamodel), and every element's and link's stereotype and tagged value as
 * a header above its name, as piStar-ext draws them. istar-ts lays the label
 * out in the kind's text box and fits it (labelHeader, textBox, labelFit).
 */

/** What an element or link carries, as the goal language's annotations: `<<goal-based>> {Id = G1}`. */
export const labelAnnotations = (
  target: IstarElement<string> | IstarLink<string>,
): string | null => writeAnnotations(target.customProperties ?? {});

/** Its stereotype line, then its tagged value line (none: no header). */
const labelHeader = (
  target: IstarElement<string> | IstarLink<string>,
): string[] => {
  const { stereotype, tag, tagValue } = target.customProperties ?? {};
  return [
    writeAnnotations({ stereotype }),
    writeAnnotations({ tag, tagValue }),
  ].filter((line): line is string => line !== null);
};

type TextBox = (typeof TEXT_BOXES)[keyof typeof TEXT_BOXES];

const ACTORS: readonly string[] = ISTAR_ACTOR_KINDS;
const ACTOR_FIT = { minScale: 0.55 } as const;

/** Where an iStar kind's label goes so a header fits its shape (istar-ts's presets). */
const ISTAR_TEXT_BOX: Record<string, TextBox> = {
  'istar.Goal': TEXT_BOXES.goal,
  'istar.Task': TEXT_BOXES.task,
  'istar.Resource': TEXT_BOXES.resource,
  'istar.Quality': TEXT_BOXES.quality,
  ...Object.fromEntries(
    ISTAR_ACTOR_KINDS.map((kind) => [kind, TEXT_BOXES.actor]),
  ),
};

/**
 * piStar-ext for the canvas, as a model has it (the dialect with the model's
 * own constructs): its kinds, their shapes, text boxes and lines, and every
 * element's and link's annotations.
 */
export const pistarExtExtension = (
  extension: ExtensionDefinition,
): IstarExtension<string, string> => ({
  name: 'pistar-ext',
  metamodel: metamodelExtensionOf(extension),
  elements: Object.fromEntries(
    [
      ...ISTAR_ACTOR_KINDS,
      ...ISTAR_NODE_KINDS,
      ...extension.elements.map((e) => e.kind),
    ].map((kind) => {
      const own = extension.elements.find((e) => e.kind === kind);
      const textBox = own?.textBox ?? ISTAR_TEXT_BOX[kind];
      return [
        kind,
        {
          labelHeader,
          // an actor's circle is narrow for a stereotype line: let it shrink further
          ...(ACTORS.includes(kind) ? { labelFit: ACTOR_FIT } : {}),
          ...(textBox ? { textBox } : {}),
          ...(own?.shape ? { shape: { path: own.shape } } : {}),
        },
      ];
    }),
  ),
  links: Object.fromEntries(
    [
      ...ISTAR_LINK_KINDS.map((kind) => ({ kind, line: undefined })),
      ...extension.links,
    ].map(({ kind, line }) => [
      kind,
      {
        labelHeader,
        ...(line
          ? {
              line: {
                dash: LINE_DASHES[line.dash],
                marker: line.marker,
                markerFilled: line.markerFilled,
              },
            }
          : {}),
      },
    ]),
  ),
});
