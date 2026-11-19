import type { IstarExtension } from '@istar-ts/react';
import { rtNumbering } from '../shared/extensions';

/**
 * SLEEC's canvas extensions (the registry's `palette`): it reads the whole
 * iStar palette, several actors included; names carry RT ids.
 */
const SLEEC_EXTENSIONS: readonly IstarExtension[] = [rtNumbering];

export default SLEEC_EXTENSIONS;
