/**
 * A property record read against a dialect (goal-controller#187): each
 * stored string read as its property's type, typed by the dialect; a value
 * written with an error is unset, its text kept.
 */
import { actors, links, property } from '@goal-controller/dialect';
import { expect } from 'chai';
import {
  readProperties,
  type AssertionTree,
  type PropertyValues,
} from '../src/index.js';

const dialect = {
  properties: {
    goal: [
      property.int('maxRetries', { min: 0, help: '' }),
      property.number('utility', { help: '' }),
      property.bool('maintain', { help: '' }),
      property.enum('type', ['', 'achieve', 'maintain'], { help: '' }),
      property.enum('mode', ['fast'], { open: true, help: '' }),
      property.refList('dependsOn', 'goal', { help: '' }),
      property.pairList('variables', 'int', { help: '' }),
      property.assertion('assertion', { resolves: ['variable'], help: '' }),
      property.text('note', { help: '' }),
      property.probability('chance', { help: '' }),
      property.reference('anchor', ['goal'], { help: '' }),
      property.conditional(
        'bound',
        {
          when: { key: 'type', equals: 'maintain' },
          matching: { type: 'assertion', resolves: ['variable'] },
          otherwise: { type: 'int' },
        },
        { help: '' },
      ),
    ],
    task: [property.text('note', { help: '' })],
  },
  actors: actors([
    property.int('importance', { help: '' }),
    property.text('role', { kinds: ['istar.Role'], help: '' }),
  ]),
  links: links({
    'istar.ContributionLink': [property.int('weight', { help: '' })],
  }),
};

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const same = <T extends true>(): T => true as T;

describe('readProperties (#187)', () => {
  it('reads each value as its type', () => {
    const { values, text } = readProperties(
      dialect,
      { element: 'goal' },
      {
        maxRetries: '3',
        utility: '0.5',
        maintain: 'true',
        type: 'achieve',
        mode: 'slow',
        dependsOn: 'G2, G3',
        variables: 'x:3, y:2',
        assertion: 'x > 3',
        note: 'a note',
        chance: '80%',
        anchor: ' G1 ',
        unknown: 'not the dialect’s',
      },
    );
    expect(values).to.deep.include({
      maxRetries: 3,
      utility: 0.5,
      maintain: true,
      type: 'achieve',
      mode: 'slow',
      dependsOn: ['G2', 'G3'],
      variables: [
        { name: 'x', value: '3' },
        { name: 'y', value: '2' },
      ],
      note: 'a note',
      chance: 0.8,
      anchor: 'G1',
    });
    expect(values.assertion?.kind).to.equal('compare');
    expect(values).not.to.have.property('unknown');
    expect(text).to.deep.equal({
      maxRetries: '3',
      utility: '0.5',
      maintain: 'true',
      type: 'achieve',
      mode: 'slow',
      dependsOn: 'G2, G3',
      variables: 'x:3, y:2',
      assertion: 'x > 3',
      note: 'a note',
      chance: '80%',
      anchor: ' G1 ',
    });
  });

  it('leaves a value with errors unset, and keeps its text', () => {
    const { values, text } = readProperties(
      dialect,
      { element: 'goal' },
      {
        maxRetries: 'three',
        utility: 'x',
        maintain: 'yes',
        type: 'perform',
        dependsOn: 'G2,,',
        chance: '120%',
      },
    );
    expect(values).to.deep.equal({});
    expect(text).to.deep.equal({
      maxRetries: 'three',
      utility: 'x',
      maintain: 'yes',
      type: 'perform',
      dependsOn: 'G2,,',
      chance: '120%',
    });
  });

  it('reads an empty value as empty, not as an error', () => {
    const { values } = readProperties(
      dialect,
      { element: 'goal' },
      { maxRetries: '', type: '', dependsOn: '' },
    );
    expect(values).to.deep.equal({
      maxRetries: null,
      type: null,
      dependsOn: [],
    });
  });

  it('reads a conditional value as the other properties make it', () => {
    const maintained = readProperties(
      dialect,
      { element: 'goal' },
      { type: 'maintain', bound: 'x > 3' },
    );
    expect((maintained.values.bound as AssertionTree)?.kind).to.equal(
      'compare',
    );
    const achieved = readProperties(
      dialect,
      { element: 'goal' },
      { type: 'achieve', bound: '4' },
    );
    expect(achieved.values.bound).to.equal(4);
  });

  it("reads an actor's properties for its kind, and a link's", () => {
    expect(
      readProperties(
        dialect,
        { actor: 'istar.Agent' },
        { importance: '2', role: 'r' },
      ),
    ).to.deep.equal({ values: { importance: 2 }, text: { importance: '2' } });
    expect(
      readProperties(
        dialect,
        { actor: 'istar.Role' },
        { importance: '2', role: 'r' },
      ).values,
    ).to.deep.equal({ importance: 2, role: 'r' });
    expect(
      readProperties(
        dialect,
        { link: 'istar.ContributionLink' },
        { weight: '50' },
      ).values,
    ).to.deep.equal({ weight: 50 });
    expect(
      readProperties(dialect, { link: 'istar.AndRefinementLink' }, { w: '1' }),
    ).to.deep.equal({ values: {}, text: {} });
  });

  it('types the values by the dialect', () => {
    type Goal = PropertyValues<typeof dialect.properties.goal>;
    same<Same<Goal['maxRetries'], number | null | undefined>>();
    same<Same<Goal['maintain'], boolean | null | undefined>>();
    same<Same<Goal['type'], 'achieve' | 'maintain' | null | undefined>>();
    same<Same<Goal['mode'], string | null | undefined>>();
    same<Same<Goal['dependsOn'], string[] | undefined>>();
    same<Same<Goal['chance'], number | null | undefined>>();
    same<Same<Goal['bound'], AssertionTree | number | null | undefined>>();
    const { values } = readProperties(
      dialect,
      { link: 'istar.ContributionLink' },
      {},
    );
    same<Same<typeof values, { weight?: number | null }>>();
    // @ts-expect-error a key the dialect doesn't give a task
    void readProperties(dialect, { element: 'task' }, {}).values.maxRetries;
  });
});
