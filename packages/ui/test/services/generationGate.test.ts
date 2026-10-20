/**
 * The workbench does not generate from a model whose dialect reports an
 * error on a property the engine reads (goal-controller#274): the same error
 * Problems shows, the generation's message naming its element.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { transform } from '@/services';
import { nodeIdInMessage } from '@/lib/workbench/localProblems';

const MINIMAL = readFileSync(
  join(
    __dirname,
    '../../../../examples/edge/experiments/1-minimal/1-minimal.txt',
  ),
  'utf8',
);

type Node = {
  text: string;
  type: string;
  customProperties?: Record<string, string>;
};

/** The root goal's custom properties, merged with `props`. */
const withGoalProps = (
  props: Record<string, string>,
): { json: string; id: string } => {
  const model = JSON.parse(MINIMAL) as { actors: { nodes: Node[] }[] };
  const goal = model.actors[0]!.nodes.find((n) => n.type === 'istar.Goal')!;
  goal.customProperties = { ...goal.customProperties, ...props };
  return { json: JSON.stringify(model), id: goal.text.split(':')[0]!.trim() };
};

const withMaxRetries = (value: string) => withGoalProps({ maxRetries: value });

describe('the generation gate (#274)', () => {
  it('generates from a model whose properties read', () => {
    const { json } = withMaxRetries('2');
    expect(
      transform({ modelJson: json, engine: 'edge' }).files.length,
    ).toBeGreaterThan(0);
  });

  it('refuses a property the dialect reports an error on, naming its element', () => {
    const { json, id } = withMaxRetries('abc');
    for (const engine of ['edge', 'edgev2'] as const) {
      let message = '';
      try {
        transform({ modelJson: json, engine });
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message, engine).toMatch(
        /does not generate from a model with an error on a property it reads/,
      );
      expect(nodeIdInMessage(message.split('\n')[0]!), engine).toBe(id);
    }
  });

  it('#290: refuses dependsOn naming no goal (dialect error), not the mapper re-read', () => {
    const { json, id } = withGoalProps({ dependsOn: 'G99' });
    for (const engine of ['edge', 'edgev2'] as const) {
      let message = '';
      try {
        transform({ modelJson: json, engine });
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message, engine).toMatch(
        /does not generate from a model with an error on a property it reads/,
      );
      expect(message, engine).toMatch(/dependsOn/);
      expect(nodeIdInMessage(message.split('\n')[0]!, engine), engine).toBe(id);
    }
  });
});
