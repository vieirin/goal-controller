/**
 * CAIRIS's model files (goal-controller#192, #203, #204, #205): the reader's
 * placement of each part (one model per environment, D2; values verbatim,
 * D1; requirements as leaf goals, D3), what it keeps and says, the seeds
 * (byte for byte), the union of a file's environments' models (#205), and
 * the cross-check of kaosprop's RE'12 rules against CAIRIS's own
 * propagation (CAIRIS in Docker: scripts/kaos-stress/cairis-oracle.sh, its
 * output fixtures/cairis/cairis-oracle.csv). The fixtures are CAIRIS's three
 * exemplars (cairis-platform/cairis 44cc57d, Apache 2.0, its LICENSE beside
 * them) and synthetic.xml (hand-written, ours).
 */
import * as assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, it } from 'mocha';
import { parsePistar, toPistarObject, validateModel } from '@istar-ts/core';
import { KAOS_OBSTACLES } from '@istar-ts/dsm3-kaos/metamodel';
import {
  CAIRIS_UNSUPPORTED_KEY,
  cairisObstacleProbabilities,
  environmentSlug,
  importCairis,
  isCairisModel,
  readCairis,
  readCairisDocument,
  type CairisDocument,
} from '../../src/importers/cairis';
import {
  kaospropAnalysisModel,
  propagateProbabilities,
  readKaosObstacleModel,
} from '../../src/engines/kaosprop';
import { vocabularyProfileOf } from '../../src/dialects/kaos/profiles';

const ROOT = join(__dirname, '..', '..', '..', '..');
const fixture = (name: string) =>
  readFileSync(join(__dirname, 'fixtures/cairis', name), 'utf8');
const EXEMPLARS = [
  { file: 'NeuroGrid.xml', modelName: 'NeuroGrid', slug: 'neurogrid' },
  { file: 'ACME_Water.xml', modelName: 'ACME_Water', slug: 'acme-water' },
  { file: 'Balkan_Rail.xml', modelName: 'Balkan_Rail', slug: 'balkan-rail' },
] as const;

/** A model's piStar JSON as the tests read it (an open record: the importer's output). */
type Node = {
  id: string;
  text: string;
  type: string;
  x: number;
  y: number;
  customProperties: Record<string, string>;
};
type Link = {
  id?: string;
  type?: string;
  source?: string;
  target?: string;
  customProperties?: Record<string, string>;
  hub?: { id: string; type: string };
  starts?: { source: string; customProperties?: Record<string, string> }[];
  end?: { target: string };
};
type Model = {
  orphans: Node[];
  links: Link[];
  diagram: { name: string; customProperties: Record<string, string> };
};
const asModel = (model: unknown): Model => model as Model;
const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

const documentOf = (file: string): CairisDocument => {
  const { document } = readCairisDocument(fixture(file));
  assert.ok(document);
  return document;
};
const modelsOf = (file: string, modelName: string) =>
  readCairis(fixture(file), { modelName }).models.map((m) => {
    assert.ok(m.result.model, m.environment);
    return { ...m, model: asModel(m.result.model) };
  });

/** How many of each: goals, requirements (a goal with RequirementType), other kinds, links by kind (a hub's). */
const census = (model: Model) => {
  const count: Record<string, number> = {};
  const add = (key: string) => (count[key] = (count[key] ?? 0) + 1);
  for (const node of model.orphans)
    add(
      node.type === 'kaos.BehavioralGoal' &&
        node.customProperties.RequirementType !== undefined
        ? 'requirement'
        : node.type,
    );
  for (const link of model.links) add(link.hub ? link.hub.type : link.type!);
  return count;
};

