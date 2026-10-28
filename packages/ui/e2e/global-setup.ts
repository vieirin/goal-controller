import { chromium } from '@playwright/test';
import type { FullConfig } from '@playwright/test';

/**
 * Warms the dev server's cold `next dev --turbopack` compile (#436) before any test runs: the
 * first `page.goto` per worker otherwise pays for compiling the page plus the engine and LSP
 * worker chunks, which blows past the default 5s canvas wait. One request here, with a timeout
 * sized for a cold compile, keeps every test's own assertion budget tight.
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL;
  if (!baseURL) throw new Error('playwright config is missing baseURL');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`${baseURL}/?example=edgeV2/simpleChoice.txt`);
    await page.locator('[data-workbench-ready="true"]').waitFor({
      state: 'visible',
      timeout: 60_000,
    });
  } finally {
    await browser.close();
  }
}
