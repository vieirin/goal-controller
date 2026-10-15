/**
 * The GRL stress test's checks on one seed (goal-controller#106), through
 * lib's built `out/`:
 *
 * - **import**: `importJucm` gives a model and no `error` diagnostic;
 * - **conformance**: the imported model has the file's elements (its
 *   `intElements` and belief nodes) and links (its grlspec `links` and
 *   BeliefLinks);
 * - **checks**: `grlCheckRegistry` over every contribution link's properties;
 * - **evaluations**: each strategy under each run (`RUNS`, the oracle's),
 *   against the reference CSV, exact values and labels (compare.cjs).
 *
 * Each check is `{ status, ...details }`, status one of `pass`, `fail`, or
 * `skip` (with its `reason`).
 */
const { compareStrategy, RUNS } = require('./compare.cjs');

const errorText = (error) =>
  error instanceof Error ? error.message : String(error);

/** Distinct `id`s of the tags matching `pattern` (an opening tag's text). */
const countTags = (text, pattern) => {
  const ids = new Set();
  let anonymous = 0;
  for (const [tag] of text.matchAll(pattern)) {
    const id = /\sid="([^"]*)"/.exec(tag)?.[1];
    if (id === undefined) anonymous += 1;
    else ids.add(id);
  }
  return ids.size + anonymous;
};

/** What the file declares: its elements and links, as jUCMNav reads them. */
const expectedCounts = (text) => ({
  elements:
    countTags(text, /<intElements\b[^>]*>/g) +
    countTags(text, /<nodes\b[^>]*xsi:type="grl:Belief"[^>]*>/g),
  links:
    countTags(text, /<links\b[^>]*>/g) +
    countTags(text, /<connections\b[^>]*xsi:type="grl:BeliefLink"[^>]*>/g),
});

/** What the import has: actors' nodes, orphans and dependums; its links. */
const importedCounts = (model) => ({
  elements:
    (model.actors ?? []).reduce(
      (sum, actor) => sum + (actor.nodes ?? []).length,
      0,
    ) +
    (model.orphans ?? []).length +
    (model.dependencies ?? []).length,
  links: (model.links ?? []).length,
});

/** Every node of the model by id, with its type: a link's ends. */
const nodesById = (model) => {
  const nodes = new Map();
  for (const actor of model.actors ?? [])
    for (const node of actor.nodes ?? []) nodes.set(node.id, node);
  for (const node of [...(model.orphans ?? []), ...(model.dependencies ?? [])])
    nodes.set(node.id, node);
  return nodes;
};

/**
 * `grlCheckRegistry`'s checks on each contribution link, its properties as
 * a check reads them; `readLink` gives a link's ends in the dialect's kinds
 * (`grl.Belief` for a belief, the piStar type otherwise).
 */
const runChecks = (lib, model) => {
  const nodes = nodesById(model);
  const links = new Map((model.links ?? []).map((link) => [link.id, link]));
  const end = (id) => ({ iStarId: id, kind: nodes.get(id)?.type ?? null });
  const readLink = (id) => {
    const link = links.get(id);
    return (
      link && {
        kind: link.type,
        source: link.source,
        target: link.target,
        properties: link.customProperties ?? {},
        ends: { source: end(link.source), target: end(link.target) },
      }
    );
  };
  const contributions = (model.links ?? []).filter(
    (link) => link.type === 'istar.ContributionLink',
  );
  const failures = [];
  for (const link of contributions) {
    const properties = link.customProperties ?? {};
    const context = {
      self: link.id,
      kindOf: () => undefined,
      elements: {},
      readLink,
    };
    for (const [name, check] of Object.entries(lib.grlCheckRegistry)) {
      const message = check(properties, context);
      if (message) failures.push({ link: link.id, check: name, message });
    }
  }
  return {
    status: failures.length ? 'fail' : 'pass',
    links: contributions.length,
    ...(failures.length && { failures }),
  };
};

