/**
 * A layout for a piStar model whose source has no diagram (goal-controller
 * #118): each node without a position is placed from the model's structure,
 * on a fixed grid, so the same model is laid out the same way every time.
 *
 * - Layered by refinement links: a root on top, its children one row
 *   below, siblings in the order of their links (an element refining two
 *   parents is under the first one's).
 * - An element in no refinement (a contribution's source, a dependum, an
 *   extension's node) beside the element it links to (its first link's
 *   other end), to its right, in the same row.
 * - Each actor's elements inside its boundary, the actors side by side; a
 *   node outside every actor beside the actor of the element it links to,
 *   the others after the last actor.
 *
 * Agnostic over piStar JSON: it reads the nodes, and the links' source,
 * target and whether they are iStar's refinements. Nodes that have a
 * position keep it; the others are laid out as a model of their own, from
 * `origin` (an importer puts it below its diagrams).
 */

/** The grid: a column's and a row's step, and the margin inside an actor's boundary. */
export const LAYOUT_GRID = { dx: 160, dy: 100, padding: 40 } as const;

/** iStar's refinements, the links the layers are of (child to parent): the default. */
const REFINEMENTS: ReadonlySet<string> = new Set([
  'istar.AndRefinementLink',
  'istar.OrRefinementLink',
]);

export type LayoutNode = { id: string; x?: unknown; y?: unknown };
export type LayoutModel = {
  actors?: (LayoutNode & { nodes?: LayoutNode[] })[];
  orphans?: LayoutNode[];
  dependencies?: LayoutNode[];
  links?: { type?: unknown; source?: unknown; target?: unknown }[];
};

export type Point = { x: number; y: number };
/** How far the laid-out nodes reach: a grid cell past the last column and row. */
export type LayoutExtent = { right: number; bottom: number };

const positioned = (node: LayoutNode) =>
  Number.isFinite(node.x) && Number.isFinite(node.y);

/** A group of nodes laid out together: an actor's, or those outside every actor. */
type Group = { actor?: LayoutNode; members: LayoutNode[] };

/** Where each node of a group goes, in columns and rows, and how many there are. */
type Grid = {
  cell: Map<string, [number, number]>;
  columns: number;
  rows: number;
};

/**
 * Sets `x` and `y` on every node of `model` that has no position (actors,
 * their nodes, orphans, dependums). Returns how far they reach; null when
 * every node has a position. `refinements`: the link types the layers are
 * of, child to parent (iStar's; another framework's importer names its own).
 */
