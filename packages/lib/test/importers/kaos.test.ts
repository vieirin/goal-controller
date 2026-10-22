/**
 * KAOSTools' textual KAOS (goal-controller#181): the reader's placement of
 * each attribute by layer, what it keeps as written, its layout, and the
 * writer's round trip. The grammar's own tests are goal-language's
 * (test/kaos.test.ts), and so is the corpus (its test/fixtures/kaos: ADS's
 * six models and KAOSTools' LAS, MIT, each with its licence), read here
 * from there.
 */
import * as assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, it } from 'mocha';
import { parsePistar, validateModel } from '@istar-ts/core';
import { KAOS_OBSTACLES } from '@istar-ts/dsm3-kaos/metamodel';
import {
  KAOS_UNSUPPORTED_KEY,
  kaosNativeFile,
  readKaos,
  writeKaos,
} from '../../src/importers/kaos';
import { modelRoundTrip } from '../../src/importers/native';
import {
  kaospropAnalysisModel,
  propagateProbabilities,
  readKaosObstacleModel,
} from '../../src/engines/kaosprop';

const fixture = (path: string) =>
  readFileSync(
    join(__dirname, '../../../goal-language/test/fixtures/kaos', path),
    'utf8',
  );
const ADS = [
  'las.kaos',
  'obstacles.kaos',
  'resolutions.kaos',
  'simple.kaos',
  'simple_new_syntax.kaos',
  'validation-model.kaos',
].map((name) => `ads/${name}`);
const CORPUS = [...ADS, 'kaostools/las.kaos'];

type Json = Record<string, any>;
const read = (path: string, files?: Record<string, string>) => {
  const result = readKaos(fixture(path), { modelName: 'm', files });
  assert.ok(result.model, JSON.stringify(result.diagnostics.slice(0, 3)));
  return result as typeof result & { model: Json };
};
/** A text read, its model as JSON (null when it doesn't read). */
const readText = (text: string) => {
  const { model, diagnostics } = readKaos(text);
  return { model: model as Json, diagnostics };
};
/** How many of each kind: elements by type, links by type (a refinement by its hub's). */
const census = (model: Json) => {
  const count: Record<string, number> = {};
  for (const node of model.orphans)
    count[node.type] = (count[node.type] ?? 0) + 1;
  for (const link of model.links) {
    const type = link.hub ? link.hub.type : link.type;
    count[type] = (count[type] ?? 0) + 1;
  }
  return count;
};
const nodeOf = (model: Json, id: string) =>
  model.orphans.find((n: Json) => n.id === id);
const hubsOf = (model: Json, parent: string) =>
  model.links.filter((l: Json) => l.hub && l.end.target === parent);

