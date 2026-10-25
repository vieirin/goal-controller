import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/** Opens a manifest example (its `path`, e.g. `edgeV2/simpleChoice.txt`) and waits for the canvas. */
export async function openExample(
  page: Page,
  examplePath: string,
): Promise<void> {
  await page.goto(`/?example=${examplePath}`);
  await expect(page.locator('.react-flow__pane')).toBeVisible();
}

/** The real browser shortcut the workbench listens for (`Workbench.tsx`'s `window` keydown). */
export async function pressUndo(page: Page): Promise<void> {
  await page.keyboard.press(
    process.platform === 'darwin' ? 'Meta+z' : 'Control+z',
  );
}