describe('CAIRIS importer (#192, #203)', () => {
  it('knows a CAIRIS file by its content: the DOCTYPE or the root element', () => {
    for (const { file } of EXEMPLARS) assert.ok(isCairisModel(fixture(file)));
    assert.ok(isCairisModel(fixture('synthetic.xml')));
    assert.ok(isCairisModel('<cairis_model>\n</cairis_model>'));
    assert.ok(!isCairisModel('<istar><actor/></istar>'));
    assert.ok(!isCairisModel('{"actors": []}'));
    assert.ok(!isCairisModel('declare goal [ g ] end'));
  });

  it('says what isn’t one', () => {
    const other = importCairis('<goals/>');
    assert.strictEqual(other.model, null);
    assert.match(other.diagnostics[0]!.message, /its root is <goals>/);
    const broken = importCairis('<cairis_model><goals></cairis_model>');
    assert.ok(broken.diagnostics.some((d) => d.severity === 'error'));
  });

  it('reads the exemplars as the scout counted them (#192)', () => {
    const counts = EXEMPLARS.map(({ file }) => {
      const d = documentOf(file);
      return [
        file,
        d.goals.length,
        d.obstacles.length,
        d.requirements.length,
        d.roles.length,
        d.domainProperties.length,
        d.environments.map((e) => e.name),
      ];
    });
    assert.deepStrictEqual(counts, [
      [
        'NeuroGrid.xml',
        22,
        25,
        25,
        8,
        5,
        ['Psychosis', 'Stroke', 'Core Technology'],
      ],
      ['ACME_Water.xml', 82, 20, 24, 11, 1, ['Day', 'Night']],
      [
        'Balkan_Rail.xml',
        20,
        0,
        8,
        6,
        0,
        ['Model', 'Balkan Rail Corprate HQ', 'Central Station'],
      ],
    ]);
  });

  it('makes one model per environment, `<model>-<environment>`, the environment and the profile on its diagram (D2)', () => {
    const [psychosis] = modelsOf('NeuroGrid.xml', 'NeuroGrid');
    assert.strictEqual(psychosis!.name, 'NeuroGrid-Psychosis');
    assert.strictEqual(psychosis!.model.diagram.name, 'NeuroGrid-Psychosis');
    const { customProperties } = psychosis!.model.diagram;
    assert.strictEqual(customProperties.cairisEnvironment, 'Psychosis');
    assert.strictEqual(
      customProperties.cairisProject,
      'NeuroGrid data transfer',
    );
    assert.strictEqual(vocabularyProfileOf(psychosis!.model), 'cairis');
    assert.strictEqual(psychosis!.result.dialectRecord?.engine, 'kaosprop');
  });

  it('pins each environment’s model: its elements and links by kind', () => {
    const all = EXEMPLARS.flatMap(({ file, modelName }) =>
      modelsOf(file, modelName).map((m) => [m.name, census(m.model)]),
    );
    const goal = 'kaos.BehavioralGoal';
    const dp = 'kaos.DomainProperty';
    const obstacle = 'kaos.Obstacle';
    const agent = 'kaos.Agent';
    const refinement = 'kaos.RefinementLinkHub';
    const oRefinement = 'kaos.ObstacleRefinementLinkHub';
    const obstruction = 'kaos.ObstructionLink';
    const assignment = 'kaos.ResponsibilityAssignment';
    assert.deepStrictEqual(Object.fromEntries(all), {
      'NeuroGrid-Psychosis': {
        [goal]: 22,
        requirement: 24,
        [dp]: 5,
        [obstacle]: 10,
        [agent]: 8,
        [obstruction]: 3,
        [refinement]: 20,
        [oRefinement]: 8,
        [assignment]: 2,
      },
      'NeuroGrid-Stroke': {
        [goal]: 22,
        requirement: 25,
        [dp]: 5,
        [obstacle]: 18,
        [agent]: 8,
        [obstruction]: 3,
        [refinement]: 20,
        [oRefinement]: 14,
        [assignment]: 2,
      },
      'NeuroGrid-Core Technology': {
        requirement: 20,
        [dp]: 3,
        [obstacle]: 7,
        [agent]: 8,
        [obstruction]: 2,
        [oRefinement]: 4,
        [assignment]: 2,
      },
      'ACME_Water-Day': {
        [goal]: 78,
        requirement: 24,
        [dp]: 1,
        [obstacle]: 21,
        [agent]: 10,
        [obstruction]: 11,
        [refinement]: 32,
        [oRefinement]: 11,
        [assignment]: 41,
      },
      'ACME_Water-Night': {
        [goal]: 4,
        requirement: 3,
        [dp]: 1,
        [agent]: 6,
        [refinement]: 3,
        [assignment]: 1,
      },
      'Balkan_Rail-Model': {
        [goal]: 20,
        requirement: 2,
        [agent]: 6,
        [refinement]: 6,
      },
      'Balkan_Rail-Balkan Rail Corprate HQ': { requirement: 5, [agent]: 6 },
      'Balkan_Rail-Central Station': { requirement: 5, [agent]: 6 },
    });
  });

  it('writes CAIRIS’s values verbatim, each where #192 puts it (D1, D3)', () => {
    const [psychosis] = modelsOf('NeuroGrid.xml', 'NeuroGrid');
    const byName = (name: string) =>
      psychosis!.model.orphans.find((n) => n.text === name)!;
    const goal = byName('Process clinical data on NeuroGrid');
    assert.strictEqual(goal.type, 'kaos.BehavioralGoal');
    assert.deepStrictEqual(goal.customProperties, {
      Type: 'Achieve',
      Category: '',
      Source: 'SF',
      Priority: 'High',
      Issue: 'None.',
      FormalSpec: '',
      FitCriterion: 'TBC',
      Stability: '',
      Description:
        'Uploading clinical data on NeuroGrid, which is then analysed before aggregated results can be downloaded.',
    });
    const requirement = byName('Anonymisation guidelines');
    assert.strictEqual(requirement.type, 'kaos.BehavioralGoal');
    assert.strictEqual(
      requirement.customProperties.RequirementType,
      'Functional',
    );
    assert.strictEqual(requirement.customProperties.RequirementPriority, '1');
    assert.strictEqual(requirement.customProperties.Reference, 'Clinical data');
    assert.strictEqual(requirement.customProperties.Type, '');
    const obstacle = byName('Certificate sharing');
    assert.strictEqual(obstacle.type, 'kaos.Obstacle');
    assert.strictEqual(obstacle.customProperties.Category, 'Vulnerability');
    assert.strictEqual(
      obstacle.customProperties.Concern,
      'Personal certificate',
    );
    assert.strictEqual(obstacle.customProperties.Probability, undefined);
    assert.strictEqual(
      byName('Non-federated access control').customProperties.Kind,
      'Invariant',
    );
    assert.strictEqual(byName('Hacker').customProperties.RoleType, 'Attacker');
    // ACME Water's probabilities, with their rationales (goals.dtd:64-66)
    const day = modelsOf('ACME_Water.xml', 'ACME_Water')[0]!;
    const accessible = day.model.orphans.find(
      (n) => n.text === 'Accessible equipment',
    )!;
    assert.strictEqual(accessible.customProperties.Probability, '0.8');
    assert.match(accessible.customProperties.Rationale!, /./);
  });

  it('assigns a requirement to the role a manual association names (D3)', () => {
    const [psychosis] = modelsOf('NeuroGrid.xml', 'NeuroGrid');
    const assignments = psychosis!.model.links
      .filter((l) => l.type === 'kaos.ResponsibilityAssignment')
      .map((l) => [l.source, l.target]);
    assert.deepStrictEqual(assignments, [
      ['sysadmin', 'webdav_folder_retention'],
      ['sysadmin', 'folder_permissions'],
    ]);
  });

  it('maps every ref_type, and keeps what has no KAOS link as written, saying so', () => {
    const xml = `<?xml version="1.0"?>
<cairis_model>
<cairis><environment name="E" short_code="E"><definition>e</definition></environment></cairis>
<riskanalysis><role name="Operator" type="Stakeholder" short_code="OP"><description>o</description></role></riskanalysis>
<goals>
<domainproperty name="Power" type="Hypothesis" originator="x"><definition>p</definition></domainproperty>
${['G', 'G1', 'G2', 'G3', 'Fix']
  .map(
    (g) =>
      `<goal name="${g}" originator="x"><goal_environment name="E" category="Achieve" priority="Low"><definition>${g}</definition><fit_criterion>f</fit_criterion><issue>i</issue></goal_environment></goal>`,
  )
  .join('\n')}
${['O', 'O1', 'O2']
  .map(
    (o) =>
      `<obstacle name="${o}" originator="x"><obstacle_environment name="E" category="Threat"><definition>${o}</definition></obstacle_environment></obstacle>`,
  )
  .join('\n')}
<requirement name="R" reference="E" reference_type="environment" label="1" type="Functional" priority="2"><description>r</description><rationale>None</rationale><fit_criterion>None</fit_criterion><originator>x</originator></requirement>
</goals>
<associations>
${[
  ['G', 'goal', 'and', 'G1', 'goal'],
  ['G', 'goal', 'and', 'R', 'requirement'],
  ['G', 'goal', 'and', 'Power', 'domainproperty'],
  ['G', 'goal', 'or', 'G2', 'goal'],
  ['G1', 'goal', 'conflict', 'G2', 'goal'],
  ['G1', 'goal', 'responsible', 'Operator', 'role'],
  ['G2', 'goal', 'obstruct', 'O', 'obstacle'],
  ['O', 'obstacle', 'resolve', 'Fix', 'goal'],
  ['O', 'obstacle', 'and', 'O1', 'obstacle'],
  ['O', 'obstacle', 'or', 'O2', 'obstacle'],
  ['G3', 'goal', 'and', 'Login', 'task'],
  ['G3', 'goal', 'resolve', 'O', 'obstacle'],
  ['G3', 'goal', 'and', 'Missing', 'goal'],
]
  .map(
    ([g, gd, t, s, sd]) =>
      `<goal_association environment="E" goal_name="${g}" goal_dim="${gd}" ref_type="${t}" subgoal_name="${s}" subgoal_dim="${sd}" alternative_id="0"><rationale>why ${g} ${t} ${s}</rationale></goal_association>`,
  )
  .join('\n')}
</associations>
</cairis_model>`;
    const result = importCairis(xml, { modelName: 'm' });
    const model = asModel(result.model);
    const links = model.links.map((l) =>
      l.hub
        ? [l.hub.type, l.end!.target, l.starts!.map((s) => s.source).join('+')]
        : [l.type, l.source, l.target, l.customProperties?.Rationale],
    );
    assert.deepStrictEqual(links, [
      ['kaos.Conflict', 'g1', 'g2', 'why G1 conflict G2'],
      ['kaos.ObstructionLink', 'o', 'g2', 'why G2 obstruct O'],
      ['kaos.ResolutionLink', 'fix', 'o', 'why O resolve Fix'],
      ['kaos.RefinementLinkHub', 'g', 'g1+r+power'],
      ['kaos.RefinementLinkHub', 'g', 'g2'],
      ['kaos.ObstacleRefinementLinkHub', 'o', 'o1'],
      ['kaos.ObstacleRefinementLinkHub', 'o', 'o2'],
      [
        'kaos.ResponsibilityAssignment',
        'operator',
        'g1',
        'why G1 responsible Operator',
      ],
    ]);
    assert.deepStrictEqual(
      result.diagnostics
        .filter((d) => d.severity === 'warning')
        .map((d) => d.message),
      [
        'E: a task ("Login") is no KAOS element; kept as written',
        'E: an resolve association from a goal to a obstacle is no KAOS link; kept as written',
        'E: the file declares no goal "Missing"; kept as written',
      ],
    );
    const kept =
      model.diagram.customProperties[CAIRIS_UNSUPPORTED_KEY]!.split('\n\n');
    assert.strictEqual(kept.length, 3);
    assert.match(
      kept[0]!,
      /^<goal_association environment="E" goal_name="G3"[^]*subgoal_name="Login"[^]*<\/goal_association>$/,
    );
    assert.deepStrictEqual(
      validateModel(parsePistar(model, { metamodel: KAOS_OBSTACLES })),
      [],
    );
  });

  it('makes the obstacle CAIRIS makes of a use case’s exception, obstructing its goal', () => {
    const day = modelsOf('ACME_Water.xml', 'ACME_Water')[0]!;
    const obstacle = day.model.orphans.find(
      (n) => n.text === 'Unavailable software repository',
    )!;
    assert.strictEqual(
      obstacle.customProperties.Category,
      'Availability_Threat',
    );
    assert.strictEqual(obstacle.customProperties.Probability, undefined);
    const obstruction = day.model.links.find((l) => l.source === obstacle.id)!;
    assert.strictEqual(
      obstruction.target,
      'active_directory_software_deployment',
    );
    assert.strictEqual(
      obstruction.customProperties?.Rationale,
      'Obstructs use case Modify Telemetry Software',
    );
  });

  it('keeps an association naming a goal the file doesn’t declare (Balkan Rail’s, its name cut at 50 characters)', () => {
    const model = modelsOf('Balkan_Rail.xml', 'Balkan_Rail')[0]!;
    assert.ok(
      model.result.diagnostics.some((d) =>
        d.message.includes(
          'the file declares no goal "Protect Balkan Rail customer information confident"',
        ),
      ),
    );
  });

  it('says what of the file it doesn’t read, and what is in every environment', () => {
    const { diagnostics } = readCairis(fixture('NeuroGrid.xml'), {
      modelName: 'NeuroGrid',
    });
    const messages = diagnostics.map((d) => d.message);
    assert.ok(
      messages.includes(
        "7 <vulnerability> not read: no part of KAOS's goal and obstacle model",
      ),
    );
    assert.ok(
      messages.some((m) =>
        m.startsWith(
          'situated in no environment, so in every environment\'s model: domain property "Infrastructure knowledge"',
        ),
      ),
    );
    assert.ok(diagnostics.every((d) => d.severity === 'info'));
  });

  it('validates in istar-ts, and lays every element out where no other is', () => {
    for (const { file, modelName } of EXEMPLARS)
      for (const { name, model } of modelsOf(file, modelName)) {
        assert.deepStrictEqual(
          validateModel(parsePistar(model, { metamodel: KAOS_OBSTACLES })),
          [],
          name,
        );
        const at = model.orphans.map((n) => `${n.x},${n.y}`);
        assert.strictEqual(new Set(at).size, at.length, name);
        assert.ok(
          model.orphans.every(
            (n) => Number.isFinite(n.x) && Number.isFinite(n.y),
          ),
          name,
        );
      }
  });
});

