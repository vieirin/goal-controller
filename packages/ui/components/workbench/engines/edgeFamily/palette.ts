import type { IstarExtension } from '@istar-ts/react';
import { rtNumbering } from '../shared/extensions';
import { edgePalette } from './extensions';

/**
 * The Edge engines' canvas extensions (the registry's `palette`): they read
 * goals, tasks and resources in one actor, named after their RT ids; the same
 * in piStar mode's palette toggle.
 */
const EDGE_PALETTE: readonly IstarExtension[] = [rtNumbering, edgePalette];

export default EDGE_PALETTE;
