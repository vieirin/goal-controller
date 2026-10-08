/**
 * The refinement structure the notation cannot express: which elements exist
 * in the diagram and each goal's (non-resource) children. The editor sends it
 * as the `rt/structure` notification; without it the structural checks and
 * child completion are skipped.
 */
export type RtStructureRecord = Readonly<Record<string, readonly string[]>>;

export const STRUCTURE_NOTIFICATION = 'rt/structure';

/** What the editors say about a notation that does not match the structure. */
export const NOT_A_CHILD = 'Not a child of this goal';
export const MISSING_FROM_NOTATION = 'Missing from the notation';
export const NOT_IN_DIAGRAM = 'Add this element in the diagram';

export class RtStructure {
  private children: ReadonlyMap<string, readonly string[]> | undefined;

  set(record: RtStructureRecord | undefined): void {
    this.children = record ? new Map(Object.entries(record)) : undefined;
  }

  get known(): boolean {
    return this.children !== undefined;
  }

  has(id: string): boolean {
    return this.children?.has(id) ?? false;
  }

  /** the element's children, or undefined when the structure is unknown */
  childrenOf(id: string): readonly string[] | undefined {
    return this.children ? (this.children.get(id) ?? []) : undefined;
  }
}
