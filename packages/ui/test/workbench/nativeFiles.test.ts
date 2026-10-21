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
  openModelFile: vi.fn(async () => {}),
  openCairisFile: vi.fn(async () => {}),
});

describe('opening a native file', () => {
  it('opens a file a dialect declares as its project, and any other as before', async () => {
    const wb = workbench();
    const dialects = [{ id: 'toy', nativeFiles: { toy } }];
    await openUpload(wb, new File(['hello'], 'Home.TOY'), dialects);
    expect(wb.openNativeFile).toHaveBeenCalledWith('Home.TOY', 'hello');
    await openUpload(wb, new File(['{}'], 'Home.txt'), dialects);
    // a model: in its framework, by its content (#171)
    expect(wb.openModelFile).toHaveBeenCalledWith('Home.txt', '{}');
    expect(wb.openFile).not.toHaveBeenCalled();
    expect(wb.openNativeFile).toHaveBeenCalledTimes(1);
  });

  it('opens a CAIRIS model file by its content, whatever its name (#192)', async () => {
    const wb = workbench();
    const cairis =
      '<?xml version="1.0"?>\n<!DOCTYPE cairis_model PUBLIC "-//CAIRIS//DTD MODEL 1.0//EN" "https://cairis.org/dtd/cairis_model.dtd">\n<cairis_model/>';
    await openUpload(wb, new File([cairis], 'NeuroGrid.xml'));
    expect(wb.openCairisFile).toHaveBeenCalledWith('NeuroGrid.xml', cairis);
    await openUpload(
      wb,
      new File(['<cairis_model>\n</cairis_model>'], 'm.txt'),
    );
    expect(wb.openCairisFile).toHaveBeenCalledTimes(2);
    expect(wb.openModelFile).not.toHaveBeenCalled();
    expect(OPEN_ACCEPT.split(',')).toContain('.xml');
  });

  it('takes the registered dialects’ native extensions, each a dialect’s own', () => {
    expect(sharedNativeExtensions(NATIVE_DIALECTS)).toEqual([]);
    for (const extension of NATIVE_EXTENSIONS)
      expect(OPEN_ACCEPT.split(',')).toContain(extension);
    expect(OPEN_ACCEPT.split(',')).toContain('.json');
  });
});