describe('CAIRIS seeds (#204)', () => {
  const seeds = EXEMPLARS.flatMap(({ file, modelName, slug }) =>
    modelsOf(file, modelName).map((m) => ({
      seed: `cairis-${slug}-${environmentSlug(m.environment)}`,
      ...m,
    })),
  );
  const seedText = (seed: string) =>
    readFileSync(join(ROOT, 'examples/kaos', seed, `${seed}.txt`), 'utf8');

  it('are the exemplars read, one per environment, byte for byte', () => {
    assert.deepStrictEqual(
      seeds.map((s) => s.seed),
      [
        'cairis-neurogrid-psychosis',
        'cairis-neurogrid-stroke',
        'cairis-neurogrid-core-technology',
        'cairis-acme-water-day',
        'cairis-acme-water-night',
        'cairis-balkan-rail-model',
        'cairis-balkan-rail-balkan-rail-corprate-hq',
        'cairis-balkan-rail-central-station',
      ],
    );
    for (const { seed, result } of seeds)
      assert.strictEqual(json(result.model), seedText(seed), seed);
  });

  it('round-trip as JSON, byte for byte (D4: no CAIRIS writer)', () => {
    for (const { seed } of seeds) {
      const text = seedText(seed);
      const again = toPistarObject(
        parsePistar(text, { metamodel: KAOS_OBSTACLES }),
      );
      assert.strictEqual(json(again), text, seed);
    }
  });
});