describe('readKaos: the corpus, counted', () => {
  // #181 gives 41 goals and 8 agents for las.kaos, 76 obstacles for
  // obstacles.kaos and 185 for simple.kaos: 185 counts its two `declare
  // obstacle` blocks that are commented out (o2, o4), 183 are read
  const EXPECTED: Record<string, Record<string, number>> = {
    'ads/las.kaos': {
      'kaos.BehavioralGoal': 41,
      'kaos.Agent': 8,
      'kaos.RefinementLinkHub': 19,
      'kaos.ResponsibilityAssignment': 18,
    },
    'ads/obstacles.kaos': {
      'kaos.BehavioralGoal': 11,
      'kaos.Obstacle': 76,
      'kaos.ObstacleRefinementLinkHub': 67,
      'kaos.ObstructionLink': 11,
    },
    'ads/resolutions.kaos': {
      'kaos.Obstacle': 25,
      'kaos.BehavioralGoal': 30,
      'kaos.ResolutionLink': 33,
    },
    'ads/simple.kaos': {
      'kaos.BehavioralGoal': 19,
      'kaos.Obstacle': 183,
      'kaos.RefinementLinkHub': 4,
      'kaos.ObstacleRefinementLinkHub': 171,
      'kaos.ObstructionLink': 12,
      'kaos.ResolutionLink': 3,
    },
    'ads/simple_new_syntax.kaos': {
      'kaos.BehavioralGoal': 19,
      'kaos.Obstacle': 183,
      'kaos.RefinementLinkHub': 4,
      'kaos.ObstacleRefinementLinkHub': 171,
      'kaos.ObstructionLink': 12,
      'kaos.ResolutionLink': 3,
    },
    'ads/validation-model.kaos': {
      'kaos.BehavioralGoal': 44,
      'kaos.Obstacle': 15,
      'kaos.Agent': 6,
      'kaos.RefinementLinkHub': 18,
      'kaos.ObstacleRefinementLinkHub': 7,
      'kaos.ObstructionLink': 8,
      'kaos.ResponsibilityAssignment': 26,
    },
    'kaostools/las.kaos': {
      'kaos.BehavioralGoal': 10,
      'kaos.Obstacle': 6,
      'kaos.DomainProperty': 5,
      'kaos.Agent': 3,
      'kaos.RefinementLinkHub': 4,
      'kaos.ObstacleRefinementLinkHub': 4,
      'kaos.ObstructionLink': 1,
      'kaos.ResolutionLink': 1,
      'kaos.ResponsibilityAssignment': 5,
    },
  };
  for (const path of CORPUS)
    it(`reads ${path} as a KAOS model istar-ts validates: ${Object.entries(
      EXPECTED[path]!,
    )
      .map(([kind, n]) => `${n} ${kind.slice(5)}`)
      .join(', ')}`, () => {
      const { model, dialectRecord } = read(path);
      assert.deepStrictEqual(census(model), EXPECTED[path]);
      assert.deepStrictEqual(
        validateModel(parsePistar(model, { metamodel: KAOS_OBSTACLES })),
        [],
      );
      // a file with experts, calibrations or their quantiles opens in
      // kaosexpert's mode, with them as its resources (#190); one with
      // resolutions in kaosres's (#191); any other in kaosprop's
      assert.deepStrictEqual(
        [dialectRecord.engine, Object.keys(dialectRecord.projectResources)],
        path === 'ads/las.kaos'
          ? ['kaosexpert', ['expert']]
          : path === 'ads/obstacles.kaos'
            ? ['kaosexpert', ['expert', 'calibration']]
            : EXPECTED[path]!['kaos.ResolutionLink']
              ? ['kaosres', []]
              : ['kaosprop', []],
      );
      // the mode is the project's (the native file's dialect), the framework the kinds'
      assert.strictEqual(model.diagram.customProperties.engine, undefined);
      assert.strictEqual(model.diagram.customProperties.framework, undefined);
    });

  it('reads ADS’s las.kaos with the files it imports: one model of the three', () => {
    const { model, diagnostics, dialectRecord } = read('ads/las.kaos', {
      'obstacles.kaos': fixture('ads/obstacles.kaos'),
      'resolutions.kaos': fixture('ads/resolutions.kaos'),
    });
    assert.deepStrictEqual(census(model), {
      'kaos.BehavioralGoal': 71,
      'kaos.Agent': 8,
      'kaos.Obstacle': 76,
      'kaos.RefinementLinkHub': 19,
      'kaos.ObstacleRefinementLinkHub': 67,
      'kaos.ObstructionLink': 11,
      'kaos.ResolutionLink': 33,
      'kaos.ResponsibilityAssignment': 18,
    });
    // nothing the imports declare is kept now (#190); what one would keep
    // is said, named by its file
    assert.ok(
      !diagnostics.some((d) =>
        /^(obstacles|resolutions)\.kaos: /.test(d.message),
      ),
    );
    const imported = readKaos('import "x.kaos"', {
      files: { 'x.kaos': 'declare scenario [ e ] end' },
    }).diagnostics;
    assert.ok(
      imported.some((d) =>
        d.message.startsWith('x.kaos: declare scenario [ e ]'),
      ),
      JSON.stringify(imported),
    );
    // its experts are the model's (#190)
    assert.deepStrictEqual(
      JSON.parse(
        dialectRecord!.projectResources.expert!['experts.json']!,
      ).experts.map((e: Json) => e.id),
      ['e1', 'e2', 'e3', 'e4', 'e5'],
    );
    assert.ok(
      !/^import /m.test(model.diagram.customProperties[KAOS_UNSUPPORTED_KEY]),
    );
  });
});