/**
 * One seed: `{ checks, strategies }`. `references` is the parsed reference
 * CSV (references.cjs), or `{ skip: reason }`.
 */
const checkSeed = (deps, text, references) => {
  const { lib, core } = deps;
  const checks = {};
  const skipAll = (reason) => {
    for (const name of ['conformance', 'checks', 'evaluations'])
      checks[name] ??= { status: 'skip', reason };
    return { checks, strategies: [] };
  };

  let imported;
  try {
    imported = lib.importJucm(text);
  } catch (error) {
    checks.import = { status: 'fail', error: errorText(error) };
    return skipAll('the seed did not import');
  }
  const errors = imported.diagnostics.filter((d) => d.severity === 'error');
  const others = imported.diagnostics.filter((d) => d.severity !== 'error');
  checks.import = {
    status: errors.length || !imported.model ? 'fail' : 'pass',
    ...(errors.length && { errors: errors.map((d) => d.message) }),
    ...(others.length && { diagnostics: others.map((d) => d.message) }),
  };
  if (!imported.model) return skipAll('the import gave no model');
  const { model } = imported;

  const expected = expectedCounts(text);
  const ours = importedCounts(model);
  checks.conformance = {
    status:
      expected.elements === ours.elements && expected.links === ours.links
        ? 'pass'
        : 'fail',
    expected,
    imported: ours,
  };

  try {
    checks.checks = runChecks(lib, model);
  } catch (error) {
    checks.checks = { status: 'fail', error: errorText(error) };
  }

  // the strategies the reference evaluates: each must be imported, or its
  // rows would go unchecked
  const referenced = new Set(
    [...(references.rows?.keys() ?? [])].map((key) =>
      key.slice(key.indexOf('|') + 1),
    ),
  );
  const notImported = (ids) => {
    const lost = [...referenced].filter((id) => !ids.has(id));
    return lost.length
      ? `the reference evaluates strategies the import lacks: ${lost.join(', ')}`
      : null;
  };
  const files = Object.entries(
    imported.dialectRecord?.projectResources?.strategies ?? {},
  ).map(([path, text]) => ({ path, text }));
  if (!files.length) {
    const lost =
      notImported(new Set()) ?? (references.fatal ? references.skip : null);
    checks.evaluations = lost
      ? { status: 'fail', error: lost }
      : { status: 'skip', reason: 'no strategies' };
    return { checks, strategies: [] };
  }
  let graph;
  let strategies;
  try {
    graph = lib.grlGraph(
      lib.analysisModel(core.parsePistar(model, { fileMetamodel: true })),
    );
    const read = lib.readStrategies(files);
    strategies = read.strategies;
    const strategyErrors = read.diagnostics.filter(
      (d) => d.severity === 'error',
    );
    if (strategyErrors.length)
      checks.strategies = {
        status: 'fail',
        errors: strategyErrors.map((d) => `${d.path}: ${d.message}`),
      };
  } catch (error) {
    checks.evaluations = { status: 'fail', error: errorText(error) };
    return { checks, strategies: [] };
  }

  const evaluate = (strategy, run) =>
    lib.evaluateStrategy(graph, strategy, run.algorithm, {
      ...strategy.preferences,
      tolerance: run.tolerance,
    });
  const results = strategies.map((strategy) =>
    compareStrategy(strategy, evaluate, references),
  );
  const statuses = results.flatMap((result) =>
    Object.values(result.runs).map((run) => run.status),
  );
  const lost = notImported(new Set(strategies.map((s) => s.id)));
  checks.evaluations = {
    status:
      lost || statuses.includes('fail')
        ? 'fail'
        : statuses.every((status) => status === 'skip')
          ? 'skip'
          : 'pass',
    strategies: strategies.length,
    ...(lost && { error: lost }),
    ...(references.skip && {
      [references.fatal ? 'error' : 'reason']: references.skip,
    }),
  };
  return { checks, strategies: results };
};

module.exports = { RUNS, checkSeed, expectedCounts, importedCounts };
