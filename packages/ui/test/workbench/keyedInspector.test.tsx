/**
 * Inspector fields for properties keyed by names the model writes
 * (goal-controller#376): on `las-quantitative` (kaossim), a goal's quality
 * variables (`QualityVariable[ResponseTime]`, an enum) are typed fields of
 * the goal's inspector, the names being the goal's own, and a row adds a
 * name (`Key[name]`, unset).
 */
import { useEffect } from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { kaosExtension } from '@istar-ts/dsm3-kaos';
import {
  IstarInspector,
  IstarProvider,
  useIstarEditor,
  useIstarStore,
  type IstarExtension,
} from '@istar-ts/react';
import { kaossim } from '@goal-controller/lib';
import { afterEach, describe, expect, it } from 'vitest';
import {
  dialectParts,
  withOwnProperties,
} from '@/components/workbench/engines/framework/FrameworkDiagram';
import { parseModel } from '@/lib/workbench/dialects';

const MODEL = parseModel(
  readFileSync(
    join(
      __dirname,
      '../../../../examples/kaos/las-quantitative/las-quantitative.txt',
    ),
    'utf8',
  ),
);
const BASE = kaosExtension as unknown as IstarExtension;
const EXTENSIONS: readonly IstarExtension<string, string>[] = [
  BASE,
  withOwnProperties(dialectParts(kaossim), BASE),
];

/** Selects an element once the editor is up. */
function Select({ id }: { id: string }) {
  const editor = useIstarEditor();
  useEffect(() => editor.select({ type: 'element', id }), [editor, id]);
  return null;
}

function Inspected({ id }: { id: string }) {
  const { store } = useIstarStore(() => MODEL);
  return (
    <IstarProvider store={store} extensions={EXTENSIONS}>
      <Select id={id} />
      <IstarInspector />
    </IstarProvider>
  );
}

afterEach(cleanup);

describe('fields for properties keyed by written names (#376)', () => {
  it('shows a typed field per name the goal writes, and none of another goal’s', () => {
    render(<Inspected id='ambulance_intervention' />);
    const sort = screen.getByLabelText('QualityVariable[ResponseTime]');
    expect(sort.tagName).toBe('SELECT');
    expect((sort as HTMLSelectElement).value).toBe('Time');
    expect(screen.getByLabelText('SampleSpace[ResponseTime]')).toBeTruthy();
    expect(screen.queryByLabelText('QualityVariable[CallTakingTime]')).toBe(
      null,
    );
  });

  it('adds a name: its key, unset', async () => {
    render(<Inspected id='ambulance_intervention' />);
    fireEvent.change(screen.getByLabelText('Keyed property'), {
      target: { value: 'QualityVariable' },
    });
    fireEvent.change(screen.getByLabelText('New QualityVariable name'), {
      target: { value: 'Cost' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add name' }));
    });
    expect(screen.getByLabelText('QualityVariable[Cost]')).toBeTruthy();
    // a name no key reads back is refused
    fireEvent.change(screen.getByLabelText('New QualityVariable name'), {
      target: { value: 'two words' },
    });
    expect(screen.getByText('A name has no spaces or brackets')).toBeTruthy();
  });
});