describe('readKaos: where each attribute goes, by layer (#181’s table)', () => {
  const las = read('kaostools/las.kaos').model;

  it('a declaration’s name is its text, `definition` its Description, `formalspec` its FormalSpec', () => {
    const goal = nodeOf(
      las,
      'achieve_ambulance_on_scene_when_incident_reported',
    );
    assert.strictEqual(goal.type, 'kaos.BehavioralGoal');
    assert.strictEqual(
      goal.text,
      'Achieve [Ambulance On Scene When Incident Reported]',
    );
    assert.deepStrictEqual(goal.customProperties, {
      Type: '',
      Category: '',
      Source: '',
      Priority: '',
      Issue: '',
      FormalSpec:
        'when incidentReported() then sooner-or-later ambulanceOnScene()',
      FitCriterion: '',
      Stability: '',
      Description:
        'Sooner-or-later, ambulance shall be on scene when incident is reported.',
    });
    // a string over two lines is kept as written
    assert.strictEqual(
      nodeOf(las, 'despatcher').customProperties.Description,
      'Despatcher is the person at the call center dealing \n                with urgent calls and ambulance mobilization.',
    );
  });

  it('a domain property is a DomainProperty with its Kind; an agent’s type its kind', () => {
    assert.deepStrictEqual(
      nodeOf(las, 'by_fax_or_by_phone_mobilization').customProperties,
      {
        Kind: 'invariant',
        Description:
          'An ambulance mobilized by fax or by phone is considered as mobilized.',
        FormalSpec:
          'always (if (ambulanceMobilizedByFax() or ambulanceMobilizedByPhone()) then ambulanceMobilized())',
      },
    );
    assert.strictEqual(nodeOf(las, 'ads').type, 'kaos.Agent');
    const { model, diagnostics } = readText(`declare domainhypothesis [ h ] end
declare agent [ e ] type environment end
declare agent [ m ] type malicious end`);
    assert.strictEqual(nodeOf(model, 'h').customProperties.Kind, 'hypothesis');
    assert.strictEqual(nodeOf(model, 'e').type, 'kaos.EnvironmentAgent');
    assert.strictEqual(nodeOf(model, 'm').type, 'kaos.Agent');
    assert.deepStrictEqual(
      diagnostics.map((d) => [d.severity, d.message]),
      [
        [
          'info',
          "m: a malicious agent, read as an agent (KAOS's anti-models have no kind of their own)",
        ],
      ],
    );
  });

  it('`refinedby [milestone|case]` is a hub with the canonical Tactic; a refinee’s [p] its leg’s Probability, as written', () => {
    const [milestone] = hubsOf(
      las,
      'achieve_ambulance_on_scene_when_incident_reported',
    );
    assert.strictEqual(
      milestone.hub.customProperties.Tactic,
      'milestone-driven',
    );
    const [cases] = hubsOf(
      las,
      'achieve_ambulance_mobilized_when_ambulance_allocated',
    );
    assert.strictEqual(cases.hub.customProperties.Tactic, 'case-driven');
    assert.deepStrictEqual(
      cases.starts.map((leg: Json) => [leg.source, leg.customProperties]),
      [
        [
          'achieve_ambulance_mobilized_when_ambulance_allocated_on_road',
          { Probability: '.8' },
        ],
        [
          'achieve_ambulance_mobilized_when_ambulance_allocated_at_station',
          { Probability: '.2' },
        ],
      ],
    );
    // no pattern: no tactic; each `refinedby` of an obstacle a hub of its own (an OR)
    const [plain] = hubsOf(
      las,
      'achieve_ambulance_mobilized_when_ambulance_allocated_at_station',
    );
    assert.strictEqual(plain.hub.customProperties.Tactic, '');
    assert.strictEqual(
      hubsOf(las, 'mobilized_ambulance_not_on_scene_in_time').length,
      3,
    );
  });

  it('`obstructedby` is an obstruction, `resolvedby` a resolution, `assignedto` an assignment', () => {
    const link = (type: string) =>
      las.links
        .filter((l: Json) => l.type === type)
        .map(
          (l: Json) =>
            `${l.source} → ${l.target}${l.customProperties ? ' ' + JSON.stringify(l.customProperties) : ''}`,
        );
    assert.deepStrictEqual(link('kaos.ObstructionLink'), [
      'mobilized_ambulance_not_on_scene_in_time → achieve_ambulance_on_scene_when_ambulance_mobilized',
    ]);
    assert.deepStrictEqual(link('kaos.ResolutionLink'), [
      'avoid_ambulance_not_in_familiar_area → ambulance_not_in_familiar_area {"ResolutionType":"","Anchor":""}',
    ]);
    assert.ok(
      link('kaos.ResponsibilityAssignment').includes(
        'ads → achieve_ambulance_mobilized_by_fax',
      ),
    );
  });

  it('`resolvedby(prevention|mitigation[g])` is a ResolutionType by TSE’00’s name, and its Anchor; so are the older patterns', () => {
    const { model } = read('ads/resolutions.kaos');
    const of = (goal: string) =>
      model.links.find(
        (l: Json) => l.type === 'kaos.ResolutionLink' && l.source === goal,
      ).customProperties;
    assert.deepStrictEqual(of('mobilization_known_by_other'), {
      ResolutionType: 'obstacle mitigation',
      Anchor: 'achieve_ambulance_mobilization',
    });
    assert.deepStrictEqual(of('avoid_mobilization_without_order'), {
      ResolutionType: 'obstacle prevention',
      Anchor: '',
    });
    const simple = read('ads/simple.kaos').model;
    assert.deepStrictEqual(
      simple.links.find(
        (l: Json) =>
          l.source === 'automated_onscene_detection' &&
          l.type === 'kaos.ResolutionLink',
      ).customProperties,
      { ResolutionType: 'goal substitution', Anchor: 'sg4scene' },
    );
    const newer = read('ads/simple_new_syntax.kaos').model;
    assert.deepStrictEqual(
      newer.links.find(
        (l: Json) =>
          l.source === 'automated_onscene_detection' &&
          l.type === 'kaos.ResolutionLink',
      ).customProperties,
      { ResolutionType: 'goal substitution', Anchor: 'sg4scene' },
    );
  });

  it('the quantities are kaosprop’s keys, strings as written: `rsr` (`rds`) RSR, `esr` (`eps`, `probability`) ESR or Probability', () => {
    const ads = read('ads/las.kaos').model;
    assert.strictEqual(
      nodeOf(ads, 'achieve_incident_resolved').customProperties.RSR,
      '95%',
    );
    const simple = read('ads/simple.kaos').model;
    assert.strictEqual(
      nodeOf(simple, 'avoid_ambulance_mobilized_on_road').customProperties.RSR,
      '.8',
    );
    assert.strictEqual(
      nodeOf(simple, 'false_station_detection').customProperties.Probability,
      '.02',
    );
    const { model } = readText(`declare goal [ g ] esr 0.9 refinedby a end
declare goal [ a ] obstructedby o [.5] end
declare obstacle [ o ] probability 2% end`);
    assert.strictEqual(nodeOf(model, 'g').customProperties.ESR, '0.9');
    assert.strictEqual(nodeOf(model, 'o').customProperties.Probability, '2%');
    assert.deepStrictEqual(
      model.links.find((l: Json) => l.type === 'kaos.ObstructionLink')
        .customProperties,
      { Probability: '.5' },
    );
  });

  it('kaosprop reads them: KAOSTools’ LAS, its .8/.2 legs, propagates', () => {
    const { model } = read('ads/las.kaos');
    const analysis = kaospropAnalysisModel(
      readKaosObstacleModel(JSON.stringify(model)),
    );
    const { probabilities } = propagateProbabilities(analysis);
    // nothing obstructs las.kaos's leaves: every goal is satisfied, its RSR 95% met
    assert.strictEqual(probabilities.get('achieve_incident_resolved'), 1);
  });

  it('an anonymous declaration is named by its name; a reference by a quoted name resolves to it', () => {
    const { model } = read('ads/obstacles.kaos');
    const [paperJam] = hubsOf(model, 'moborder_not_printed');
    assert.strictEqual(paperJam.starts[0].source, 'paper_jam');
    assert.strictEqual(nodeOf(model, 'paper_jam').text, 'Paper Jam');
    // `refinedby "No Line Free"`: the anonymous obstacle declared before
    const [byName] = hubsOf(model, 'moborder_not_sent_to_printer_based_on_am');
    assert.strictEqual(byName.starts[0].source, 'no_line_free');
  });

  it('what nothing declares is made, of the kind its reference says, and said', () => {
    const { model, diagnostics } = read('ads/validation-model.kaos');
    assert.strictEqual(nodeOf(model, 'ads').type, 'kaos.Agent');
    assert.ok(
      diagnostics.some(
        (d) =>
          d.severity === 'warning' &&
          d.message === 'ads is not declared: read as an agent',
      ),
    );
    // a goal with no identifier at all is named by its name
    assert.ok(nodeOf(model, 'achieve_at_hospital_when_incident_reported'));
  });
});

