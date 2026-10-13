/** The save queue (goal-controller#64): one timer per file. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { saveQueue } from '@/lib/workbench/saveQueue';

describe('saveQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('saves both files edited in one action', () => {
    const queue = saveQueue(500);
    const saved: string[] = [];
    queue.schedule('knowledge/world_db.xml', () => saved.push('world'));
    queue.schedule('configuration/configuration.json', () =>
      saved.push('configuration'),
    );
    vi.advanceTimersByTime(500);
    expect(saved.sort()).toEqual(['configuration', 'world']);
  });

  it('saves a file’s last text, once, after the pause in its edits', () => {
    const queue = saveQueue(500);
    const save = vi.fn();
    for (const text of ['a', 'ab', 'abc']) {
      queue.schedule('world.xml', () => save(text));
      vi.advanceTimersByTime(200);
    }
    expect(save).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith('abc');
    // nothing left to run
    vi.advanceTimersByTime(5000);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('saves nothing before the delay', () => {
    const save = vi.fn();
    saveQueue(500).schedule('world.xml', save);
    vi.advanceTimersByTime(499);
    expect(save).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('waits 500 ms by default', () => {
    const save = vi.fn();
    saveQueue().schedule('world.xml', save);
    vi.advanceTimersByTime(499);
    expect(save).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(save).toHaveBeenCalledTimes(1);
  });
});
