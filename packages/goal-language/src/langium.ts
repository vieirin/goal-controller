/**
 * Langium, for CommonJS consumers (lib): Langium is ESM-only, so its
 * CommonJS form is bundled once, here (out/cjs/langium.cjs, build.mjs),
 * and every CommonJS bundle that reads Langium requires this one, so they
 * share one copy (its classes, its symbols).
 */
export * from 'langium';
