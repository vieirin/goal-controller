/**
 * Opening a native file (goal-controller#143): a file whose extension a
 * dialect declares opens as its project (the workbench's openNativeFile);
 * the Open dialog takes the declared extensions; no two registered
 * dialects take the same one.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  sharedNativeExtensions,
  type NativeFileDefinition,
} from '@goal-controller/dialect';
import { OPEN_ACCEPT, openUpload } from '@/components/workbench/TopBar';
import {
  NATIVE_DIALECTS,
  NATIVE_EXTENSIONS,
} from '@/lib/workbench/nativeFiles';

const toy: NativeFileDefinition = {
  label: 'Toy',
  extensions: ['.toy'],
  format: 'text',
  read: () => ({ model: null, dialectRecord: null, diagnostics: [] }),
};

const workbench = () => ({
  openFile: vi.fn(async () => {}),
  openArchive: vi.fn(async () => {}),
  openNativeFile: vi.fn(async () => {}),
});

describe('opening a native file', () => {
  it('opens a file a dialect declares as its project, and any other as before', async () => {
    const wb = workbench();
    const dialects = [{ id: 'toy', nativeFiles: { toy } }];
    await openUpload(wb, new File(['hello'], 'Home.TOY'), dialects);
    expect(wb.openNativeFile).toHaveBeenCalledWith('Home.TOY', 'hello');
    await openUpload(wb, new File(['{}'], 'Home.txt'), dialects);
    expect(wb.openFile).toHaveBeenCalledWith('Home.txt', '{}', {
      setup: true,
    });
    expect(wb.openNativeFile).toHaveBeenCalledTimes(1);
  });

  it('takes the registered dialects’ native extensions, each a dialect’s own', () => {
    expect(sharedNativeExtensions(NATIVE_DIALECTS)).toEqual([]);
    for (const extension of NATIVE_EXTENSIONS)
      expect(OPEN_ACCEPT.split(',')).toContain(extension);
    expect(OPEN_ACCEPT.split(',')).toContain('.json');
  });
});