describe('readKaos: nothing silently dropped', () => {
  it('reads a conflict between two goals as a Conflict link, and keeps one among three as written (#191, the flood model’s constraints)', () => {
    const { model, diagnostics } = readText(`declare goal [ a ] end
declare goal [ b ] end
declare goal [ c ] end
declare constraint
  id cst1
  name "A and B"
  conflict a, b
end
declare constraint [ cst2 ] conflict a, b, c end`);
    assert.deepStrictEqual(
      model.links.filter((l: Json) => l.type === 'kaos.Conflict'),
      [
        {
          id: 'a-conflicts-b',
          type: 'kaos.Conflict',
          source: 'a',
          target: 'b',
        },
      ],
    );
    assert.strictEqual(
      model.diagram.customProperties[KAOS_UNSUPPORTED_KEY],
      'declare constraint [ cst2 ] conflict a, b, c end',
    );
    assert.deepStrictEqual(
      diagnostics.map((d) => [d.severity, d.message]),
      [
        [
          'info',
          'declare constraint: read as a Conflict link, which has no name: its name is not kept',
        ],
        [
          'warning',
          'declare constraint [ cst2 ]: kept as written, not read (a conflict among 3 goals: a Conflict link joins two)',
        ],
      ],
    );
  });

  it('reads experts, calibrations and per-expert estimates as kaosexpert’s (#190): nothing kept', () => {
    const { model, diagnostics, dialectRecord } = read('ads/obstacles.kaos');
    assert.strictEqual(
      model.diagram.customProperties[KAOS_UNSUPPORTED_KEY],
      undefined,
    );
    assert.deepStrictEqual(diagnostics, []);
    // an estimate is its expert's Probability, as written (ADS's falling
    // quantiles too: the dialect reports them)
    assert.strictEqual(
      nodeOf(model, 'paper_jam').customProperties['Probability[e4]'],
      '(20.00%, 20.00%, 40.00%)',
    );
    const estimates = model.orphans.flatMap((n: Json) =>
      Object.keys(n.customProperties).filter((k) =>
        k.startsWith('Probability['),
      ),
    );
    assert.strictEqual(estimates.length, 47);
    const resources = dialectRecord!.projectResources;
    assert.deepStrictEqual(JSON.parse(resources.expert!['experts.json']!), {
      experts: [1, 2, 3, 4, 5].map((n) => ({
        id: `e${n}`,
        name: `Expert ${n}`,
      })),
    });
    const [first] = JSON.parse(
      resources.calibration!['calibrations.json']!,
    ).calibrations;
    // anonymous, as ADS declares it; its commented estimates are comments
    assert.deepStrictEqual(first, {
      name: 'Calibration [Allocated Ambulance Not At Station]',
      value: '50%',
      estimates: { e4: '(30.00%, 10.00%, 50.00%)' },
    });
  });

  it('keeps the model attributes but `@title`, custom attributes, and an import it isn’t given', () => {
    const { model, diagnostics } = read('ads/las.kaos');
    assert.strictEqual(model.diagram.name, 'London Ambulance System');
    assert.strictEqual(
      model.diagram.customProperties[KAOS_UNSUPPORTED_KEY],
      [
        '@author "Antoine Cailliau, Axel van Lamsweerde"',
        '@version "0.2"',
        'import "obstacles.kaos"',
        'import "resolutions.kaos"',
      ].join('\n\n'),
    );
    assert.deepStrictEqual(
      diagnostics.map((d) => d.severity),
      ['info', 'info', 'warning', 'warning'],
    );
    const simple = read('ads/simple.kaos');
    assert.ok(
      simple.model.diagram.customProperties[KAOS_UNSUPPORTED_KEY].startsWith(
        'override goal [ goal1 ]\n  $log_cps "TRUE"\nend',
      ),
    );
    assert.ok(
      simple.diagnostics.every((d) => /custom attribute/.test(d.message)),
    );
  });

  it('reads a custom attribute the `kaos` dialect has a key for into it (`$Priority "high"`)', () => {
    const { model, diagnostics } = readText(
      'declare goal [ g ] $Priority "high" $Owner "x" end',
    );
    assert.strictEqual(nodeOf(model, 'g').customProperties.Priority, 'high');
    assert.strictEqual(
      model.diagram.customProperties[KAOS_UNSUPPORTED_KEY],
      'override goal [ g ]\n  $Owner "x"\nend',
    );
    assert.strictEqual(diagnostics.length, 1);
  });

  it('keeps KAOS’s other declarations and attributes (#181’s list) as written, each said', () => {
    // entities, associations, predicates and types are read since #194
    const text = `declare scenario [ night ]
  name "Night shift"
end
declare entity [ ambulance ]
  name "Ambulance"
  isa vehicle
end
declare goal [ g ]
  refinedby [context=night] a, b
  provided x() and y()
  except z()
  relaxedTo w
  replaces h
  esr beta [ 1, 2 ]
end
declare domainproperty [ d ] probability 90% end`;
    const { model, diagnostics } = readText(text);
    assert.ok(model, JSON.stringify(diagnostics));
    const kept: string = model.diagram.customProperties[KAOS_UNSUPPORTED_KEY];
    assert.deepStrictEqual(
      kept.split('\n\n').map((entry) => entry.split('\n')[0]),
      [
        'declare scenario [ night ]',
        'override entity [ ambulance ]',
        'override goal [ g ]',
      ],
    );
    // a domain property's probability is kaosexpert's now (#190), and so is
    // a goal's distribution esr (#199): neither is kept raw any more
    assert.strictEqual(nodeOf(model, 'd').customProperties.Probability, '90%');
    assert.strictEqual(
      nodeOf(model, 'g').customProperties.ESR,
      'beta [ 1, 2 ]',
    );
    assert.ok(
      kept.includes(
        'override goal [ g ]\n  refinedby [context=night] a, b\n  provided x() and y()\n  except z()\n  relaxedTo w\n  replaces h\nend',
      ),
    );
    assert.ok(
      kept.includes('override entity [ ambulance ]\n  isa vehicle\nend'),
    );
    assert.strictEqual(diagnostics.length, 7);
    // the refinement in a context isn't read: g refines into nothing
    assert.strictEqual(hubsOf(model, 'g').length, 0);
  });

  it('says a top-level declaration without its `end`, and reads it', () => {
    const text = 'declare goal [ a ]\n  name "A"\ndeclare goal [ b ]\nend';
    const { model, diagnostics } = readText(text);
    assert.deepStrictEqual(
      model.orphans.map((n: Json) => n.text),
      ['A', 'b'],
    );
    assert.deepStrictEqual(diagnostics, [
      {
        severity: 'warning',
        message:
          'declare goal [ a ] has no "end": it ends where the next declaration starts',
        from: 0,
        to: 'declare goal'.length,
      },
    ]);
  });

  it('refuses a text that isn’t KAOSTools’ syntax, with where', () => {
    const result = readText('declare goal [ g ]\n  name "unclosed\nend');
    assert.strictEqual(result.model, null);
    assert.ok(
      result.diagnostics.length &&
        result.diagnostics.every((d) => d.severity === 'error'),
    );
  });
});

