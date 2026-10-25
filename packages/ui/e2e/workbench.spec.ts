import { expect, test } from '@playwright/test';
import { openExample, pressUndo } from './helpers';

/**
 * Smoke e2e for the workbench (#418): a regression baseline against today's (pre-migration,
 * #408) behaviour for the flows M1-M8 risk breaking — text↔diagram sync, undo, the
 * text-rewriting inspectors, and engine switching.
 */
test.describe('workbench smoke', () => {
  test('opens a model into the canvas', async ({ page }) => {
    await openExample(page, 'edgeV2/simpleChoice.txt');
    await expect(page.locator('.react-flow__node').first()).toBeVisible();
    // the actor plus its six nested elements (goals, tasks, resource)
    await expect(page.locator('.react-flow__node')).toHaveCount(7);
  });

  test('a canvas edit can be undone', async ({ page }) => {
    await openExample(page, 'edgeV2/simpleChoice.txt');
    const node = page.locator('.react-flow__node:has(.istar-element)').first();
    const label = node.locator('.istar-label');
    const original = await label.innerText();

    await node.click();
    await node.dblclick();
    const editor = node.getByRole('textbox', { name: 'Element name' });
    await editor.fill('Renamed on the canvas');
    await editor.press('Enter');
    await expect(label).toHaveText('Renamed on the canvas');

    await pressUndo(page);
    await expect(label).toHaveText(original);
  });

  test('an inspector property edit rewrites the model text', async ({
    page,
  }) => {
    await openExample(page, 'edgeV2/simpleChoice.txt');
    const node = page.locator('.react-flow__node:has(.istar-element)').first();
    await node.click();

    const inspector = page.getByRole('complementary', { name: 'Inspector' });
    await expect(inspector).toBeVisible();
    const nameField = inspector.getByLabel('Name');
    await nameField.fill('Renamed from the inspector');
    await nameField.blur();

    // the inspector's Name field edits only the node's name; its id prefix and refinement
    // notation (`G1: … [G2?G3]`) survive the rewrite
    await expect(node.locator('.istar-label')).toContainText(
      'Renamed from the inspector',
    );
  });

  test('switches between the engine and the piStar view', async ({ page }) => {
    await openExample(page, 'edgeV2/simpleChoice.txt');

    const engineChip = page.locator('button[title^="Target engine:"]');
    await expect(engineChip).toBeVisible();
    await engineChip.click();

    const dialog = page.getByRole('dialog', { name: 'Model settings' });
    await expect(dialog).toBeVisible();
    await dialog
      .locator('label:has(input[name="engine"][value="pistar"])')
      .click();
    await dialog.getByRole('button', { name: 'Save settings' }).click();

    await expect(dialog).not.toBeVisible();
    const pistarChip = page.locator('button', { hasText: 'piStar' });
    await expect(pistarChip).toBeVisible();
    await expect(page.locator('.react-flow__node').first()).toBeVisible();
  });
});
