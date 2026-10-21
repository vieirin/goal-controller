/**
 * An extension's own kinds in a model (goal-controller#132): the view holds
 * the ones its dialect reads, keyed by their text's id or their piStar id,
 * none a root; a listed kind gets its lines; the workbench's inspector gets
 * their rows. GRL declares an indicator's importance, and its Notation
 * document is what it was without indicators in the view.
 */
import { expect } from 'chai';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parsePistar } from '../../../goal-tree/node_modules/@istar-ts/core';
import { goalView } from '@goal-controller/goal-tree';
import {
  inputOf,
  specsFromDefinition,
  valueOf,
} from '@goal-controller/dialect';
import {
  checkContextOf,
  propertyOf,
  contextFromView,
  notationDocument,
  valueProblem,
} from '@goal-controller/goal-language';
import { grl, grlCheckRegistry } from '../../src';
import { PROPERTY_SPECS } from '../../../ui/lib/workbench/edgeProperties';
import { KNOWN_PROPERTIES } from '../../../ui/lib/models/knownProperties';
import { parseModel } from '../../../ui/lib/workbench/dialects';
import { notationDefinitionOf } from '../../../ui/lib/workbench/engineDialects';
import { sensed, toy } from '../../../dialect/test/support/toy';
import { ROOT } from './support/models';

/** A model with the toy's extension's kinds: a sensor (listed) and a display (not). */
const SENSED = JSON.stringify({
  actors: [
    {
      id: 'a',
      text: 'Ann',
      type: 'istar.Actor',
      x: 0,
      y: 0,
      customProperties: {},
      nodes: [
        {
          id: 'g',
          text: 'G1: Go',
          type: 'istar.Goal',
          x: 10,
          y: 10,
          customProperties: { when: 'S1 > 3' },
        },
        {
          id: 's',
          text: 'S1: Probe',
          type: 'sensing.Sensor',
          x: 100,
          y: 10,
          customProperties: { rate: '0.5', feeds: 'V1' },
        },
        {
          id: 'v',
          text: 'V1: Panel',
          type: 'sensing.Display',
          x: 200,
          y: 10,
          customProperties: {},
        },
      ],
    },
  ],
  orphans: [],
  dependencies: [],
  links: [],
  display: {},
  tool: 'pistar.2.1.0',
  istar: '2.0',
  diagram: { width: 400, height: 200, name: 'Sensed', customProperties: {} },
  metamodel: {
    name: 'sensing',
    elements: [
      { kind: 'sensing.Sensor', category: 'node' },
      { kind: 'sensing.Display', category: 'node' },
    ],
    links: [],
  },
});

describe('an extension’s kinds in the view (#132)', () => {
  const model = parsePistar(SENSED, { fileMetamodel: true });

  it('holds the kinds its dialect reads, by their text’s id, none a root', () => {
    const view = goalView(model, sensed);
    expect([...view.nodes.keys()]).to.deep.equal(['G1', 'S1', 'V1']);
    expect(view.nodes.get('S1')).to.include({
      kind: 'sensing.Sensor',
      name: 'Probe',
      notationError: null,
    });
    expect(view.nodes.get('V1')).to.include({
      kind: 'sensing.Display',
      name: 'Panel',
    });
    expect(view.roots).to.deep.equal(['G1']);
    // a dialect that reads none of them: as before
    expect([...goalView(model, toy).nodes.keys()]).to.deep.equal(['G1']);
  });

  it('writes a listed kind’s line and property lines from the model', () => {
    expect(notationDocument(sensed, goalView(model, sensed)).text).to.equal(
      'G1: Go\n  when S1 > 3\nS1: Probe\n  rate 0.5\n  feeds V1',
    );
  });
});

describe('GRL’s indicator (#132)', () => {
  const PROJECTS = join(ROOT, 'examples/grl');
  const models = [
    ['grl-own', 'grl-own.txt'],
    ['grl-smart-home', 'SmartHome2.txt'],
  ].map(([project, file]) => ({
    project: project!,
    text: readFileSync(join(PROJECTS, project!, file!), 'utf8'),
  }));
  /** GRL as it was: no extension, no indicator properties (the view leaves its kinds out). */
  const before = {
    ...grl,
    extension: undefined,
    properties: { goal: [], task: [], resource: [], quality: [] },
  };

  it('declares an indicator’s importance, as an actor’s', () => {
    const specs = specsFromDefinition(grl, grlCheckRegistry);
    expect(
      specs['grl.Indicator']!.map((spec) => ({
        key: spec.key,
        input: inputOf(spec, {}),
      })),
    ).to.deep.equal([
      {
        key: 'importance',
        input: {
          kind: 'select',
          options: ['High', 'Medium', 'Low', 'None'].map((value) => ({
            value,
            label: value,
          })),
        },
      },
      { key: 'importanceQuantitative', input: { kind: 'integer', min: 0 } },
    ]);
    const quantitative = propertyOf(
      grl,
      'grl.Indicator',
      'importanceQuantitative',
    )!;
    expect(valueProblem(valueOf(quantitative, {}), '150')).to.equal(
      'At most 100',
    );
    // a belief declares none
    expect(grl.properties).to.not.have.property('grl.Belief');
  });

  it('gives the workbench’s inspector an indicator’s rows', () => {
    expect(
      PROPERTY_SPECS.grl['grl.Indicator']!.map((s) => s.key),
    ).to.deep.equal(['importance', 'importanceQuantitative']);
    expect(KNOWN_PROPERTIES.grl['grl.Indicator']).to.deep.equal([
      'importance',
      'importanceQuantitative',
    ]);
  });

  for (const { project, text } of models)
    it(`${project}: its indicators in the view, its Notation document as before`, () => {
      // as the workbench reads it: its file's kinds applied
      const model = parseModel(text, 'grl');
      const view = goalView(model, notationDefinitionOf('grl'));
      const old = goalView(model, before);
      const indicators = [...model.elements.values()].filter(
        (e) => (e.kind as string) === 'grl.Indicator',
      );
      // grl-own has indicators, SmartHome2 none
      expect(indicators.length > 0).to.equal(project === 'grl-own');
      for (const indicator of indicators) {
        // its name has no id: it is keyed by its piStar id
        expect(view.byIStarId.get(indicator.id)).to.include({
          key: indicator.id,
          kind: 'grl.Indicator',
        });
        expect(view.roots).to.not.include(indicator.id);
      }
      // a belief has no properties and no reference names it
      expect(
        [...view.nodes.values()].some((n) => n.kind === 'grl.Belief'),
      ).to.equal(false);
      expect(notationDocument(grl, view)).to.deep.equal(
        notationDocument(grl, old),
      );
      // the context has them besides, and a check reads them
      const context = contextFromView(grl, view, []);
      const oldContext = contextFromView(grl, old, []);
      expect(
        Object.keys(context.elements).filter(
          (k) => !(k in oldContext.elements),
        ),
      ).to.have.members(indicators.map((e) => e.id));
      for (const key of Object.keys(oldContext.elements))
        expect(context.elements[key], key).to.deep.equal(
          oldContext.elements[key],
        );
      for (const indicator of indicators)
        expect(
          checkContextOf(context, 'x').readElement?.(indicator.id)?.kind,
        ).to.equal('grl.Indicator');
    });
});