describe('CAIRIS per-environment models: their union loses nothing (#205)', () => {
  for (const { file, modelName } of EXEMPLARS)
    it(`${file}: every goal’s and obstacle’s per-environment values, every association, every element`, () => {
      const document = documentOf(file);
      const models = new Map(
        modelsOf(file, modelName).map((m) => [m.environment, m.model]),
      );
      const nodeIn = (environment: string, name: string, type: string) =>
        models
          .get(environment)!
          .orphans.find((n) => n.text === name && n.type === type);
      // each goal, in each of its environments, with that environment's values
      for (const goal of document.goals)
        for (const here of goal.environments) {
          const node = nodeIn(
            here.environment,
            goal.name,
            'kaos.BehavioralGoal',
          );
          assert.ok(node, `${goal.name} in ${here.environment}`);
          assert.deepStrictEqual(
            [
              node.customProperties.Type,
              node.customProperties.Priority,
              node.customProperties.Description,
              node.customProperties.FitCriterion,
              node.customProperties.Issue,
              node.customProperties.Concern,
            ],
            [
              here.category,
              here.priority,
              here.definition,
              here.fitCriterion,
              here.issue,
              here.concerns.length ? here.concerns.join(', ') : undefined,
            ],
            `${goal.name} in ${here.environment}`,
          );
        }
      for (const obstacle of document.obstacles)
        for (const here of obstacle.environments) {
          const node = nodeIn(here.environment, obstacle.name, 'kaos.Obstacle');
          assert.ok(node, `${obstacle.name} in ${here.environment}`);
          assert.deepStrictEqual(
            [
              node.customProperties.Category,
              node.customProperties.Description,
              node.customProperties.Probability,
              node.customProperties.Rationale,
            ],
            [
              here.category,
              here.definition,
              here.probability?.value,
              here.probability?.rationale,
            ],
          );
        }
      // no goal or obstacle where the file doesn't situate it
      for (const [environment, model] of models)
        for (const node of model.orphans) {
          const goal = document.goals.find((g) => g.name === node.text);
          if (
            node.type === 'kaos.BehavioralGoal' &&
            goal &&
            node.customProperties.RequirementType === undefined
          )
            assert.ok(
              goal.environments.some((e) => e.environment === environment),
              `${node.text} in ${environment}`,
            );
        }
      // each requirement, domain property and role in some environment's model
      const union = new Set(
        [...models.values()].flatMap((m) =>
          m.orphans.map((n) => `${n.type}\u0000${n.text}`),
        ),
      );
      for (const r of document.requirements)
        assert.ok(union.has(`kaos.BehavioralGoal\u0000${r.name}`), r.name);
      for (const d of document.domainProperties)
        assert.ok(union.has(`kaos.DomainProperty\u0000${d.name}`), d.name);
      for (const r of document.roles)
        assert.ok(union.has(`kaos.Agent\u0000${r.name}`), r.name);
      // each association of an environment: a link of its model (its rationale with it), or kept as written there
      for (const a of document.associations) {
        const model = models.get(a.environment)!;
        const kept =
          model.diagram.customProperties[CAIRIS_UNSUPPORTED_KEY] ?? '';
        const rationales = model.links.flatMap((l) => [
          l.customProperties?.Rationale,
          ...(l.starts ?? []).map((s) => s.customProperties?.Rationale),
        ]);
        assert.ok(
          kept.includes(a.source) ||
            (a.rationale === ''
              ? model.links.length > 0
              : rationales.includes(a.rationale)),
          `${a.environment}: ${a.source}`,
        );
      }
      // the counts: links and kept items are the environment's associations
      for (const [environment, model] of models) {
        const of = document.associations.filter(
          (a) => a.environment === environment,
        );
        const kept = (
          model.diagram.customProperties[CAIRIS_UNSUPPORTED_KEY] ?? ''
        )
          .split('\n\n')
          .filter(Boolean);
        const legs = model.links.reduce(
          (n, l) =>
            n +
            (l.starts?.length ??
              (l.type === 'kaos.ResponsibilityAssignment' ||
              l.type === 'kaos.ObstructionLink' ||
              l.type === 'kaos.ResolutionLink' ||
              l.type === 'kaos.Conflict'
                ? 1
                : 0)),
          0,
        );
        const manual = document.manualAssociations.filter(
          (m) => m.from.dim === 'requirement' && m.to.dim === 'role',
        ).length;
        const exceptions = document.exceptions.filter(
          (e) => e.environment === environment,
        ).length;
        const keptOther =
          document.manualAssociations.length -
          manual +
          document.dependencies.filter((d) => d.environment === environment)
            .length;
        assert.ok(legs + kept.length >= of.length + keptOther, environment);
        assert.ok(
          legs + kept.length <= of.length + keptOther + manual + exceptions,
          environment,
        );
      }
    });
});

