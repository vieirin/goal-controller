/**
 * Typed inspector fields for a framework engine's own properties
 * (goal-controller#327): `schemaOf`/`linkSchemaOf` map a dialect's
 * `PropertyDefinition`s to istar-ts's `prop.*`, and `dialectParts` /
 * `withOwnProperties` (FrameworkDiagram.tsx) add them to a kind's registry
 * part without replacing what istar-ts's own extension (KAOS's
 * `kaosExtension`) already types there.
 */
import { defineProperties, prop } from '@istar-ts/core';
import { kaosExtension } from '@istar-ts/dsm3-kaos';
import { behavioralGoalProperties } from '@istar-ts/dsm3-kaos/metamodel';
import { kaos, kaosexpert, nfrprop } from '@goal-controller/lib';
import type { IstarExtension } from '@istar-ts/react';
import { describe, expect, it } from 'vitest';
import {
  dialectParts,
  withOwnProperties,
} from '@/components/workbench/engines/framework/FrameworkDiagram';
import { linkSchemaOf, schemaOf } from '@/lib/workbench/frameworkProperties';

describe("a dialect's own properties, typed for istar-ts's inspector (#327)", () => {
  it('types enum, int/number, bool and text properties, and no other value type', () => {
    const schema = schemaOf(nfrprop, 'nfr.NFR')!;
    expect(Object.keys(schema.shape)).toEqual(['Description', 'initialLabel']);
    expect(schema.shape.initialLabel!.type).toBe('enum');
    // '' ("propagated (default)") stays "unset": not one of the enum's values
    expect(schema.shape.initialLabel!.values).not.toContain('');
    expect(schema.shape.initialLabel!.values).toContain('denied');
  });

  it('skips a value type istar-ts has no field for (a `reference`)', () => {
    // Anchor is a reference, ResolutionType an enum: only the latter is typed
    const schema = linkSchemaOf(kaos, 'kaosObstacles.ResolutionLink')!;
    expect(Object.keys(schema.shape)).toEqual(['ResolutionType']);
  });

  it('types a distribution as its text, and a keyed property one row per name (kaosexpert’s experts, #190)', () => {
    const plain = schemaOf(kaosexpert, 'kaosObstacles.Obstacle')!;
    expect(Object.keys(plain.shape)).toEqual([
      'Description',
      'Category',
      'Probability',
    ]);
    expect(plain.shape.Probability!.type).toBe('string');
    const schema = schemaOf(kaosexpert, 'kaosObstacles.Obstacle', {
      expert: ['e1', 'e2'],
    })!;
    expect(Object.keys(schema.shape)).toEqual([
      'Description',
      'Category',
      'Probability',
      'Probability[e1]',
      'Probability[e2]',
    ]);
    // the parts take the names too
    const parts = dialectParts(kaosexpert, { expert: ['e1'] });
    expect(
      Object.keys(
        (parts.elements as Record<string, { properties?: { shape: object } }>)[
          'kaosObstacles.Obstacle'
        ]!.properties!.shape,
      ),
    ).toContain('Probability[e1]');
  });

  it('has no schema for a kind with no properties, or none istar-ts has a field for', () => {
    expect(schemaOf(nfrprop, 'nfr.unknownKind')).toBeUndefined();
  });

  it("add to a kind's own schema (istar-ts's KAOS extension), rather than replacing it", () => {
    const own = kaosExtension as unknown as IstarExtension;
    const dialect = withOwnProperties(dialectParts(kaos), own);
    const merged = (
      dialect.elements as Record<string, { properties?: { shape: object } }>
    )['kaos.BehavioralGoal']!.properties!;
    // every key istar-ts's own schema has is kept (kaos types those, and `Description`)
    expect(Object.keys(merged.shape)).toEqual(
      expect.arrayContaining(Object.keys(behavioralGoalProperties.shape)),
    );

    // a key only the dialect types is added, not dropped: a synthetic extra
    // field, standing in for a future kind that types fewer than istar-ts's own
    const synthetic = {
      name: 'synthetic',
      elements: {
        'kaos.BehavioralGoal': {
          properties: defineProperties<
            { Extra: ReturnType<typeof prop.string> },
            string
          >('kaos.BehavioralGoal', { Extra: prop.string({ optional: true }) }),
        },
      },
    } as unknown as IstarExtension;
    const withExtra = withOwnProperties(synthetic, own);
    const extraMerged = (
      withExtra.elements as Record<string, { properties?: { shape: object } }>
    )['kaos.BehavioralGoal']!.properties!;
    expect(Object.keys(extraMerged.shape).sort()).toEqual(
      [...Object.keys(behavioralGoalProperties.shape), 'Extra'].sort(),
    );
  });
});
