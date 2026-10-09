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
import {
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
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

const { stereotype: STEREOTYPE, taggedValue: TAGGED_VALUE } =
  dialect.annotations;

/**
 * An element's or link's annotations, as piStar-ext stacks them: its stereotype
 * line, then its tagged value line, small and italic. A line too long for its
 * box ends in an ellipsis, with the whole text on hover.
 */
function Annotations({
  target,
}: {
  target: IstarElement<string> | IstarLink<string>;
}): ReactElement | null {
  const properties = target.customProperties ?? {};
  const lines = [
    writeAnnotations([STEREOTYPE], properties),
    writeAnnotations([TAGGED_VALUE], properties),
  ].filter((line): line is string => line !== null);
  return lines.length ? (
    <>
      {lines.map((line) => (
        <span
          key={line}
          className='block max-w-full shrink-0 truncate text-[0.75em] font-normal italic leading-[1.2] text-ink-soft'
          title={line}
        >
          {line}
        </span>
      ))}
    </>
  ) : null;
}

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
    <span className='flex max-w-40 flex-col items-center rounded bg-white/80 px-1 text-[10px] leading-4 text-ink-soft'>
      <Annotations target={link} />
      {texts.map((text) => (
        <span key={text}>{text}</span>
      ))}
    </span>
  );
}

type TextBox = { top: number; right: number; bottom: number; left: number };

/** Where a node's or an actor symbol's label goes, when its kind doesn't say. */
const NODE_TEXT: TextBox = { top: 0.06, right: 0.1, bottom: 0.06, left: 0.1 };
const ACTOR_TEXT: TextBox = {
  top: 0.18,
  right: 0.16,
  bottom: 0.18,
  left: 0.16,
};

/** The label's size (piStar's) and how far it may shrink to fit its box. */
const LABEL_PX = 12;
const SMALLEST = 0.7;

/**
 * A label that fits its box: its font shrinks in steps while its lines overflow
 * the box (taller, or a line wider), down to SMALLEST; past that a line ends in
 * an ellipsis, whole on hover.
 */
function FittedLabel({
  box,
  children,
}: {
  box: TextBox;
  children: ReactNode;
}): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  // every render: shrink while its lines overflow (it stops at SMALLEST)
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || scale <= SMALLEST) return;
    const overflows =
      el.scrollHeight > el.clientHeight + 1 ||
      [...el.children].some((line) => line.scrollWidth > line.clientWidth + 1);
    if (overflows) setScale(Math.max(SMALLEST, scale - 0.1));
  });
  // the node is sized after its first render, and resized by hand: when its
  // box changes size, from full size again (then fitted above)
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let last = `${el.clientWidth}x${el.clientHeight}`;
    const observer = new ResizeObserver(() => {
      const size = `${el.clientWidth}x${el.clientHeight}`;
      if (size === last) return;
      last = size;
      setScale(1);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className='pointer-events-none absolute flex flex-col items-center overflow-hidden text-center'
      style={{
        // safe: a label taller than its box overflows below, where it is measured
        justifyContent: 'safe center',
        top: `${box.top * 100}%`,
        right: `${box.right * 100}%`,
        bottom: `${box.bottom * 100}%`,
        left: `${box.left * 100}%`,
        fontSize: `${LABEL_PX * scale}px`,
      }}
    >
      {children}
    </div>
  );
}

/**
 * An element drawn as piStar-ext draws it: inside its shape, its annotations
 * stacked above its name (Annotations), in its kind's text box. The shape draws
 * no label of its own then; while the name is edited it is the shape's again.
 */
const annotated = (
  Base: (props: ElementComponentProps) => ReactElement,
  fallback: TextBox,
): ((props: ElementComponentProps) => ReactElement) =>
  function Annotated(props) {
    const { element } = props;
    const plain =
      props.editing ||
      labelAnnotations(element as IstarElement<string>) === null;
    if (plain) return <Base {...props} />;
    const box =
      dialect.elements.find((e) => e.kind === element.kind)?.textBox ??
      fallback;
    return (
      <div className='relative h-full w-full'>
        <Base {...props} element={{ ...element, name: '' }} />
        {/* measured again, from full size, when its text changes */}
        <FittedLabel
          key={`${labelAnnotations(element as IstarElement<string>)}|${element.name}`}
          box={box}
        >
          <Annotations target={element as IstarElement<string>} />
          <span
            className='line-clamp-2 max-w-full shrink-0 font-bold leading-[1.15]'
            style={{ color: 'var(--istar-node-text)' }}
            title={element.name}
          >
            {element.name}
          </span>
        </FittedLabel>
      </div>
    );
  };

const AnnotatedNode = annotated(DefaultElementComponent, NODE_TEXT);
const AnnotatedActor = annotated(DefaultActorComponent, ACTOR_TEXT);

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