describe('CAIRIS’s propagation and kaosprop’s RE’12 rules: the cross-check (#192, #204)', () => {
  /** A CSV's rows by its header, its `#` notes left out. */
  const csv = (text: string) => {
    const lines = text
      .split('\n')
      .filter((l) => l.trim() && !l.startsWith('#'));
    const fields = (line: string) => {
      const out: string[] = [];
      let field = '';
      let quoted = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i]!;
        if (quoted) {
          if (c === '"' && line[i + 1] === '"') {
            field += '"';
            i++;
          } else if (c === '"') quoted = false;
          else field += c;
        } else if (c === '"') quoted = true;
        else if (c === ',') {
          out.push(field);
          field = '';
        } else field += c;
      }
      out.push(field);
      return out;
    };
    const [header, ...rows] = lines.map(fields);
    return rows.map(
      (row) => new Map(header!.map((key, i) => [key, row[i] ?? ''])),
    );
  };
  const oracle = csv(fixture('cairis-oracle.csv'));

  it('CAIRIS’s rule, restated, gives each number CAIRIS gave in Docker (cairis-oracle.csv)', () => {
    assert.strictEqual(oracle.length, 43);
    for (const file of ['synthetic.xml', 'ACME_Water.xml']) {
      const document = documentOf(file);
      for (const environment of new Set(
        oracle
          .filter((r) => r.get('file') === file)
          .map((r) => r.get('environment')!),
      )) {
        const restated = cairisObstacleProbabilities(document, environment);
        const rows = oracle.filter(
          (r) => r.get('file') === file && r.get('environment') === environment,
        );
        assert.strictEqual(
          restated.size,
          rows.length,
          `${file} ${environment}`,
        );
        for (const row of rows)
          assert.ok(
            Math.abs(
              restated.get(row.get('obstacle')!)! - Number(row.get('cairis')),
            ) < 1e-6,
            row.get('obstacle'),
          );
      }
    }
  });

  const crossCheck = (file: string, environment: string, expected: string) => {
    const result = importCairis(fixture(file), { modelName: 'm', environment });
    const { probabilities } = propagateProbabilities(
      kaospropAnalysisModel(readKaosObstacleModel(json(result.model))),
    );
    const document = documentOf(file);
    const restated = cairisObstacleProbabilities(document, environment);
    const rows = csv(expected);
    for (const row of rows) {
      const name = row.get('element')!;
      const docker = oracle.find(
        (r) =>
          r.get('file') === file &&
          r.get('environment') === environment &&
          r.get('obstacle') === name,
      );
      assert.ok(docker, name);
      assert.ok(
        Math.abs(Number(docker.get('cairis')) - Number(row.get('cairis'))) <
          1e-6,
        name,
      );
      assert.ok(
        Math.abs(restated.get(name)! - Number(row.get('cairis'))) < 1e-6,
        name,
      );
      assert.ok(
        Math.abs(
          probabilities.get(row.get('id')!)! - Number(row.get('kaosprop')),
        ) < 5e-7,
        name,
      );
      const agree =
        Math.abs(Number(row.get('cairis')) - Number(row.get('kaosprop'))) <
        1e-9;
      assert.strictEqual(agree, row.get('rule') === 'agree', name);
    }
    return rows;
  };

  it('synthetic: the leaves agree; an OR differs (CAIRIS sums, above 1 too); an AND shows CAIRIS’s product from 0', () => {
    const rows = crossCheck(
      'synthetic.xml',
      'Synthetic',
      fixture('synthetic.expected.csv'),
    );
    const of = (id: string) => rows.find((r) => r.get('id') === id)!;
    const pair = (id: string) => [
      Number(of(id).get('cairis')),
      Number(of(id).get('kaosprop')),
      of(id).get('rule'),
    ];
    assert.deepStrictEqual(pair('s1_top'), [0, 0.2, 'and-from-0']);
    assert.deepStrictEqual(pair('s1b_top'), [0.1, 0.2, 'and-from-0']);
    assert.deepStrictEqual(pair('s2_top'), [0.9, 0.7, 'or-sum']);
    assert.deepStrictEqual(pair('s3_top'), [1.3, 0.88, 'or-sum']);
    assert.deepStrictEqual(pair('s4_top'), [0.3, 0.44, 'and-from-0+or-sum']);
    assert.deepStrictEqual(pair('s5_m'), [0.4, 0.37, 'or-sum']);
    assert.deepStrictEqual(pair('s5_top'), [0.6, 0.496, 'or-sum']);
    assert.deepStrictEqual(pair('s6_leaf'), [0.25, 0.25, 'agree']);
  });

  it('ACME Water, Day (the field cross-check): 18 of 21 agree; Surplus equipment is the AND, Unscanned media and Undetected malicious traffic the OR', () => {
    const rows = crossCheck(
      'ACME_Water.xml',
      'Day',
      readFileSync(
        join(
          ROOT,
          'examples/kaos/cairis-acme-water-day/cairis-acme-water-day.expected.csv',
        ),
        'utf8',
      ),
    );
    assert.strictEqual(rows.length, 21);
    assert.deepStrictEqual(
      rows
        .filter((r) => r.get('rule') !== 'agree')
        .map((r) => [
          r.get('element'),
          r.get('cairis'),
          r.get('kaosprop'),
          r.get('rule'),
        ]),
      [
        ['Surplus equipment', '0', '0.48', 'and-from-0'],
        ['Undetected malicious traffic', '0.5', '0.46', 'or-sum'],
        ['Unscanned media', '0.9', '0.82', 'or-sum'],
      ],
    );
  });
});
