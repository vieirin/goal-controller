/**
 * Opening another tool's model (goal-controller#119, #144): iStarDT-X is
 * iStar-DT's native file now, so a `.istardtx` opens as a project through
 * it (`openNativeFile`), its reader the importer; no importer is left to
 * take it, and any other file opens as it is.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { importedModel, openUpload } from '@/components/workbench/TopBar';
import { nativeFileOf } from '@/lib/workbench/nativeFiles';

const ORDER = join(
  __dirname,
  '../../../../examples/istardt/istardt-order/1.Order.istardtx',
);

describe('opening another tool’s model', () => {
  it('finds iStarDT-X as iStar-DT’s native file, which reads it into an iStar-DT model', () => {
    const found = nativeFileOf('1.Order.istardtx');
    expect(found?.dialect).toBe('istardt');
    expect(found?.baseName).toBe('1.Order');
    const { model } = found!.file.read(readFileSync(ORDER, 'utf8'), {
      modelName: '1.Order',
    });
    expect(model?.diagram).toMatchObject({
      customProperties: { engine: 'istardt' },
    });
    expect((model as any).actors[0].nodes[0].text).toBe('G1: Order Material');
  });

  it('opens a dropped .istardtx through its native file, not an importer', async () => {
    const wb = {
      openFile: vi.fn(),
      openArchive: vi.fn(),
      openNativeFile: vi.fn(),
    };
    const text = readFileSync(ORDER, 'utf8');
    await openUpload(wb as never, new File([text], '1.Order.istardtx'));
    expect(wb.openNativeFile).toHaveBeenCalledWith('1.Order.istardtx', text);
    expect(wb.openFile).not.toHaveBeenCalled();
    expect(importedModel('1.Order.istardtx', text)).toBeNull();
  });

  it('leaves a piStar model as it is', () => {
    expect(importedModel('Order.txt', '{}')).toBeNull();
  });
});
