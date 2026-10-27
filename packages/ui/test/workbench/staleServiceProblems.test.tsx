/**
 * A language service's diagnostic that outlives the document it was about
 * (a late worker reply, after the editor that asked for it unmounted):
 * goal-controller#469. The Problems view said "No model open." while the
 * status bar and the tab badge still counted it — the single source every
 * consumer reads from (`wb.problems`) must agree with `wb.hasModel`.
 */
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  useWorkbench,
  WorkbenchProvider,
  type Workbench,
} from '@/components/workbench/WorkbenchContext';
import {
  forgetDocument,
  publishDiagnostics,
} from '@/lib/workbench/diagnosticsStore';
import { SOURCE } from '@/lib/workbench/types';

const STALE_URI = 'file:///model.json';

describe('a service diagnostic with no model open', () => {
  afterEach(() => {
    forgetDocument(STALE_URI);
    cleanup();
  });

  it('is not counted, even though the service never retracted it', () => {
    // a server's late reply: published for a document no editor has open
    publishDiagnostics(SOURCE.language, STALE_URI, [
      {
        severity: 'error',
        source: SOURCE.language,
        elementId: 'G1',
        message: 'stale',
      },
    ]);
    let workbench: Workbench | null = null;
    const Probe = () => {
      workbench = useWorkbench();
      return null;
    };
    render(
      <WorkbenchProvider lockedEngine='edgev2'>
        <Probe />
      </WorkbenchProvider>,
    );
    expect(workbench!.hasModel).toBe(false);
    expect(workbench!.problems).toEqual([]);
  });

  it('still counts while its model is open', () => {
    publishDiagnostics(SOURCE.language, STALE_URI, [
      {
        severity: 'error',
        source: SOURCE.language,
        elementId: 'G1',
        message: 'stale',
      },
    ]);
    let workbench: Workbench | null = null;
    const Probe = () => {
      workbench = useWorkbench();
      return null;
    };
    render(
      <WorkbenchProvider lockedEngine='edgev2'>
        <Probe />
      </WorkbenchProvider>,
    );
    act(() => workbench!.setText('{"actors":[]}', 'open'));
    expect(workbench!.hasModel).toBe(true);
    expect(workbench!.problems.some((p) => p.message === 'stale')).toBe(true);
  });
});