describe('readKaos: the layout (#118’s)', () => {
  for (const path of CORPUS)
    it(`places every node of ${path}, an obstacle below what it obstructs, a hub between its goal and its children`, () => {
      const { model } = read(path);
      for (const node of model.orphans)
        assert.ok(Number.isFinite(node.x) && Number.isFinite(node.y), node.id);
      const node = (id: string) => nodeOf(model, id);
      for (const link of model.links) {
        if (
          link.type === 'kaos.ObstructionLink' &&
          node(link.source).y !== undefined
        )
          assert.ok(
            node(link.source).y > node(link.target).y ||
              model.links.some(
                (l: Json) =>
                  l.hub && l.starts.some((s: Json) => s.source === link.source),
              ),
            `${link.source} below ${link.target}`,
          );
        if (link.hub) {
          assert.ok(link.hub.y > node(link.end.target).y, link.hub.id);
        }
      }
      assert.ok(model.diagram.width > 0 && model.diagram.height > 0);
    });
});

describe('writeKaos: back to .kaos', () => {
  for (const path of CORPUS)
    it(`round-trips ${path}: .kaos → model → .kaos reads to the same model (structurally; the text’s order is the writer’s)`, () => {
      const { model } = read(path);
      const trip = modelRoundTrip(kaosNativeFile, model, { modelName: 'm' });
      assert.ok(trip.ok, trip.problem ?? '');
      // written again, the text is the same: the writer's form is a fixed point
      const again = kaosNativeFile.read(trip.written!, { modelName: 'm' });
      assert.strictEqual(
        writeKaos(again.model!, { modelName: 'm' }).text,
        trip.written,
      );
    });

  it('writes kaosexpert’s back: estimates, distributions, experts, calibrations and their quantiles (#190)', () => {
    const text = `@experts.quantiles "(.1, .5, .9)"
declare goal [ g ] rsr 98% obstructedby o end
declare obstacle [ o ] refinedby a, h refinedby b end
declare obstacle [ a ]
  probability[e1] (2.4%, 2.7%, 3%)
  probability[e2] quantile[2.1%, 2.4%, 2.7%]
end
declare obstacle [ b ] probability pert[1%, 2%, 5%] end
declare domainhypothesis [ h ] probability 98% end
declare expert [ e1 ] name "Expert1" end
declare expert [ e2 ] name "Expert2" $affiliation "UCL" end
declare calibration [ c1 ]
  name "TemperatureSensorBroken"
  probability 4.4%
  probability[e1] (2.3%, 2.5%, 2.8%)
  probability[e2] (4.1%, 4.7%, 5.2%)
end
declare calibration
  name "Anonymous"
  probability 1%
  probability[e1] (30%, 10%, 50%)
end
`;
    const first = kaosNativeFile.read(text, { modelName: 'm' });
    assert.ok(first.model);
    assert.strictEqual(first.dialectRecord.engine, 'kaosexpert');
    const projectResources = first.dialectRecord.projectResources;
    const written = kaosNativeFile.write!(first.model, {
      modelName: 'm',
      projectResources,
    });
    assert.deepStrictEqual(written.diagnostics, []);
    for (const line of [
      '@experts.quantiles "(.1, .5, .9)"',
      '  probability[e1] (2.4%, 2.7%, 3%)',
      '  probability[e2] quantile[2.1%, 2.4%, 2.7%]',
      '  probability pert[1%, 2%, 5%]',
      '  probability 98%',
      'declare expert [ e2 ]\n  name "Expert2"\n  $affiliation "UCL"\nend',
      'declare calibration\n  name "Anonymous"\n  probability 1%\n  probability[e1] (30%, 10%, 50%)\nend',
    ])
      assert.ok(written.text!.includes(line), line);
    // read back: the same model, the same resources, byte for byte
    const again = kaosNativeFile.read(written.text!, { modelName: 'm' });
    assert.deepStrictEqual(again.dialectRecord, first.dialectRecord);
    assert.deepStrictEqual(
      modelRoundTrip(kaosNativeFile, first.model, {
        modelName: 'm',
        projectResources,
      }).ok,
      true,
    );
  });

  it('reads and writes kaosres’s countermeasures (#191): KAOSTools’ annotations of a goal for an obstacle, and cost', () => {
    // KAOSTools' own cases (Parsing.Tests/Integration/TestParsingGoal.cs,
    // TestExceptAttribute … TestRelaxedToAttribute), on one model
    const text = `declare goal [ test ]
  except [obst] goal2
  providednot [obst] mycondition() and otherCondition()
end
declare goal [ goal2 ] cost [obst] 2 end
declare goal [ test2 ]
  replaces [ obst ] test
  relaxedTo [obst2] mycondition() and otherCondition()
  cost 1.5
end
declare goal [ test3 ] cost 1 provided [obst3] mycondition() end
declare goal [ test4 ] cost [budget] 4 end
declare obstacle [ obst ] resolvedby [mitigation:test] goal2 end
declare obstacle [ obst2 ] end
declare obstacle [ obst3 ] end`;
    const { model, diagnostics } = readText(text);
    const resolutions = model.links
      .filter((l: Json) => l.type === 'kaos.ResolutionLink')
      .map((l: Json) => [l.source, l.target, l.customProperties]);
    assert.deepStrictEqual(resolutions, [
      [
        'goal2',
        'obst',
        {
          ResolutionType: 'obstacle mitigation',
          Anchor: 'test',
          Form: 'except',
          Cost: '2',
        },
      ],
      [
        'test',
        'obst',
        {
          ResolutionType: '',
          Anchor: '',
          Form: 'providedNot',
          Condition: 'mycondition() and otherCondition()',
        },
      ],
      [
        'test2',
        'obst',
        {
          ResolutionType: '',
          Anchor: '',
          Form: 'replaces',
          Replaces: 'test',
          Cost: '1.5',
        },
      ],
      [
        'test2',
        'obst2',
        {
          ResolutionType: '',
          Anchor: '',
          Form: 'relaxedTo',
          Condition: 'mycondition() and otherCondition()',
          Cost: '1.5',
        },
      ],
      // `cost n` before the annotation that makes its resolution still reaches it
      [
        'test3',
        'obst3',
        {
          ResolutionType: '',
          Anchor: '',
          Form: 'provided',
          Condition: 'mycondition()',
          Cost: '1',
        },
      ],
    ]);
    // an annotation no resolvedby declares the resolution of makes it, and
    // says so; a cost of a cost variable (KAOSTools before 2017-03) is kept
    assert.deepStrictEqual(
      diagnostics.map((d) => `${d.severity}: ${d.message}`),
      [
        'info: providednot of test: no resolvedby says test resolves obst, so it does',
        'info: replaces of test2: no resolvedby says test2 resolves obst, so it does',
        'info: relaxedTo of test2: no resolvedby says test2 resolves obst2, so it does',
        'info: provided of test3: no resolvedby says test3 resolves obst3, so it does',
        'warning: cost of test4: kept as written, not read (budget is no obstacle: a cost variable has no place in the model)',
      ],
    );
    assert.strictEqual(
      model.diagram.customProperties[KAOS_UNSUPPORTED_KEY],
      'override goal [ test4 ]\n  cost [budget] 4\nend',
    );
    const written = writeKaos(model, { modelName: 'm' });
    for (const line of [
      'declare goal [ test ]\n  except [obst] goal2\n  providednot [obst] mycondition() and otherCondition()\nend',
      'declare goal [ goal2 ]\n  cost [obst] 2\nend',
      '  replaces [obst] test\n  cost [obst] 1.5\n  relaxedTo [obst2] mycondition() and otherCondition()\n  cost [obst2] 1.5\n',
      '  resolvedby [mitigation:test] goal2\n  resolvedby test\n  resolvedby test2\n',
    ])
      assert.ok(written.text!.includes(line), `${line}\n---\n${written.text}`);
    assert.deepStrictEqual(written.diagnostics, []);
    const trip = modelRoundTrip(kaosNativeFile, model, { modelName: 'm' });
    assert.ok(trip.ok, trip.problem ?? '');
  });

  it('says what of a countermeasure it can’t write: a form without its payload, a cost that is no number', () => {
    const { model } = readText(`declare goal [ g ] end
declare obstacle [ o ] resolvedby [prevention] g end`);
    const link = model.links.find(
      (l: Json) => l.type === 'kaos.ResolutionLink',
    );
    link.customProperties = {
      ...link.customProperties,
      Form: 'replaces',
      Cost: 'cheap',
    };
    assert.deepStrictEqual(
      writeKaos(model, { modelName: 'm' }).diagnostics.map((d) => d.message),
      [
        'g resolves o: replaces needs the goal it Replaces, not written',
        'g resolves o: its Cost cheap is no number, not written',
      ],
    );
  });

  it('writes the syntax KAOSTools’ PEG reads: patterns by KAOSTools’ names, quantities as read', () => {
    const { text } = writeKaos(read('kaostools/las.kaos').model, {
      modelName: 'm',
    });
    assert.ok(
      text!.startsWith(
        '@title "m"\n\ndeclare goal [ achieve_ambulance_on_scene_when_incident_reported ]\n',
      ),
    );
    assert.ok(
      text!.includes(
        '  refinedby [case] achieve_ambulance_mobilized_when_ambulance_allocated_on_road [.8], achieve_ambulance_mobilized_when_ambulance_allocated_at_station [.2]\n',
      ),
    );
    const resolutions = writeKaos(read('ads/resolutions.kaos').model, {
      modelName: 'm',
    }).text!;
    assert.ok(
      resolutions.includes(
        '  resolvedby [mitigation:achieve_ambulance_mobilization] mobilization_known_by_other\n',
      ),
    );
    assert.ok(
      resolutions.includes(
        '  resolvedby [prevention] avoid_mobilization_without_order\n',
      ),
    );
  });

  it('writes the `kaos` dialect’s keys .kaos lacks as custom attributes, and says what it can’t write', () => {
    const { model } = readText(`declare goal [ g ] refinedby a end
declare goal [ a ] end
declare agent [ e ] type environment end`);
    const goal = nodeOf(model, 'g');
    goal.customProperties.Priority = 'high';
    goal.customProperties.Owner = 'someone';
    goal.customProperties.RSR = 'most';
    model.links[0].hub.customProperties.SysRef = 'option A';
    model.links[0].hub.customProperties.Tactic = 'guard-introduction';
    model.orphans.push({
      id: '3f2a-uuid',
      text: 'Achieve [New]',
      type: 'kaos.BehavioralGoal',
      x: 0,
      y: 0,
      customProperties: { FormalSpec: 'sooner or later it' },
    });
    model.links.push({
      id: 'c',
      type: 'kaos.Conflict',
      source: 'g',
      target: 'a',
    });
    const { text, diagnostics } = writeKaos(model, { modelName: 'm' });
    assert.ok(
      text!.includes(
        'declare goal [ g ]\n  $Priority "high"\n  refinedby [introduce_guard, sysref = "option A"] a\nend',
      ),
    );
    assert.ok(text!.includes('declare agent [ e ]\n  type environment\nend'));
    // a conflict between two goals: KAOSTools' constraint (#191)
    assert.ok(
      text!.includes(
        'declare constraint [ g_conflicts_a ]\n  conflict g, a\nend',
      ),
    );
    assert.ok(
      text!.includes(
        'declare goal [ achieve_new ]\n  name "Achieve [New]"\n  formalspec "sooner or later it"\nend',
      ),
    );
    assert.deepStrictEqual(
      diagnostics.map((d) => d.message),
      [
        'Achieve [New]: its id 3f2a-uuid is no KAOSTools identifier, written as achieve_new',
        'g: its RSR most is no number, not written',
        'g: its Owner has no .kaos attribute, not written',
        "g: a refinement's SysRef and equations written as parameters KAOSTools doesn't read (only goal-controller does)",
        "achieve_new: its FormalSpec is no KAOSTools formula, written as a string (KAOSTools won't read it)",
      ],
    );
  });
});

