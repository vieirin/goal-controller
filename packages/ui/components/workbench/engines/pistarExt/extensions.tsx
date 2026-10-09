'use client';

import {
  ISTAR_ACTOR_KINDS,
  ISTAR_LINK_KINDS,
  annotationsFor,
  metamodelExtensionOf,
  writeAnnotations,
  type ExtensionDefinition,
} from '@goal-controller/definitions';
import type { IstarElement, IstarLink } from '@istar-ts/core';
import {
  DefaultActorComponent,
  DefaultElementComponent,
  LINE_DASHES,
  type ElementComponentProps,
  type IstarExtension,
  type LinkLabelProps,
} from '@istar-ts/react';
import type { ReactElement } from 'react';
import { cx } from '../../ui';
import { DIALECTS, DIALECT_DEFINITIONS } from '@/lib/workbench/dialects';

/**
 * piStar-ext in the diagram: iStar4RationalAgents' kinds with their shapes (the
 * canvas adds them to the palette, from the model's metamodel), and every
 * element's and link's stereotype and tagged value, as piStar-ext draws them:
 * above an element, on a link's label.
 */

const dialect: ExtensionDefinition = DIALECTS.pistarext;
const definition = DIALECT_DEFINITIONS.pistarext;

/** What an element or link carries, by its kind's annotations: `<<goal-based>> {Id = G1}`. */
export const labelAnnotations = (
  target: IstarElement<string> | IstarLink<string>,
): string | null =>
  writeAnnotations(
    annotationsFor(dialect, target.kind),
    target.customProperties ?? {},
  );

/** An element's or link's annotations, as text (where to put it is the caller's). */
function Annotations({
  target,
  className,
}: {
  target: IstarElement<string> | IstarLink<string>;
  className?: string;
}): ReactElement | null {
  const text = labelAnnotations(target);
  return text ? (
    <span
      className={cx(
        'whitespace-nowrap font-mono text-[10px] italic leading-4 text-ink-soft',
        className,
      )}
      title={text}
    >
      {text}
    </span>
  ) : null;
}

const { stereotype: STEREOTYPE, taggedValue: TAGGED_VALUE } =
  dialect.annotations;

/**
 * A link's label: its annotations, then what the kind's default label draws (is-a,
 * a contribution's value, the link's name), which this label replaces.
 */
function AnnotatedLinkLabel({
  link,
  labels,
}: LinkLabelProps): ReactElement | null {
  const texts = [labels.fixed, labels.value, labels.name].filter(Boolean);
  if (!labelAnnotations(link) && texts.length === 0) return null;
  return (
    <span className='flex flex-col items-center rounded bg-white/80 px-1 text-[10px] leading-4 text-ink-soft'>
      <Annotations target={link} />
      {texts.map((text) => (
        <span key={text}>{text}</span>
      ))}
    </span>
  );
}

/**
 * An element drawn as piStar-ext draws it: its stereotype on a line above its
 * name, and its tagged value before its name (`<<action>>` / `{type=Duty} Task`),
 * in its label. While the name is edited it is the name alone.
 */
const annotated = (
  Base: (props: ElementComponentProps) => ReactElement,
): ((props: ElementComponentProps) => ReactElement) =>
  function Annotated(props) {
    const properties = props.element.customProperties ?? {};
    const stereotype = writeAnnotations([STEREOTYPE], properties);
    const tag = writeAnnotations([TAGGED_VALUE], properties);
    const name = [tag, props.element.name].filter(Boolean).join(' ');
    // the label keeps line breaks (istar-ts's `pre-wrap`)
    const shown = stereotype ? `${stereotype}\n${name}` : name;
    return (
      <Base
        {...props}
        element={
          props.editing || shown === props.element.name
            ? props.element
            : { ...props.element, name: shown }
        }
      />
    );
  };

const AnnotatedNode = annotated(DefaultElementComponent);
const AnnotatedActor = annotated(DefaultActorComponent);

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
  links: Object.fromEntries([
    ...ISTAR_LINK_KINDS.map((kind) => [
      kind,
      { labelComponent: AnnotatedLinkLabel },
    ]),
    ...dialect.links.map(({ kind, line }) => [
      kind,
      {
        labelComponent: AnnotatedLinkLabel,
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
  ]),
};
