/**
 * Opening another tool's model (goal-controller#119): a file whose
 * extension an importer reads (iStarDT-X) opens as the piStar model the
 * importer writes; any other file opens as it is.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { importedModel } from '@/components/workbench/TopBar';

const ORDER = join(
  __dirname,
  '../../../../examples/istardt/istardt-order/1.Order.istardtx',
);

describe('opening another tool’s model', () => {
  it('imports an iStarDT-X file into an iStar-DT model, named after it', () => {
    const imported = importedModel(
      '1.Order.istardtx',
      readFileSync(ORDER, 'utf8'),
    );
    expect(imported?.fileName).toBe('1.Order.txt');
    const model = JSON.parse(imported!.text);
    expect(model.diagram.customProperties.engine).toBe('istardt');
    expect(model.actors[0].nodes[0].text).toBe('G1: Order Material');
  });

  it('leaves a piStar model as it is', () => {
    expect(importedModel('Order.txt', '{}')).toBeNull();
  });

  it('rejects a file the importer doesn’t read, with its errors', () => {
    expect(() => importedModel('broken.istardt', '<grl:URNspec/>')).toThrow(
      /Not a model iStarDT-X reads: Not an iStarDT-X file/,
    );
  });
});
