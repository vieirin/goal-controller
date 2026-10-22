/**
 * `examples/kaos/elevator` (goal-controller#210): the Elevator tutorial's
 * operations side, over the same goals and obstacles as `../engines/
 * kaosres/fixtures/elevator.kaos` (#202's seed, Figures 33-35). This
 * agrees with that fixture (its declarations are the seed's, byte for
 * byte) and is triangle-consistent (the responsibility-operationalisation-
 * performance closure, §3.5, Fig. 30): an operation performed by an agent
 * not responsible for the goal it operationalises raises `open-closure`.
 */
import { expect } from 'chai';
import { readFileSync } from 'fs';
import { join } from 'path';
import { openClosures } from '@goal-controller/goal-tree';
import { kaos } from '../../src';
import { kaosNativeFile } from '../../src/importers/kaos';
import { parseModel } from '../../../ui/lib/workbench/dialects';
import { frameworkProblems } from '../../../ui/lib/workbench/frameworkProblems';

const FIXTURE = readFileSync(
  join(__dirname, '../engines/kaosres/fixtures/elevator.kaos'),
  'utf8',
);
const SEED = readFileSync(
  join(__dirname, '../../../../examples/kaos/elevator/elevator.kaos'),
  'utf8',
);

type Json = Record<string, any>;
const jsonOf = (text: string): Json => {
  const { model, diagnostics } = kaosNativeFile.read(text, {
    modelName: 'm',
  });
  if (!model) throw new Error(JSON.stringify(diagnostics));
  return model as Json;
};
const modelOf = (json: Json) =>
  parseModel(JSON.stringify(json), 'kaos', 'kaos');
const problemsOf = (json: Json) =>
  frameworkProblems(modelOf(json), kaos).map(
    ({ elementId, code, message }) => ({ elementId, code, message }),
  );

describe('examples/kaos/elevator: the operations side (#210)', () => {
  it('declares the kaosres fixture’s goals and obstacles byte for byte (#202’s seed, Figures 33-35)', () => {
    // the fixture's own declarations, past its header comment and @title
    const marker = '@title "Elevator (Respect-IT tutorial, Figures 33-35)"\n\n';
    const [, body] = FIXTURE.split(marker);
    expect(
      body,
      'the fixture’s own form changed: update this test too',
    ).to.not.equal(undefined);
    expect(SEED).to.include(body!);
  });

  it('is triangle-consistent: no Problems', () => {
    expect(problemsOf(jsonOf(SEED))).to.deep.equal([]);
  });

  it('the triangle: reassigning the responsibility it closes raises open-closure (#210)', () => {
    const broken = SEED.replace(
      'declare goal [ elevator_stopped_on_calling_floor ]\n  name "Elevator stopped on calling floor"\n  assignedto elevator_controller\n',
      'declare goal [ elevator_stopped_on_calling_floor ]\n  name "Elevator stopped on calling floor"\n  assignedto passenger\n',
    );
    expect(broken).to.not.equal(SEED);
    expect(problemsOf(jsonOf(broken))).to.deep.equal([
      {
        elementId: 'elevator_controller-performs-execute_schedule',
        code: 'open-closure',
        message:
          '"Elevator Controller" performs "Execute schedule", which operationalises "Elevator stopped on calling floor", but is not responsible for it: assign "Elevator stopped on calling floor" to "Elevator Controller"',
      },
    ]);
    const open = openClosures(modelOf(jsonOf(broken)), kaos);
    expect(open.map(({ start, via, end }) => [start, via, end])).to.deep.equal([
      [
        'elevator_controller',
        'execute_schedule',
        'elevator_stopped_on_calling_floor',
      ],
    ]);
  });
});
