/**
 * Vitest's setup file (goal-controller#423): Testing Library's own
 * `waitFor`/`findBy` timeout is 1 s regardless of a test's own timeout, so
 * under a loaded machine they time out well before a real deadlock would.
 */
import { configure } from '@testing-library/react';

configure({ asyncUtilTimeout: 5000 });