describe('the KAOS seeds (examples/kaos): each model is its .kaos read', () => {
  const EXAMPLES = join(__dirname, '../../../../examples/kaos');
  const seed = (name: string) => ({
    kaos: readFileSync(join(EXAMPLES, name, `${name}.kaos`), 'utf8'),
    model: readFileSync(join(EXAMPLES, name, `${name}.txt`), 'utf8'),
  });
  for (const name of ['las', 'ambulance', 'carpooling', 'fire-alarm'])
    it(`${name}: ${name}.txt is ${name}.kaos read, byte for byte; it validates; the native file is in sync`, () => {
      const { kaos, model } = seed(name);
      const read = kaosNativeFile.read(kaos, { modelName: name });
      assert.strictEqual(`${JSON.stringify(read.model, null, 2)}\n`, model);
      assert.deepStrictEqual(
        validateModel(parsePistar(model, { metamodel: KAOS_OBSTACLES })),
        [],
      );
      assert.ok(
        modelRoundTrip(kaosNativeFile, read.model!, { modelName: name }).ok,
      );
    });

  it('ambulance is ADS’s las.kaos and obstacles.kaos: 41 goals, 8 agents, 76 obstacles', () => {
    const model = JSON.parse(seed('ambulance').model);
    assert.deepStrictEqual(census(model), {
      'kaos.BehavioralGoal': 41,
      'kaos.Agent': 8,
      'kaos.Obstacle': 76,
      'kaos.RefinementLinkHub': 19,
      'kaos.ObstacleRefinementLinkHub': 67,
      'kaos.ObstructionLink': 11,
      'kaos.ResponsibilityAssignment': 18,
    });
    // its obstacles' estimates are per expert: kaosprop reads none, every goal holds
    const analysis = kaospropAnalysisModel(
      readKaosObstacleModel(seed('ambulance').model),
    );
    assert.strictEqual(
      propagateProbabilities(analysis).probabilities.get(
        'achieve_incident_resolved',
      ),
      1,
    );
  });

  it('ambulance reads ADS’s five experts, every estimate typed, and writes them back (#198)', () => {
    const { kaos, model } = seed('ambulance');
    const read = kaosNativeFile.read(kaos, { modelName: 'ambulance' });
    // nothing kept raw but the two model attributes the model has no place for
    assert.deepStrictEqual(
      read.diagnostics.map((d) => `${d.severity} ${d.message}`),
      [
        'info @author: kept as written (the model has no place for it)',
        'info @version: kept as written (the model has no place for it)',
      ],
    );
    // 47 leaf obstacles × 5 experts, and 3 calibrations × 5
    const estimates = JSON.parse(model).orphans.flatMap((n: Json) =>
      Object.keys(n.customProperties).filter((k) =>
        k.startsWith('Probability['),
      ),
    );
    assert.strictEqual(estimates.length, 47 * 5);
    const projectResources = read.dialectRecord!.projectResources;
    const { calibrations } = JSON.parse(
      projectResources.calibration!['calibrations.json']!,
    );
    assert.deepStrictEqual(
      calibrations.map((c: Json) => Object.keys(c.estimates)),
      Array(3).fill(['e1', 'e2', 'e3', 'e4', 'e5']),
    );
    // written back and read again: the same model, experts, calibrations
    // and estimates (structurally: the writer orders the text)
    const written = kaosNativeFile.write!(read.model!, {
      modelName: 'ambulance',
      projectResources,
    });
    assert.deepStrictEqual(written.diagnostics, []);
    const again = kaosNativeFile.read(written.text!, {
      modelName: 'ambulance',
    });
    assert.deepStrictEqual(again.dialectRecord, read.dialectRecord);
    assert.ok(
      modelRoundTrip(kaosNativeFile, read.model!, {
        modelName: 'ambulance',
        projectResources,
      }).ok,
    );
  });

  it('carpooling: kaosprop reproduces REJ’13’s chain, 0.015 → … → 0.28 against an RSR of 95%', () => {
    const analysis = kaospropAnalysisModel(
      readKaosObstacleModel(seed('carpooling').model),
    );
    const { probabilities } = propagateProbabilities(analysis);
    const chain: [string, number][] = [
      ['driver_at_other_drop_point', 0.015],
      ['drop_point_never_reached', 0.08],
      ['drop_point_not_reached_in_time', 0.12],
      ['drop_point_not_reached_when_passenger_in_car', 0.19],
      ['drop_point_from_instructions_reached_when_passenger_in_car', 0.81],
      ['drop_point_reached_when_passenger_in_car', 0.81],
      ['passenger_at_destination_when_in_car', 0.81],
      ['passenger_at_destination_when_instructions_known', 0.526],
      ['passenger_at_destination_when_ride_planned', 0.425],
      ['ride_request_served', 0.28],
    ];
    for (const [id, printed] of chain)
      assert.ok(
        Math.abs(probabilities.get(id)! - printed) <= 0.0013,
        `${id}: ${probabilities.get(id)} is not ${printed}`,
      );
    // the same numbers as the hand-drawn fixture, to the last digit
    const drawn = propagateProbabilities(
      kaospropAnalysisModel(
        readKaosObstacleModel(
          readFileSync(
            join(
              __dirname,
              '../engines/kaosprop/fixtures/rej13-carpooling.txt',
            ),
            'utf8',
          ),
        ),
      ),
    ).probabilities;
    for (const [id] of chain)
      assert.strictEqual(probabilities.get(id), drawn.get(id), id);
  });
});
