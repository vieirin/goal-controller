/**
 * Each engine's part of an agent's context (goal-controller#415): every
 * engine lib exports has one, from its dialect's data (its kinds and every
 * property it declares), and the notation's part (goal-language's
 * `notationHelpOf`) for edgeV2's and KAOS's dialects, which live here.
 */
import * as assert from 'assert';
import { describe, it } from 'mocha';
import type { AnyDialect } from '@goal-controller/dialect';
import { notationHelpOf, readLine } from '@goal-controller/goal-language';
import { ISTAR_2_0 } from '@istar-ts/core';
import { KAOS_OBSTACLES } from '@istar-ts/dsm3-kaos/metamodel';
import * as lib from '../../src';
import {
  edgeV2Engine,
  engineContextOf,
  kaos,
  kaosAgentContext,
  nfr,
  nfrAgentContext,
  rootContextOf,
  type Engine,
} from '../../src';

const isEngine = (value: unknown): value is Engine =>
  typeof value === 'object' &&
  value !== null &&
  'mapper' in value &&
  'output' in value;

/** Every engine lib exports (`<name>Engine`): a new one is checked as it is added. */
const ENGINES = Object.entries(lib).flatMap(([name, value]) =>
  name.endsWith('Engine') && isEngine(value) ? [value] : [],
);

/** The owners a dialect gives properties, each with its keys. */
const declared = (dialect: AnyDialect): [string, string[]][] =>
  [
    ...Object.entries(dialect.properties),
    ...Object.entries(dialect.links ?? {}),
    ['actor', dialect.actors ?? []] as const,
  ]
    .filter(([, list]) => list.length > 0)
    .map(([owner, list]) => [owner, list.map(({ key }) => key)]);

describe("an engine's agent context (goal-controller#415)", () => {
  it('covers every engine lib exports', () => {
    assert.ok(ENGINES.length >= 16, `found ${ENGINES.length}`);
  });

  for (const engine of ENGINES)
    it(`${engine.id}: matches its dialect's kinds and properties`, () => {
      const { dialect, agentContext } = engine;
      if (!dialect) {
        assert.strictEqual(agentContext, undefined);
        return;
      }
      assert.ok(agentContext, `${engine.id} has no agent context`);
      assert.deepStrictEqual(
        agentContext.kinds.map(({ kind }) => kind),
        Object.keys(dialect.elements),
      );
      assert.deepStrictEqual(
        agentContext.kinds.map(({ prefix }) => prefix),
        Object.values(dialect.elements).map((e) => e?.prefix ?? null),
      );
      assert.deepStrictEqual(
        agentContext.properties.map(({ owner, properties }) => [
          owner,
          properties.map(({ key }) => key),
        ]),
        declared(dialect),
      );
      assert.strictEqual(agentContext.dialect, dialect.name);
    });

  it("the framework dialects' bindings have theirs", () => {
    assert.deepStrictEqual(kaosAgentContext, engineContextOf(kaos));
    assert.deepStrictEqual(nfrAgentContext, engineContextOf(nfr));
    assert.deepStrictEqual(
      kaosAgentContext.links,
      Object.keys(kaos.links ?? {}),
    );
  });

  it("the root's part is the metamodel's own kinds, istar-ts's", () => {
    const istar = rootContextOf(ISTAR_2_0);
    assert.deepStrictEqual(
      istar.actors.map(({ kind }) => kind),
      ['istar.Actor', 'istar.Agent', 'istar.Role'],
    );
    assert.ok(
      istar.links.some(({ kind }) => kind === 'istar.AndRefinementLink'),
    );
    const kaosRoot = rootContextOf(KAOS_OBSTACLES);
    assert.deepStrictEqual(kaosRoot.actors, []);
    assert.ok(
      kaosRoot.nodes.some(({ kind }) => kind === 'kaos.BehavioralGoal'),
    );
  });

  it("an engine's own constraints come after its dialect's", () => {
    const context = engineContextOf(edgeV2Engine.dialect, {
      constraints: ['one actor only'],
    });
    assert.strictEqual(context.constraints.at(-1), 'one actor only');
  });
});

describe("the notation's part, for edgeV2 and KAOS (goal-controller#415)", () => {
  it('edgeV2: its operators, and an element line it reads back with a notation', () => {
    const dialect: AnyDialect = edgeV2Engine.dialect;
    const help = notationHelpOf(dialect);
    assert.ok(help.refinement);
    assert.deepStrictEqual(
      new Set(help.refinement.operators.map(({ symbol }) => symbol)),
      new Set([
        ...Object.keys(dialect.notation!.operators),
        ...Object.keys(dialect.notation!.standalone ?? {}),
      ]),
    );
    assert.ok(help.refinement.operators.some((o) => o.label === 'Sequence'));
    const read = readLine(dialect, help.elementLine.example);
    assert.strictEqual(read.kind, 'element');
    assert.ok(read.kind === 'element' && read.notation);
    assert.ok(help.propertyLine);
    assert.ok(help.assertion);
  });

  it('KAOS: its own prefixes, no bracket notation', () => {
    const help = notationHelpOf(kaos);
    assert.strictEqual(help.refinement, null);
    assert.ok(help.elementLine.prefixes.some(({ prefix }) => prefix === 'G'));
    const read = readLine(kaos, help.elementLine.example);
    assert.strictEqual(read.kind, 'element');
  });
});
