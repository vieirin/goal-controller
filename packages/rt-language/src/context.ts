/**
 * What the notation cannot express, sent by the editor as the `rt/context`
 * notification: the diagram's elements (kind, children, custom properties), the
 * workbench's variables, and the engine's property rules (injected where the
 * server starts, so the rules stay the engine's own). Without it the checks that
 * need the model are skipped.
 */
import type { RtConstruct, RtRelation } from './constructs.js';

export type RtElementKind = 'goal' | 'task' | 'resource';

export type RtContextElement = {
  kind: RtElementKind;
  /** RT ids of its goal/task children, in the notation's order */
  children: readonly string[];
  /** its custom properties, as stored */
  properties: Readonly<Record<string, string>>;
  /** how it refines its children (AND/OR links), if it does */
  relation?: RtRelation | null;
  /** the construct its saved notation expresses, as the engine reads it */
  construct?: RtConstruct | null;
};

export type RtContextRecord = {
  elements: Readonly<Record<string, RtContextElement>>;
  /** names an assertion may read besides resources (the workbench variables) */
  variables: readonly string[];
};

export type RtProperties = Partial<Record<string, string>>;

/** What is wrong with a property value (null when fine): an engine check. */
export type RtCheck = (
  raw: RtProperties,
  context: { self: string; kindOf: (id: string) => RtElementKind | undefined },
) => string | null;

/** How an engine reads one property (structurally the UI's PropertySpec). */
export type RtPropertyRule = {
  key: string;
  applies?: (properties: RtProperties) => boolean;
  notApplying?: (properties: RtProperties) => string;
  validate?: RtCheck;
};

export type RtPropertyRules = Readonly<
  Record<RtElementKind, readonly RtPropertyRule[]>
>;

export const CONTEXT_NOTIFICATION = 'rt/context';

/** What the editors say about a notation that does not match the structure. */
export const NOT_A_CHILD = 'Not a child of this goal';
export const MISSING_FROM_NOTATION = 'Missing from the notation';
export const NOT_IN_DIAGRAM = 'Add this element in the diagram';

/**
 * How serious each notation/structure mismatch is, for every editor (Notation
 * view, inspector, Problems). The engine generates in each case, but it drops
 * what it cannot use: a notation naming a non-child or contradicting the links
 * is not what the model says (error); an unlisted child is appended (warning).
 */
export const NOTATION_SEVERITY = {
  notAChild: 'error',
  relationMismatch: 'error',
  missingFromNotation: 'warning',
} as const;

export type RtResource = {
  type: string;
  lowerBound?: number;
  upperBound?: number;
  initialValue?: string;
};

const RT_KIND: Record<string, RtElementKind> = {
  G: 'goal',
  T: 'task',
  R: 'resource',
};

export class RtContext {
  private record: RtContextRecord | undefined;
  rules: RtPropertyRules | undefined;

  set(record: RtContextRecord | undefined): void {
    this.record = record;
  }

  get known(): boolean {
    return this.record !== undefined;
  }

  has(id: string): boolean {
    return this.record?.elements[id] !== undefined;
  }

  /** the element's goal/task children, or undefined when the context is unknown */
  childrenOf(id: string): readonly string[] | undefined {
    return this.record ? (this.record.elements[id]?.children ?? []) : undefined;
  }

  /** an element's kind in the model (what the engine's checks ask) */
  kindOf(id: string): RtElementKind | undefined {
    return this.record?.elements[id]?.kind;
  }

  /** an element's kind: from the model, else from its RT id's letter */
  kindOfLine(id: string): RtElementKind | undefined {
    return this.kindOf(id) ?? RT_KIND[id[0] ?? ''];
  }

  element(id: string): RtContextElement | undefined {
    return this.record?.elements[id];
  }

  propertiesOf(id: string): Readonly<Record<string, string>> {
    return this.record?.elements[id]?.properties ?? {};
  }

  resource(id: string): RtResource | undefined {
    const element = this.record?.elements[id];
    if (element?.kind !== 'resource') return undefined;
    const {
      type = '',
      lowerBound,
      upperBound,
      initialValue,
    } = element.properties;
    const int = (value: string | undefined) =>
      value === undefined || value === '' || isNaN(parseInt(value, 10))
        ? undefined
        : parseInt(value, 10);
    return {
      type,
      lowerBound: int(lowerBound),
      upperBound: int(upperBound),
      initialValue,
    };
  }

  resourceIds(): string[] {
    return Object.entries(this.record?.elements ?? {})
      .filter(([, element]) => element.kind === 'resource')
      .map(([id]) => id);
  }

  goalIds(): string[] {
    return Object.entries(this.record?.elements ?? {})
      .filter(([, element]) => element.kind === 'goal')
      .map(([id]) => id);
  }

  get variables(): readonly string[] {
    return this.record?.variables ?? [];
  }
}
