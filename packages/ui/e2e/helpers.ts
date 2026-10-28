import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Opens a manifest example (its `path`, e.g. `edgeV2/simpleChoice.txt`) and waits for the
 * workbench's ready signal (`data-workbench-ready`, #454) instead of racing the canvas DOM:
 * it is set once the canvas has measured and laid out the model's nodes.
 */
export async function openExample(
  page: Page,
  examplePath: string,
): Promise<void> {
  await page.goto(`/?example=${examplePath}`);
  await expect(page.locator('[data-workbench-ready="true"]')).toBeVisible({
    timeout: 30_000,
  });
}

/** The real browser shortcut the workbench listens for (`Workbench.tsx`'s `window` keydown). */
export async function pressUndo(page: Page): Promise<void> {
  await page.keyboard.press(
    process.platform === 'darwin' ? 'Meta+z' : 'Control+z',
  );
}
