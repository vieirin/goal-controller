/**
 * Trace between generated PRISM and the goal model: which model node each
 * output line comes from. Engine independent — it only relies on identifiers
 * embedding the node id (g3_state, decision_G3, [pursue_G3], G3_achievable,
 * module G3, …).
 */

export type TraceLine = {
  /** nodes the line belongs to (defined in their module, or named after them) */
  primary: string[];
  /** other nodes the line mentions */
  mentions: string[];
};

export type OutlineEntry = {
  kind: 'module' | 'rewards';
  label: string;
  /** model node the entry belongs to, if any */
  owner: string | null;
  /** 1-based */
  line: number;
};

export type TraceIndex = {
  lines: TraceLine[];
  outline: OutlineEntry[];
};

const IDENTIFIER = /[A-Za-z_][A-Za-z0-9_]*/g;

export const buildTraceIndex = (output: string, nodeIds: Iterable<string>): TraceIndex => {
  const byLower = new Map<string, string>();
  for (const id of nodeIds) {
    byLower.set(id.toLowerCase(), id);
  }
  const ownerOf = (identifier: string): string | null => {
    for (const part of identifier.split('_')) {
      const id = byLower.get(part.toLowerCase());
      if (id) return id;
    }
    // task modules in some layouts are named "taskT4"
    const task = /^task([A-Za-z]+\d+\w*)$/.exec(identifier);
    return task?.[1] ? byLower.get(task[1].toLowerCase()) ?? null : null;
  };

  const lines: TraceLine[] = [];
  const outline: OutlineEntry[] = [];
  let moduleOwner: string | null = null;
  let inRewards = false;

  output.split('\n').forEach((text, index) => {
    const trimmed = text.trim();
    const moduleStart = /^module\s+(\w+)/.exec(trimmed);
    const rewardsStart = /^rewards\s+"([^"]*)"/.exec(trimmed);
    if (moduleStart?.[1]) {
      moduleOwner = ownerOf(moduleStart[1]);
      outline.push({ kind: 'module', label: moduleStart[1], owner: moduleOwner, line: index + 1 });
    } else if (rewardsStart) {
      inRewards = true;
      outline.push({ kind: 'rewards', label: `rewards "${rewardsStart[1] ?? ''}"`, owner: null, line: index + 1 });
    }

    const code = text.replace(/\/\/.*$/, '');
    const mentioned = new Set<string>();
    for (const match of code.matchAll(IDENTIFIER)) {
      const owner = ownerOf(match[0]);
      if (owner) mentioned.add(owner);
    }

    const primary = new Set<string>();
    if (moduleOwner) primary.add(moduleOwner);
    // definitions named after a node: formula g3_achieved = …; const int decision_G3;
    const definition = /^(?:formula|const\s+\w+)\s+(\w+)/.exec(trimmed);
    if (definition?.[1]) {
      const owner = ownerOf(definition[1]);
      if (owner) primary.add(owner);
    }
    // reward entries: [achieved_G19] true : 5;
    const label = /^\[(\w+)\]/.exec(trimmed);
    if (inRewards && label?.[1]) {
      const owner = ownerOf(label[1]);
      if (owner) primary.add(owner);
    }

    lines.push({
      primary: [...primary],
      mentions: [...mentioned].filter((id) => !primary.has(id)),
    });

    if (/^endmodule\b/.test(trimmed)) moduleOwner = null;
    if (/^endrewards\b/.test(trimmed)) inRewards = false;
  });

  return { lines, outline };
};

/** The node a click on this line should select. */
export const lineOwner = (line: TraceLine | undefined): string | null =>
  line?.primary[0] ?? line?.mentions[0] ?? null;
