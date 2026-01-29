/**
 * Engines
 *
 * This module contains the different engines for transforming goal models.
 * Each engine follows a consistent architecture:
 *
 * 1. **Mapper** (engine creation): Transforms raw iStar model properties into
 *    engine-specific properties. This is the "creation" phase.
 *
 * 2. **Template** (transformation): Generates output from the engine-specific
 *    tree structure. This is the "transformation" phase.
 *
 * Available Engines:
 * - **Edge**: Generates PRISM models for probabilistic verification
 * - **SLEEC**: Generates SLEEC specifications for runtime monitoring
 */

export * from './edge';
export * from './sleec';
