// @vitest-environment node
/**
 * `agentChanges`'s diff (goal-controller#415's drawer runs `beginAgentChanges`/
 * `endAgentChanges` around a run): a run's added/edited/removed elements and
 * links against a snapshot, folded into what earlier runs found, and what
 * the canvas and the notation editors draw from it.
 */
import { describe, expect, it } from 'vitest';
import type { AnyIstarModel, IstarElement, IstarLink } from '@istar-ts/core';
import {
  agentChangeStyle,
  agentLineMarks,
  diffModel,
  EMPTY_AGENT_CHANGES,
  mergeAgentChanges,
  snapshotModel,
  type AgentChanges,
} from '@/lib/workbench/agentChanges';

const element = (
  id: string,
  name: string,
  extra: Partial<IstarElement> = {},
): IstarElement => ({ id, kind: 'istar.Goal', name, x: 0, y: 0, ...extra });

const link = (
  id: string,
  source: string,
  target: string,
  extra: Partial<IstarLink> = {},
): IstarLink => ({
  id,
  kind: 'istar.AndRefinementLink',
  source,
  target,
  ...extra,
});

const model = (
  elements: readonly IstarElement[],
  links: readonly IstarLink[] = [],
): AnyIstarModel => ({
  elements: new Map(elements.map((e) => [e.id, e])),
  links: new Map(links.map((l) => [l.id, l])),
});

describe('diffModel', () => {
  it('marks an element only in the new model as added, one only in the snapshot as removed, and a changed one as edited', () => {
    const before = model([
      element('G1', 'Keep it up'),
      element('G2', 'Gone soon'),
    ]);
    const after = model([
      element('G1', 'Keep it up, renamed'),
      element('G3', 'Brand new'),
    ]);
    const diff = diffModel(snapshotModel(before), after);
    expect(diff.added).toEqual(new Set(['G3']));
    expect(diff.edited).toEqual(new Set(['G1']));
    expect(diff.removed).toEqual(new Set(['G2']));
  });

  it('finds nothing changed between two snapshots of the same model, whatever the elements’ own insertion order', () => {
    const before = model([element('G1', 'A'), element('G2', 'B')]);
    const after = model([element('G2', 'B'), element('G1', 'A')]);
    expect(diffModel(snapshotModel(before), after)).toEqual(
      EMPTY_AGENT_CHANGES,
    );
  });

  it('marks a new link’s source element as edited (no line of its own in the notation)', () => {
    const before = model([element('G1', 'A'), element('T1', 'B')]);
    const after = model(
      [element('G1', 'A'), element('T1', 'B')],
      [link('L1', 'G1', 'T1')],
    );
    const diff = diffModel(snapshotModel(before), after);
    expect(diff.added).toEqual(new Set(['L1']));
    expect(diff.edited).toEqual(new Set(['G1']));
  });

  it('does not also mark the source as edited when the source element is itself new', () => {
    const before = model([element('T1', 'B')]);
    const after = model(
      [element('G1', 'A'), element('T1', 'B')],
      [link('L1', 'G1', 'T1')],
    );
    const diff = diffModel(snapshotModel(before), after);
    expect(diff.added).toEqual(new Set(['G1', 'L1']));
    expect(diff.edited.size).toBe(0);
  });

  it('marks a removed link’s former source as edited, by its own id too', () => {
    const before = model(
      [element('G1', 'A'), element('T1', 'B')],
      [link('L1', 'G1', 'T1')],
    );
    const after = model([element('G1', 'A'), element('T1', 'B')]);
    const diff = diffModel(snapshotModel(before), after);
    expect(diff.removed).toEqual(new Set(['L1']));
    expect(diff.edited).toEqual(new Set(['G1']));
  });

  it('marks an edited link’s source as edited too', () => {
    const before = model(
      [element('G1', 'A'), element('T1', 'B'), element('T2', 'C')],
      [link('L1', 'G1', 'T1')],
    );
    const after = model(
      [element('G1', 'A'), element('T1', 'B'), element('T2', 'C')],
      [link('L1', 'G1', 'T2')],
    );
    const diff = diffModel(snapshotModel(before), after);
    expect(diff.edited).toEqual(new Set(['L1', 'G1']));
  });
});

