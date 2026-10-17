/**
 * The frameworks a model may be in (goal-controller#171): each read with an
 * istar-ts root, iStar 2.0's, KAOS's or NFR's; the dialect package's kind
 * table pinned to those roots.
 */
import { describe, expect, it } from 'vitest';
import {
  createEmptyModel,
  ISTAR_2_0,
  metamodelOf,
  toPistar,
} from '@istar-ts/core';
import {
  KAOS,
  KAOS_ELEMENT_KINDS,
  KAOS_LINK_KINDS,
  KAOS_REFINEMENT_HUB,
} from '@istar-ts/dsm3-kaos';
import { NFR, NFR_ELEMENT_KINDS, NFR_LINK_KINDS } from '@istar-ts/dsm3-nfr';
import { FRAMEWORK_KINDS, FRAMEWORKS } from '@goal-controller/dialect';
import { istar4RationalAgents } from '@goal-controller/lib';
import { recordedFramework, withModelSettings } from '@/lib/project';
import {
  emptyModelText,
  FRAMEWORK_ROOTS,
  hostFor,
} from '@/lib/workbench/frameworks';
import { metamodelOfMode, parseModel } from '@/lib/workbench/dialects';
import { EMPTY_PISTAR_MODEL } from '@/lib/workbench/pistar';

/** A KAOS model as DSM3 writes it: a goal AND-refined by another, through its hub. */
const KAOS_MODEL = JSON.stringify({
  actors: [],
  orphans: [
    { id: 'g1', text: 'Reliability', type: 'kaos.Softgoal', x: 10, y: 10 },
    { id: 'g2', text: 'Backups', type: 'kaos.BehavioralGoal', x: 10, y: 90 },
  ],
  dependencies: [],
  links: [
    {
      hub: { id: 'h', type: KAOS_REFINEMENT_HUB, x: 10, y: 50 },
      starts: [
        {
          id: 's',
          type: 'kaos.RefinementLinkStart',
          source: 'g2',
          target: 'h',
        },
      ],
      end: {
        id: 'e',
        type: 'kaos.RefinementLinkEnd',
        source: 'h',
        target: 'g1',
      },
    },
  ],
  display: {},
  tool: 'dsm3-goals',
  metamodelVersion: '1.0',
  saveDate: '',
  diagram: { width: 800, height: 600 },
});

const sorted = (kinds: Iterable<string>) => [...kinds].sort();

describe('frameworks', () => {
  it('has a root for each framework, whose framework it is', () => {
    for (const framework of FRAMEWORKS)
      expect(FRAMEWORK_ROOTS[framework].framework).toBe(framework);
    expect(FRAMEWORK_ROOTS['istar-2.0']).toBe(ISTAR_2_0);
  });

  it("pins the dialect's kind table to the KAOS and NFR roots", () => {
    for (const [framework, root] of [
      ['kaos', KAOS],
      ['nfr', NFR],
    ] as const) {
      expect(sorted(FRAMEWORK_KINDS[framework].elements), framework).toEqual(
        sorted(root.elements.keys()),
      );
      expect(sorted(FRAMEWORK_KINDS[framework].links), framework).toEqual(
        sorted(root.links.keys()),
      );
    }
    expect(FRAMEWORK_KINDS.kaos.elements).toEqual([
      ...KAOS_ELEMENT_KINDS,
      KAOS_REFINEMENT_HUB,
    ]);
    expect(FRAMEWORK_KINDS.kaos.links.slice(0, 3)).toEqual(KAOS_LINK_KINDS);
    expect(FRAMEWORK_KINDS.nfr.elements).toEqual(NFR_ELEMENT_KINDS);
    expect(FRAMEWORK_KINDS.nfr.links).toEqual(NFR_LINK_KINDS);
  });

  it("hosts a dialect on its framework's root", () => {
    expect(hostFor('kaos')).toBe(KAOS);
    const host = hostFor('istar-2.0', istar4RationalAgents);
    expect(host.framework).toBe('istar-2.0');
    expect(host.elements.has('istar.Goal')).toBe(true);
    expect(
      istar4RationalAgents.elements!.every(({ kind }) =>
        host.elements.has(kind),
      ),
    ).toBe(true);
  });

  it('writes a new iStar model as it always did, and records another framework', () => {
    expect(emptyModelText('istar-2.0')).toBe(EMPTY_PISTAR_MODEL);
    expect(EMPTY_PISTAR_MODEL).toBe(
      `${toPistar(createEmptyModel(), { saveDate: '' })}\n`,
    );
    expect(recordedFramework(EMPTY_PISTAR_MODEL)).toBe(null);
    for (const framework of ['kaos', 'nfr'] as const) {
      const text = emptyModelText(framework);
      expect(recordedFramework(text)).toBe(framework);
      expect(JSON.parse(text).tool).toBe('dsm3-goals');
      expect(metamodelOf(parseModel(text)).framework).toBe(framework);
    }
  });

  it('reads a model with the root of the framework it records, or is given', () => {
    // iStar 2.0 has no kaos kinds
    expect(() => parseModel(KAOS_MODEL)).toThrow();
    const recorded = withModelSettings(KAOS_MODEL, { framework: 'kaos' });
    for (const model of [
      parseModel(recorded),
      parseModel(KAOS_MODEL, null, 'kaos'),
    ]) {
      expect(metamodelOf(model).framework).toBe('kaos');
      expect(model.elements.get('g2')?.kind).toBe('kaos.BehavioralGoal');
      expect(model.elements.get('h')?.kind).toBe(KAOS_REFINEMENT_HUB);
    }
    expect(metamodelOfMode(null, recorded)).toBe(KAOS);
    expect(metamodelOfMode(null, KAOS_MODEL)).toBe(ISTAR_2_0);
    expect(metamodelOfMode(null, KAOS_MODEL, 'nfr')).toBe(NFR);
  });
});