export const layOut = (
  model: LayoutModel,
  origin: Point = { x: LAYOUT_GRID.padding, y: LAYOUT_GRID.padding },
  refinements: ReadonlySet<string> = REFINEMENTS,
): LayoutExtent | null => {
  const { dx, dy, padding } = LAYOUT_GRID;
  const groups: Group[] = [];
  const groupOf = new Map<string, Group>();
  const add = (group: Group) => {
    groups.push(group);
    for (const node of group.members) groupOf.set(node.id, group);
  };
  for (const actor of model.actors ?? []) {
    const members = (actor.nodes ?? []).filter((n) => !positioned(n));
    if (!positioned(actor) || members.length) add({ actor, members });
  }
  const outside: Group = {
    members: [...(model.orphans ?? []), ...(model.dependencies ?? [])].filter(
      (n) => !positioned(n),
    ),
  };
  add(outside);
  if (groups.every((g) => !g.members.length && !g.actor)) return null;

  // the links between nodes laid out, in the model's order
  const links = (model.links ?? []).flatMap((link) =>
    typeof link.source === 'string' &&
    typeof link.target === 'string' &&
    groupOf.has(link.source) &&
    groupOf.has(link.target)
      ? [
          {
            refines: refinements.has(String(link.type)),
            source: link.source,
            target: link.target,
          },
        ]
      : [],
  );

  // the trees: a refinement within a group, child to parent; a child under its first parent
  const parentOf = new Map<string, string>();
  const childrenOf = new Map<string, string[]>();
  const inTree = new Set<string>();
  for (const { refines, source, target } of links) {
    if (!refines || groupOf.get(source) !== groupOf.get(target)) continue;
    inTree.add(source).add(target);
    if (parentOf.has(source) || source === target) continue;
    parentOf.set(source, target);
    childrenOf.set(target, [...(childrenOf.get(target) ?? []), source]);
  }

  // the others beside what they link to: in their group, a tree's node (or
  // one already beside one); outside every actor, also an actor's node
  const hostOf = new Map<string, string>();
  const besideOf = new Map<string, string[]>();
  const anchorOf = new Map<string, string>();
  const loose = groups
    .flatMap((g) => g.members)
    .filter((n) => !inTree.has(n.id));
  for (let changed = true; changed;) {
    changed = false;
    for (const { id } of loose) {
      if (anchorOf.has(id)) continue;
      const anchor = links
        .flatMap((l) =>
          l.source === id ? [l.target] : l.target === id ? [l.source] : [],
        )
        .find(
          (other) =>
            other !== id &&
            (groupOf.get(other) === groupOf.get(id)
              ? inTree.has(other) || anchorOf.has(other)
              : groupOf.get(id) === outside && groupOf.get(other)!.actor),
        );
      if (anchor === undefined) continue;
      anchorOf.set(id, anchor);
      changed = true;
      if (groupOf.get(anchor) !== groupOf.get(id)) continue;
      const host = hostOf.get(anchor) ?? anchor;
      hostOf.set(id, host);
      besideOf.set(host, [...(besideOf.get(host) ?? []), id]);
    }
  }

  // a group's grid: its trees side by side, each node centred over its children
  const gridOf = (group: Group): Grid => {
    const cell = new Map<string, [number, number]>();
    const width = (id: string) => 1 + (besideOf.get(id)?.length ?? 0);
    const span = new Map<string, number>();
    const spanOf = (id: string, path: Set<string>): number => {
      const children = (childrenOf.get(id) ?? []).filter((c) => !path.has(c));
      const total = children.reduce(
        (sum, c) => sum + spanOf(c, new Set(path).add(c)),
        0,
      );
      span.set(id, Math.max(width(id), total));
      return span.get(id)!;
    };
    let rows = 0;
    const place = (id: string, left: number, row: number) => {
      if (cell.has(id)) return;
      const own = span.get(id)!;
      const column = left + Math.floor((own - width(id)) / 2);
      cell.set(id, [column, row]);
      (besideOf.get(id) ?? []).forEach((b, i) =>
        cell.set(b, [column + 1 + i, row]),
      );
      rows = Math.max(rows, row + 1);
      const children = (childrenOf.get(id) ?? []).filter((c) => !cell.has(c));
      const total = children.reduce((sum, c) => sum + (span.get(c) ?? 0), 0);
      let next = left + Math.floor((own - total) / 2);
      for (const c of children) {
        place(c, next, row + 1);
        next += span.get(c) ?? 0;
      }
    };
    let columns = 0;
    const roots = group.members.filter(
      (n) => !parentOf.has(n.id) && !hostOf.has(n.id) && !anchorOf.has(n.id),
    );
    // a refinement cycle has no root: its first node is one
    const rest = () =>
      group.members.filter(
        (n) => !cell.has(n.id) && !hostOf.has(n.id) && !anchorOf.has(n.id),
      );
    for (const queue = roots; queue.length || rest().length;) {
      const root = queue.shift() ?? rest()[0]!;
      if (cell.has(root.id)) continue;
      spanOf(root.id, new Set([root.id]));
      place(root.id, columns, 0);
      columns += span.get(root.id)!;
    }
    return { cell, columns, rows };
  };

  const at = (left: number, top: number, [column, row]: [number, number]) => ({
    x: left + column * dx,
    y: top + row * dy,
  });
  const set = (node: LayoutNode, point: Point) => Object.assign(node, point);
  const byId = new Map(groups.flatMap((g) => g.members.map((n) => [n.id, n])));
  const placed = new Map<string, Point>();
  let left = origin.x;
  let right = origin.x;
  let bottom = origin.y;
  const reach = (point: Point) => {
    right = Math.max(right, point.x + dx);
    bottom = Math.max(bottom, point.y + dy);
  };

  for (const group of groups) {
    if (group === outside) continue;
    const grid = gridOf(group);
    if (group.actor && !positioned(group.actor))
      set(group.actor, { x: left, y: origin.y });
    for (const [id, cell] of grid.cell) {
      const point = at(left + padding, origin.y + padding, cell);
      placed.set(id, set(byId.get(id)!, point));
      reach({ x: point.x + padding, y: point.y + padding });
    }
    left += padding * 2 + Math.max(grid.columns, 1) * dx;
    reach({ x: left - dx, y: origin.y });
    // beside it, outside its boundary: the nodes outside every actor that link into it
    const lane = outside.members.filter((n) => {
      const anchor = anchorOf.get(n.id);
      return anchor !== undefined && groupOf.get(anchor) === group;
    });
    const taken = new Set<number>();
    for (const node of lane) {
      const anchorY =
        placed.get(anchorOf.get(node.id)!)?.y ?? origin.y + padding;
      let row = Math.round((anchorY - origin.y - padding) / dy);
      while (taken.has(row)) row++;
      taken.add(row);
      const point = at(left, origin.y + padding, [0, row]);
      placed.set(node.id, set(node, point));
      reach(point);
      // what links to it outside every actor, in the same lane
      for (const other of outside.members)
        if (anchorOf.get(other.id) === node.id && !lane.includes(other))
          lane.push(other);
    }
    if (lane.length) left += dx;
  }

  // the rest outside every actor: its own trees, after the actors
  const free: Group = {
    members: outside.members.filter((n) => !placed.has(n.id)),
  };
  const grid = gridOf(free);
  for (const [id, cell] of grid.cell) {
    const point = at(left, origin.y + padding, cell);
    placed.set(id, set(byId.get(id)!, point));
    reach(point);
  }
  return { right, bottom };
};
