/**
 * The Edge engines' definition pool (#58, ported from goal-controller#63):
 * conditions type-checked against variables.json, resources typed by what
 * they declare, on examples/projects/tas3-edgev2.
 */
import { expect } from 'chai';
import { readFileSync } from 'fs';
import { join } from 'path';
import { goalView, type GoalView } from '@goal-controller/goal-tree';
import { withProperties } from '../poolModel';
import { parsePistar } from '../../../../goal-tree/node_modules/@istar-ts/core';
import {
  createPool,
  definitionAt,
  type PoolDocument,
} from '../../../src/engines/definitionPool';
import { edgeV2 } from '../../../src/engines/edgeV2/definition';
import { edgeV2Pool } from '../../../src/engines/edgeFamily/pool';

const PROJECT = join(__dirname, '../../../../../examples/projects/tas3-edgev2');
const MODEL = readFileSync(join(PROJECT, 'goalModel_TAS_3_.txt'), 'utf8');
const VARIABLES = readFileSync(join(PROJECT, 'variables.json'), 'utf8');

const VIEW = goalView(parsePistar(MODEL), edgeV2);

const indexOf = (
  edits: Record<string, Record<string, string>> = {},
  variables = VARIABLES,
) => {
  const documents: PoolDocument[] = [
    { id: 'model', kind: 'model', value: withProperties(VIEW, edits) },
    { id: 'variables.json', kind: 'variables', text: variables },
  ];
  return createPool(edgeV2Pool).update(documents);
};

/** `severity name: message`, for what G3's condition gets. */
const said = (assertion: string, variables?: string) => {
  const index = indexOf({ G3: { assertion } }, variables);
  return index.diagnostics.map((d) => {
    const text = (index.documents.get('model')!.value as GoalView).nodes.get(
      'G3',
    )!.properties.assertion!;
    return `${d.severity} ${text.slice(d.from, d.to)}: ${d.message}`;
  });
};

// two more variables: an int and a number (`0.50` stays a number)
const MORE = VARIABLES.replace(
  /\}\s*$/,
  ',\n  "battery": 3,\n  "level": 0.50\n}\n',
);

describe('the Edge engines’ pool (#58)', () => {
  it('reports nothing on tas3-edgev2 as it is', () => {
    expect(indexOf().diagnostics).to.deep.equal([]);
  });

  it('an ordering comparator on a boolean is an error', () => {
    expect(said('privacyEnabled > 3')).to.deep.equal([
      'error privacyEnabled: privacyEnabled is a boolean: compare it with = or !=',
    ]);
  });

  it('= and != must match types', () => {
    expect(said('privacyEnabled != 3')).to.deep.equal([
      'error privacyEnabled: privacyEnabled is a boolean: compare it with true or false',
    ]);
    expect(said('battery = true', MORE)).to.deep.equal([
      'error battery: battery is a number (int): compare it with a number',
    ]);
  });

  it('a bare variable or a ! needs a boolean', () => {
    expect(said('battery', MORE)).to.deep.equal([
      'error battery: battery is a number (int): a condition needs a boolean',
    ]);
    expect(said('!level & privacyEnabled', MORE)).to.deep.equal([
      'error level: level is a number (number): a condition needs a boolean',
    ]);
  });

  it('an int compared with a decimal is a warning; a number with one is fine', () => {
    expect(said('battery > 2.5', MORE)).to.deep.equal([
      'warning battery: battery is an int: compared with a decimal',
    ]);
    expect(said('level > 0.5 & battery >= 2', MORE)).to.deep.equal([]);
  });

  it('an unknown name gets no type error (the goal language reports it)', () => {
    expect(said('nowhere > 3')).to.deep.equal([]);
  });

  it('a resource is the type it declares (R1 is an int)', () => {
    expect(said('R1 > 2')).to.deep.equal([]);
    expect(said('R1')).to.deep.equal([
      'error R1: R1 is a number (int): a condition needs a boolean',
    ]);
  });

  it('goes from a condition to variables.json', () => {
    const index = indexOf();
    const target = definitionAt(index, {
      document: 'model:G3:assertion',
      offset: 1,
    });
    expect(target?.document).to.equal('variables.json');
    expect(VARIABLES.slice(target!.from, target!.to)).to.equal(
      'privacyEnabled',
    );
  });
});
