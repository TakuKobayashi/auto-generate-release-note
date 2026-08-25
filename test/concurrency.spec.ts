import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mapWithConcurrency } from '../src/concurrency.js';

describe('mapWithConcurrency', () => {
  it('preserves result order while respecting the concurrency limit', async () => {
    let active = 0;
    let maximumActive = 0;
    const results = await mapWithConcurrency([40, 10, 30, 5, 20], 4, async (delay, index) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, delay));
      active -= 1;
      return `result-${index}`;
    });

    assert.equal(maximumActive, 4);
    assert.deepEqual(results, ['result-0', 'result-1', 'result-2', 'result-3', 'result-4']);
  });

  it('waits for all work to settle before reporting task failures', async () => {
    const completed: number[] = [];
    await assert.rejects(
      () =>
        mapWithConcurrency([0, 1, 2], 2, async (item) => {
          if (item === 1) throw new Error('failed item');
          await new Promise((resolve) => setTimeout(resolve, 5));
          completed.push(item);
          return item;
        }),
      /concurrent analysis task/
    );
    assert.deepEqual(completed.sort(), [0, 2]);
  });

  it('rejects non-positive and fractional concurrency values', async () => {
    await assert.rejects(() => mapWithConcurrency([1], 0, async (item) => item));
    await assert.rejects(() => mapWithConcurrency([1], 1.5, async (item) => item));
  });
});
