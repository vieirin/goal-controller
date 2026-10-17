/**
 * One inspector per mode (goal-controller#171): an iStar engine's in the
 * workbench's panel (or the mobile sheet); a framework's modes and engines
 * (kaos, nfr, kaosdoc, nfrprop), piStar and piStar-ext only istar-ts's,
 * beside their diagram. A framework engine got both, the panel blank.
 */
import { describe, expect, it } from 'vitest';
import { hasModelInspector } from '@/components/workbench/engines/ModelInspector';
import { ENGINES } from '@/lib/workbench/engineDialects';
import { frameworkEditorOf } from '@/lib/workbench/frameworkModes';

describe('the inspector a mode has', () => {
  it('is the workbench’s panel for an iStar engine only', () => {
    for (const mode of [
      'kaos',
      'nfr',
      'kaosdoc',
      'nfrprop',
      'pistar',
      'pistarext',
    ] as const)
      expect(hasModelInspector(mode), mode).toBe(false);
    for (const { id } of ENGINES)
      expect(hasModelInspector(id), id).toBe(!frameworkEditorOf(id));
    expect(hasModelInspector('edge')).toBe(true);
  });
});
