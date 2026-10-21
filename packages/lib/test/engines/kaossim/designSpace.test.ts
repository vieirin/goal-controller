/**
 * kaossim's search on RE'11's printed design space (goal-controller#207,
 * D5): examples/kaos/las-design-space's structure (five decision points,
 * 648 designs), its unprinted inputs filled with synthetic values here, in
 * the test, never in the seed. The exhaustive search over the 648 designs
 * is the oracle; NSGA-II, seeded, reaches the same Pareto set.
 */
import * as assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, it } from 'mocha';
import { parsePistar } from '@istar-ts/core';
import { KAOS_OBSTACLES } from '@istar-ts/dsm3-kaos/metamodel';
import { readKaos } from '../../../src/importers/kaos';
import type { AnalysisModel } from '../../../src/engines/analysis';
import {
  DEFAULT_SIM_OPTIONS,
  enumerateDesigns,
  exhaustiveSearch,
  kaossimAnalysisModel,
  nsga2Search,
  quantitativeModel,
} from '../../../src/engines/kaossim';
import { frontMultiset } from './fronts';

const SEED = join(
  __dirname,
  '../../../../../examples/kaos/las-design-space/las-design-space.kaos',
);

/** The seed's view, with synthetic estimates and equations where RE'11 prints none. */
const synthetic = (): AnalysisModel => {
  const read = readKaos(readFileSync(SEED, 'utf8'), { modelName: 'm' });
  const view = kaossimAnalysisModel(
    parsePistar(read.model!, { metamodel: KAOS_OBSTACLES }) as never,
  );
  const hubOf = (goal: string) =>
    view.links.find(
      (l) => l.kind === 'kaos.RefinementLinkEnd' && l.target === goal,
    )!.source;
  const extra: Record<string, Record<string, string>> = {
    [hubOf('ambulance_intervention')]: {
      'Equation[Cost]': 'C2 + C3 + C4 + C5',
    },
    [hubOf('ambulance_mobilised')]: {
      'Equation[MobilisationTime]':
        'CallTakingTime + AllocationTime + MobilisationCommunicationTime',
      'Equation[MobilisationDistance]': 'DistanceAllocatedAmbulance',
    },
    [hubOf('ambulance_allocated_based_on_incident_form')]: {
      'Equation[DistanceAllocatedAmbulance]':
        'LocationError + 48000 / NbAmbulances',
    },
  };
  const assignments: Record<string, Record<string, string>> = {
    '2.1': { 'Distribution[C2]': '0' },
    '2.2': {
      'Distribution[MobilisationCommunicationTime]': 'exponential[30]',
      'Distribution[C2]': '400',
    },
    '2.3': {
      'Distribution[MobilisationCommunicationTime]': 'exponential[15]',
      'Distribution[C2]': '700',
    },
    '3.1': {
      'Distribution[LocationError]': 'exponential[60]',
      'Distribution[C3]': '0',
    },
    '3.2': {
      'Distribution[LocationError]': 'exponential[30]',
      'Distribution[C3]': '300',
    },
    '3.3': {
      'Distribution[LocationError]': 'exponential[20]',
      'Distribution[C3]': '500',
    },
    '4.1': { 'Distribution[C4]': '0' },
    '4.2': {
      'Distribution[AllocationTime]': 'exponential[20]',
      'Distribution[C4]': '200',
    },
    '4.3': {
      'Distribution[AllocationTime]': 'exponential[5]',
      'Distribution[C4]': '600',
    },
    ...Object.fromEntries(
      [0, 1, 2, 3, 4, 5].map((k) => [
        `5.${k + 1}`,
        { 'Distribution[C5]': String(k * 140) },
      ]),
    ),
  };
  const goal = view.elements.find((e) => e.id === 'ambulance_intervention')!;
  return {
    ...view,
    elements: view.elements.map((e) =>
      e === goal
        ? {
            ...e,
            properties: {
              ...e.properties,
              'QualityVariable[Cost]': 'Number',
              'Mean[Cost]': 'Cost',
              'Modal[Cost]': 'Min',
              // two objectives: the 14-minute rate and the cost (RE'11 Fig. 6)
              'Objective[8MinResponseRate]': '',
            },
          }
        : extra[e.id]
          ? { ...e, properties: { ...e.properties, ...extra[e.id] } }
          : e,
    ),
    links: view.links.map((l) =>
      assignments[l.properties.SysRef ?? '']
        ? {
            ...l,
            properties: {
              ...l.properties,
              ...assignments[l.properties.SysRef!],
            },
          }
        : l,
    ),
  };
};

describe('kaossim: RE’11’s design space, searched (#207, D5)', () => {
  const model = quantitativeModel(synthetic());
  const options = { ...DEFAULT_SIM_OPTIONS, samples: 2000, seed: 1 };

  it('has RE’11’s 648 designs, every objective resolved with the synthetic inputs', () => {
    assert.deepStrictEqual(model.problems, []);
    assert.strictEqual(enumerateDesigns(model).designs.length, 648);
    assert.deepStrictEqual(
      model.objectives.map((o) => o.name),
      ['14MinResponseRate', 'Cost'],
    );
  });

  it('NSGA-II, seeded, reaches the exhaustive search’s Pareto set', () => {
    const exact = exhaustiveSearch(model, options);
    assert.strictEqual(exact.evaluated.length, 648);
    assert.ok(exact.evaluated.every((s) => s.scores !== null));
    const front = frontMultiset(exact.front);
    assert.ok(front.length > 5, `${front.length} designs on the front`);
    assert.ok(front.every(([, count]) => count === 1));
    const found = nsga2Search(model, {
      ...options,
      method: 'nsga2',
      population: 60,
      generations: 80,
    });
    // as multisets: a member dropped or duplicated fails
    assert.deepStrictEqual(frontMultiset(found.front), front);
    assert.ok(
      found.evaluated.length < 648,
      `${found.evaluated.length} evaluated`,
    );
  });
});