describe('mergeAgentChanges', () => {
  it('keeps an id added by an earlier run as added, even when a later run only edits it', () => {
    const run1: AgentChanges = {
      added: new Set(['R6']),
      edited: new Set(),
      removed: new Set(),
    };
    const run2: AgentChanges = {
      added: new Set(),
      edited: new Set(['R6']),
      removed: new Set(),
    };
    const merged = mergeAgentChanges(
      mergeAgentChanges(EMPTY_AGENT_CHANGES, run1),
      run2,
    );
    expect(merged.added).toEqual(new Set(['R6']));
    expect(merged.edited.size).toBe(0);
  });

  it('drops an id from both added and edited once a later run removes it', () => {
    const added: AgentChanges = {
      added: new Set(['R6']),
      edited: new Set(),
      removed: new Set(),
    };
    const removed: AgentChanges = {
      added: new Set(),
      edited: new Set(),
      removed: new Set(['R6']),
    };
    const merged = mergeAgentChanges(
      mergeAgentChanges(EMPTY_AGENT_CHANGES, added),
      removed,
    );
    expect(merged.added.size).toBe(0);
    expect(merged.removed).toEqual(new Set(['R6']));
  });

  it('accumulates distinct ids across runs, like a drawer’s several agent turns', () => {
    const run1: AgentChanges = {
      added: new Set(['R6']),
      edited: new Set(['G1']),
      removed: new Set(),
    };
    const run2: AgentChanges = {
      added: new Set(),
      edited: new Set(['G4']),
      removed: new Set(),
    };
    const merged = mergeAgentChanges(
      mergeAgentChanges(EMPTY_AGENT_CHANGES, run1),
      run2,
    );
    expect(merged.added).toEqual(new Set(['R6']));
    expect(merged.edited).toEqual(new Set(['G1', 'G4']));
  });
});

describe('agentChangeStyle', () => {
  it('is null with no added or edited ids', () => {
    expect(agentChangeStyle(EMPTY_AGENT_CHANGES)).toBeNull();
  });

  it('badges an added id’s node and edge, and an edited one’s, by their own data-id', () => {
    const style = agentChangeStyle({
      added: new Set(['R6']),
      edited: new Set(['G1']),
      removed: new Set(['G2']),
    })!;
    expect(style).toContain('[data-id="R6"]');
    expect(style).toContain('[data-id="G1"]');
    expect(style).not.toContain('[data-id="G2"]');
    expect(style).toContain('"NEW"');
    expect(style).toContain('"EDITED"');
  });
});

describe('agentLineMarks', () => {
  const iStarIdOf = (key: string): string | undefined =>
    ({ G1: 'g1-id', G3: 'g3-id' })[key];

  it('marks a NEW line for an added id and an EDITED line for an edited one, by line number', () => {
    const marks = agentLineMarks(['G1', 'G3', null], iStarIdOf, {
      added: new Set(['g3-id']),
      edited: new Set(['g1-id']),
      removed: new Set(),
    });
    expect(marks).toEqual([
      {
        line: 1,
        className: 'cm-agent-edited',
        attributes: { 'data-agent-badge': 'EDITED' },
      },
      {
        line: 2,
        className: 'cm-agent-new',
        attributes: { 'data-agent-badge': 'NEW' },
      },
    ]);
  });

  it('marks nothing for a removed id: it has no line (key) left to resolve to it', () => {
    const marks = agentLineMarks(['G1'], iStarIdOf, {
      added: new Set(),
      edited: new Set(),
      removed: new Set(['g1-id']),
    });
    expect(marks).toEqual([]);
  });
});
