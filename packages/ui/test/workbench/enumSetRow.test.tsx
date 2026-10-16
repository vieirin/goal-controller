/**
 * An `enumSet` property in the inspector (goal-controller#162): one box per
 * option, ticking one adds it after those written, unticking removes it,
 * the last one removed unsets the property; a value that isn't a list is
 * edited as text.
 */
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PropertyRow } from '@/components/workbench/engines/shared/inspector';

const input = {
  kind: 'multiSelect',
  options: [
    { value: 'mon', label: 'Monday' },
    { value: 'wed', label: 'Wednesday' },
  ],
} as const;

const row = (value: string | undefined) => {
  const onChange = vi.fn();
  const view = render(
    <PropertyRow
      name='days'
      value={value}
      engineKnows
      input={input}
      notReadBy={null}
      onChange={onChange}
    />,
  );
  return { ...view, onChange };
};

describe('an enumSet row (#162)', () => {
  afterEach(cleanup);

  it('ticks the options written, and adds or removes one as it is ticked', () => {
    const { getByLabelText, onChange } = row('wed');
    const monday = getByLabelText('Monday') as HTMLInputElement;
    const wednesday = getByLabelText('Wednesday') as HTMLInputElement;
    expect([monday.checked, wednesday.checked]).toEqual([false, true]);
    fireEvent.click(monday);
    expect(onChange).toHaveBeenLastCalledWith('wed, mon');
    fireEvent.click(wednesday);
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('starts unset with no box ticked', () => {
    const { getByLabelText, onChange } = row(undefined);
    fireEvent.click(getByLabelText('Monday'));
    expect(onChange).toHaveBeenLastCalledWith('mon');
  });

  it('edits a value that isn’t a list of the options, each once, as text', () => {
    for (const value of ['mon,', 'mon, sun', 'mon, mon']) {
      const { queryByLabelText, getByDisplayValue, unmount } = row(value);
      expect(queryByLabelText('Monday')).toBeNull();
      expect(getByDisplayValue(value)).toBeTruthy();
      unmount();
    }
  });
});
