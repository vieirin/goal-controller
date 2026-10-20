/**
 * KAOS and the NFR Framework (goal-controller#171): their dialects, the
 * DSM3-goals welcome models as seeds (read with their frameworks' roots and
 * written back byte for byte), and the Notation view over them: a KAOS
 * refinement's hub is an AND, a name keeps its brackets, digits and commas.
 */
import { expect } from 'chai';
import { goalView, type GoalView } from '@goal-controller/goal-tree';
import {
  contextFromView,
  documentDiagnostics,
  notationDocument,
  notationEdits,
} from '@goal-controller/goal-language';
import {
  defineDialect,
  property,
  type AnyDialect,
  type ValueConfig,
} from '@goal-controller/dialect';
import { kaos, nfr } from '../../src';
import { parseModel } from '../../../ui/lib/workbench/dialects';
import { frameworkProblems } from '../../../ui/lib/workbench/frameworkProblems';
import { serializeModel } from '../../../ui/lib/workbench/pistar';
import { readFileSync } from 'fs';
import { join } from 'path';
import { models } from './support/models';

const DIALECTS = { kaos, nfr } as const;
type Mode = keyof typeof DIALECTS;

const read = (mode: Mode) => (text: string) => parseModel(text, mode, mode);
// every KAOS and NFR model of examples/; DSM3's welcome models are the files
// directly in the framework's folder (KAOS's stress-test projects, #181, are
// in folders of their own)
const MODELS = {
  kaos: models('examples/kaos', read('kaos')),
  nfr: models('examples/nfr', read('nfr')),
};
const welcome = (mode: Mode) =>
  MODELS[mode].filter(
    (s) => !s.file.slice(`examples/${mode}/`.length).includes('/'),
  );
const SEEDS = { kaos: welcome('kaos'), nfr: welcome('nfr') };
const seed = (mode: Mode) => SEEDS[mode][0]!.model;

const viewOf = (mode: Mode, text: string): GoalView =>
  goalView(read(mode)(text) as never, DIALECTS[mode] as unknown as AnyDialect);

/** A seed whose elements' names start with an id of their kind's prefix (G1, A1, DP1, O1). */
const withIds = (mode: Mode, text: string): string => {
  const json = JSON.parse(text);
  const elements = DIALECTS[mode].elements as Record<
    string,
    { prefix: string }
  >;
  // by kind, not file type (an obstacle's file type is kaos.Obstacle)
  const model = read(mode)(text);
  const count = new Map<string, number>();
  for (const element of json.orphans) {
    const prefix = elements[model.elements.get(element.id)!.kind]!.prefix;
    count.set(prefix, (count.get(prefix) ?? 0) + 1);
    element.text = `${prefix}${count.get(prefix)}: ${element.text}`;
  }
  return `${JSON.stringify(json, null, 2)}\n`;
};

const byName = (view: GoalView, name: string) =>
  [...view.nodes.values()].find((node) => node.name === name)!;
const namesOf = (view: GoalView, keys: readonly string[]) =>
  keys.map((key) => view.nodes.get(key)!.name);

describe('frameworks: the kaos and nfr dialects (#171)', () => {
  it('are their frameworks’, with the issue’s prefixes and no notation', () => {
    expect(kaos.framework).to.equal('kaos');
    expect(nfr.framework).to.equal('nfr');
    expect(
      Object.fromEntries(
        Object.entries(kaos.elements).map(([kind, e]) => [kind, e.prefix]),
      ),
    ).to.deep.equal({
      'kaos.BehavioralGoal': 'G',
      'kaos.Softgoal': 'G',
      'kaos.Agent': 'A',
      'kaos.EnvironmentAgent': 'A',
      'kaos.DomainProperty': 'DP',
      'kaosObstacles.Obstacle': 'O',
    });
    expect(
      Object.fromEntries(
        Object.entries(nfr.elements).map(([kind, e]) => [kind, e.prefix]),
      ),
    ).to.deep.equal({
      'nfr.NFR': 'S',
      'nfr.Operationalization': 'O',
      'nfr.Claim': 'C',
    });
    expect('notation' in kaos || 'notation' in nfr).to.equal(false);
  });

  it('give KAOS goals DSM3’s eight properties, its hub three and its conflict one', () => {
    const keys = (list: readonly { key: string }[]) => list.map((p) => p.key);
    expect(keys(kaos.properties['kaos.BehavioralGoal'])).to.deep.equal([
      'Type',
      'Category',
      'Source',
      'Priority',
      'Issue',
      'FormalSpec',
      'FitCriterion',
      'Stability',
      'Description',
    ]);
    expect(keys(kaos.properties['kaos.RefinementLinkHub'])).to.deep.equal([
      'SysRef',
      'Status',
      'Tactic',
    ]);
    expect(keys(kaos.links['kaos.Conflict'])).to.deep.equal([
      'BoundaryCondition',
    ]);
  });

  it('types the keys with a vocabulary, one source each, and FormalSpec as a formula (#181)', () => {
    // a vocabulary's values, or the value config
    const typeOf = (value: unknown) => {
      const config = value as ValueConfig;
      return config.type === 'enum'
        ? config.options.map((o) => o.value)
        : config;
    };
    const types = Object.fromEntries(
      kaos.properties['kaos.BehavioralGoal'].map((p) => [
        p.key,
        typeOf(p.value),
      ]),
    );
    expect(types).to.deep.equal({
      Type: [
        '',
        'Achieve',
        'Cease',
        'Maintain',
        'Avoid',
        'Optimize',
        'softgoal',
      ],
      Category: [
        '',
        'Satisfaction',
        'Information',
        'Accuracy',
        'Safety',
        'Security',
      ],
      Source: { type: 'text' },
      Priority: ['', 'high', 'medium', 'low'],
      Issue: { type: 'text' },
      FormalSpec: { type: 'formula', language: 'ltl' },
      FitCriterion: { type: 'text' },
      Stability: { type: 'text' },
      Description: { type: 'text' },
    });
    const tactic = kaos.properties['kaos.RefinementLinkHub'].find(
      (p) => p.key === 'Tactic',
    )!.value;
    expect(typeOf(tactic)).to.deep.equal([
      '',
      'milestone-driven',
      'case-driven',
      'guard-introduction',
      'divide-and-conquer',
      'uncontrollability',
      'unmonitorability',
      // KAOSTools' names, labelled with the values they stand for
      'milestone',
      'case',
    ]);
    // nothing quantitative: those are an engine's (kaosprop's, PR G)
    for (const list of [
      ...Object.values(kaos.properties),
      ...Object.values(kaos.links),
    ])
      for (const p of list)
        expect(['RSR', 'ESR', 'Probability'], p.key).not.to.include(p.key);
  });
});

describe('frameworks: the DSM3 seeds (#171)', () => {
  it('are the welcome models of examples/kaos and examples/nfr', () => {
    expect(SEEDS.kaos.map((s) => s.file)).to.deep.equal([
      'examples/kaos/kaos-welcome.txt',
    ]);
    expect(SEEDS.nfr.map((s) => s.file)).to.deep.equal([
      'examples/nfr/nfr-welcome.txt',
    ]);
  });

  it('read with their frameworks’ roots, and write back byte for byte, as every KAOS and NFR example does (#181’s too)', () => {
    expect(MODELS.kaos.map((s) => s.file)).to.deep.equal([
      'examples/kaos/ambulance/ambulance.txt',
      'examples/kaos/carpooling/carpooling.txt',
      'examples/kaos/kaos-welcome.txt',
      'examples/kaos/las/las.txt',
    ]);
    for (const mode of ['kaos', 'nfr'] as const)
      for (const { file, model } of MODELS[mode])
        expect(serializeModel(read(mode)(model), model), file).to.equal(model);
  });

  it('are no iStar models', () => {
    expect(() => parseModel(seed('kaos'), null, 'istar-2.0')).to.throw();
    expect(() => parseModel(seed('nfr'), null, 'istar-2.0')).to.throw();
  });
});

describe('frameworks: the view of a KAOS or NFR model (#171)', () => {
  it('reads a KAOS refinement’s hub as an AND of its legs’ sources, no hub listed', () => {
    const view = viewOf('kaos', seed('kaos'));
    const kinds = [...view.nodes.values()].map((node) => node.kind);
    expect(kinds).to.not.include('kaos.RefinementLinkHub');
    expect(kinds).to.have.length(8);
    const reliability = byName(view, 'Reliability');
    expect(reliability.relation).to.equal('and');
    expect(namesOf(view, reliability.children)).to.deep.equal([
      'Achieve [Problem Notified if Problem]',
      'Backup',
    ]);
    const backup = byName(view, 'Backup');
    expect(namesOf(view, backup.children)).to.deep.equal([
      'Maintain [Minimal Interval Between Automatic Backups]',
      'Achieve [Manual Backup]',
    ]);
    expect(
      namesOf(
        view,
        byName(view, 'Maintain [Minimal Interval Between Automatic Backups]')
          .children,
      ),
    ).to.deep.equal(['Internet connection available']);
    // on the paper: every element no refinement reaches is a root
    expect(namesOf(view, view.roots)).to.deep.equal([
      'Reliability',
      'Save Bandwidth',
      'User',
    ]);
  });

  it('reads NFR’s And- and Or-refinements, not its contributions, correlations or arguments', () => {
    const view = viewOf('nfr', seed('nfr'));
    const security = byName(view, 'Security');
    expect(security.relation).to.equal('and');
    expect(namesOf(view, security.children)).to.deep.equal([
      'Confidenciality',
      'Authentication',
    ]);
    expect(byName(view, 'Confidenciality').children).to.deep.equal([]);
    expect(view.roots).to.have.length(7);
    // the argument targets a link: no end the view lists
    const argument = view.links.find((l) => l.kind === 'nfr.ArgumentLink')!;
    expect(argument.target).to.equal(null);
    expect(
      view.links.find((l) => l.kind === 'nfr.ContributionLink')?.label,
    ).to.equal('+');
  });
});

describe('frameworks: the Notation view of a KAOS or NFR model (#171)', () => {
  for (const mode of ['kaos', 'nfr'] as const)
    it(`${mode}: writes its lines with ids and reads them back clean, changing nothing`, () => {
      const text = withIds(mode, seed(mode));
      const view = viewOf(mode, text);
      const definition = DIALECTS[mode] as unknown as AnyDialect;
      const doc = notationDocument(definition, view).text;
      expect(
        documentDiagnostics(
          definition,
          doc,
          contextFromView(definition, view, []),
        ),
      ).to.deep.equal([]);
      expect(notationEdits(definition, doc, view)).to.deep.equal([]);
    });

  it('kaos: a hub is an AND, its sub-goals under the goal; brackets are the name’s', () => {
    const view = viewOf('kaos', withIds('kaos', seed('kaos')));
    const doc = notationDocument(kaos as unknown as AnyDialect, view).text;
    const elementLines = doc
      .split('\n')
      .filter((line) => /^\s*(G|A|DP)\d+:/.test(line));
    expect(elementLines).to.deep.equal([
      'G1: Reliability',
      '  G3: Achieve [Problem Notified if Problem]',
      '  G6: Backup',
      '    G2: Maintain [Minimal Interval Between Automatic Backups]',
      '      DP1: Internet connection available',
      '    G5: Achieve [Manual Backup]',
      'G4: Save Bandwidth',
      'A1: User',
    ]);
    // the conflict's boundary condition, a link line under its source
    expect(doc).to.include('  link G4 {BoundaryCondition = }');
  });

  it('nfr: digits and commas are the name’s', () => {
    const view = viewOf('nfr', withIds('nfr', seed('nfr')));
    const doc = notationDocument(nfr as unknown as AnyDialect, view).text;
    expect(doc).to.include('O1: Encrypt with RSA 128 bits');
    expect(doc).to.include('S5: Example of a big, colored NFR');
  });

  it('maps a renamed line back to its element, brackets and all', () => {
    const text = withIds('kaos', seed('kaos'));
    const view = viewOf('kaos', text);
    const definition = kaos as unknown as AnyDialect;
    const doc = notationDocument(definition, view).text.replace(
      'G5: Achieve [Manual Backup]',
      'G5: Achieve [Manual Backup Done]',
    );
    expect(notationEdits(definition, doc, view)).to.deep.equal([
      {
        iStarId: byName(view, 'Achieve [Manual Backup]').iStarId,
        text: 'G5: Achieve [Manual Backup Done]',
      },
    ]);
  });

  it('reports a line whose prefix is none of its kinds’', () => {
    const view = viewOf('kaos', withIds('kaos', seed('kaos')));
    const definition = kaos as unknown as AnyDialect;
    const doc = notationDocument(definition, view).text;
    const added = (line: string) =>
      documentDiagnostics(
        definition,
        `${doc}\n${line}`,
        contextFromView(definition, view, []),
      )
        .filter((d) => d.from > doc.length)
        .map((d) => d.message);
    // an iStar prefix: read as an id, of no KAOS kind
    expect(added('T1: A task')).to.deep.equal([
      "T is no prefix of KAOS's: its elements are G…, A…, DP…, O…",
    ]);
    // another framework's: no id at all in KAOS (a property line, here
    // under the agent above it)
    expect(added('S1: A softgoal')).to.deep.equal([
      'Not read for a kaos.EnvironmentAgent',
    ]);
    // one of its own, of an element the diagram doesn't have
    expect(added('DP9: Power is on')).to.deep.equal([
      'Add this element in the diagram',
    ]);
  });
});

describe('frameworks: KAOS vocabularies and leg properties in the Notation view (#181)', () => {
  const definition = kaos as unknown as AnyDialect;
  const lines = (doc: string, view: GoalView, of: AnyDialect = definition) =>
    documentDiagnostics(of, doc, contextFromView(of, view, [])).map((d) => ({
      severity: d.severity,
      message: d.message,
    }));

  it('reports a value outside a vocabulary, and writes it back as read', () => {
    const view = viewOf('kaos', withIds('kaos', seed('kaos')));
    const doc = notationDocument(definition, view).text.replace(
      'G3: Achieve [Problem Notified if Problem]\n    Type\n',
      'G3: Achieve [Problem Notified if Problem]\n    Type Achive\n',
    );
    expect(lines(doc, view)).to.deep.equal([
      {
        severity: 'error',
        message:
          'One of Achieve, Cease, Maintain, Avoid, Optimize, softgoal, not Achive',
      },
    ]);
    // a Problem, not a parse error: the value is the element's, as written
    expect(notationEdits(definition, doc, view)).to.deep.equal([
      {
        iStarId: byName(view, 'Achieve [Problem Notified if Problem]').iStarId,
        key: 'Type',
        value: 'Achive',
      },
    ]);
  });

  it('writes a leg’s properties as a link line under its sub-goal, naming the refined goal', () => {
    // a dialect typing the legs of KAOS's refinement (as kaosprop's does, PR G)
    const legs = defineDialect({
      ...definition,
      id: 'kaos-legs',
      links: {
        ...definition.links,
        'kaos.RefinementLinkStart': [
          property.probability('Probability', { help: 'its case’s' }),
        ],
      },
    });
    const json = JSON.parse(withIds('kaos', seed('kaos')));
    // the leg from G3 (Achieve [Problem Notified if Problem]) to G1's hub
    json.links[3].starts[0].customProperties = { Probability: '.6' };
    const text = `${JSON.stringify(json, null, 2)}\n`;
    const view = goalView(read('kaos')(text) as never, legs);
    const doc = notationDocument(legs, view).text;
    // under G3, after its property lines
    const g3 = doc.slice(doc.indexOf('G3: '), doc.indexOf('G6: '));
    expect(g3).to.match(
      /\n {4}Description\n {4}link G1 \{Probability = \.6\}\n/,
    );
    expect(lines(doc, view, legs)).to.deep.equal([]);
    expect(notationEdits(legs, doc, view)).to.deep.equal([]);
    expect(
      lines(
        doc.replace('{Probability = .6}', '{Probability = 120%}'),
        view,
        legs,
      ),
    ).to.deep.equal([
      {
        severity: 'error',
        message: 'A probability in [0, 1] (0.8, .8 or 80%), not 120%',
      },
    ]);
  });
});

/**
 * KAOSTools' London Ambulance as istar-ts draws it (istar-ts#20's
 * `fixtures/dsm3/kaos-las.txt`; the model is Cailliau's, MIT): obstacles,
 * their refinements, an obstruction, a resolution with its anchor, a
 * milestone and a case hub with leg probabilities, RSR and ESR, all strings.
 */
const LAS = readFileSync(join(__dirname, 'fixtures', 'kaos-las.txt'), 'utf8');

describe('frameworks: the KAOS obstacle analysis (#181)', () => {
  const definition = kaos as unknown as AnyDialect;
  const lasWith = (change: (json: any) => void) => {
    const json = JSON.parse(LAS);
    change(json);
    return read('kaos')(JSON.stringify(json, null, 2));
  };
  const resolution = (json: any) =>
    json.links.find((l: any) => l.type === 'kaos.ResolutionLink');

  it('reads LAS with the KAOS root and its obstacles, and writes it back byte for byte', () => {
    const model = read('kaos')(LAS);
    const kinds: string[] = [...model.elements.values()].map((e) => e.kind);
    expect(kinds.filter((k) => k === 'kaosObstacles.Obstacle')).to.have.length(
      6,
    );
    expect(serializeModel(model, LAS)).to.equal(LAS);
  });

  it('lists an obstacle tree of its own: sub-obstacles under the obstacle they refine', () => {
    const view = viewOf('kaos', LAS);
    const root = byName(view, 'Mobilized Ambulance Not On Scene in Time');
    expect(view.roots).to.include(root.key);
    // its three refinements (an OR) merged into one AND, as a goal's are
    expect(namesOf(view, root.children)).to.have.members([
      'Ambulance Stuck In Traffic Jam',
      'Ambulance On Scene Not In Traffic Jam',
      'Ambulance Lost',
      'Ambulance On Scene Not Lost',
      'Ambulance Broken Down',
      'Ambulance On Scene Broken Down',
    ]);
    expect(
      namesOf(view, byName(view, 'Ambulance Lost').children),
    ).to.have.members([
      'Ambulance Not In Familiar Area',
      'GPS Not Working',
      'Ambulance Lost Iff GPS Not Working And Not In Familiar Area',
    ]);
  });

  it('writes obstacle lines and the resolution’s link line, and reads them back clean', () => {
    const text = withIds('kaos', LAS);
    const view = viewOf('kaos', text);
    const doc = notationDocument(definition, view).text;
    expect(doc).to.include('O1: Mobilized Ambulance Not On Scene in Time\n');
    expect(doc).to.include('  O3: Ambulance Lost\n');
    // the anchor is a piStar id, as imported: it resolves
    expect(doc).to.match(
      /G10: Avoid \[Ambulance Not In Familiar Area\][^]*?\n {2}link O5 \{ResolutionType = mitigation\} \{Anchor = achieve_ambulance_on_scene_when_ambulance_mobilized\}\n/,
    );
    expect(
      documentDiagnostics(
        definition,
        doc,
        contextFromView(definition, view, []),
      ),
    ).to.deep.equal([]);
    expect(notationEdits(definition, doc, view)).to.deep.equal([]);
  });

  it('keeps the quantities as unknown keys, untouched', () => {
    const model = read('kaos')(LAS);
    const root = [...model.elements.values()].find((e) =>
      e.name.startsWith('Achieve [Ambulance On Scene When Incident'),
    )!;
    expect(root.customProperties).to.include({ RSR: '0.95', ESR: '0.9277' });
    for (const list of [
      ...Object.values(kaos.properties),
      ...Object.values(kaos.links),
    ])
      for (const p of list)
        expect(['RSR', 'ESR', 'Probability']).not.to.include(p.key);
  });

  it('finds no Problem in LAS; an obstruction of a refined goal and a dangling anchor are', () => {
    expect(frameworkProblems(read('kaos')(LAS), kaos)).to.deep.equal([]);
    const problems = (model: ReturnType<ReturnType<typeof read>>) =>
      frameworkProblems(model, kaos).map((p) => [
        p.severity,
        p.code,
        p.message,
      ]);
    expect(
      problems(
        lasWith((json) => {
          json.links.find(
            (l: any) => l.type === 'kaos.ObstructionLink',
          ).target = 'achieve_ambulance_on_scene_when_ambulance_allocated';
        }),
      ),
    ).to.deep.equal([
      [
        'warning',
        'not-a-leaf',
        'A obstruction link targets a leaf, and "Achieve [Ambulance On Scene When Ambulance Allocated]" is refined: link its sub-elements instead',
      ],
    ]);
    expect(
      problems(
        lasWith((json) => {
          resolution(json).customProperties.Anchor = 'G99';
        }),
      ),
    ).to.deep.equal([
      [
        'error',
        'dangling-reference',
        'Anchor: G99 is not an element of this model',
      ],
    ]);
    expect(
      problems(
        lasWith((json) => {
          resolution(json).customProperties.Anchor = 'ads';
        }),
      ),
    ).to.deep.equal([
      [
        'error',
        'dangling-reference',
        'Anchor: ads is a kaos.Agent, not a kaos.BehavioralGoal or kaos.Softgoal',
      ],
    ]);
  });

  it('checks a reference in a conditional value, and passes over values that are no text', () => {
    // a dialect whose Anchor is a reference only for mitigations
    const conditional = {
      ...kaos,
      links: {
        ...kaos.links,
        'kaosObstacles.ResolutionLink': [
          kaos.links['kaosObstacles.ResolutionLink'][0]!,
          {
            key: 'Anchor',
            value: {
              when: { key: 'ResolutionType', equals: 'mitigation' },
              matching: { type: 'reference', kinds: ['kaos.BehavioralGoal'] },
              otherwise: { type: 'text' },
            },
            help: '',
          },
        ],
      },
    } as unknown as AnyDialect;
    const anchored = (type: string, anchor: unknown) =>
      frameworkProblems(
        lasWith((json) => {
          resolution(json).customProperties = {
            ResolutionType: type,
            Anchor: anchor,
          };
        }),
        conditional,
      ).map((p) => p.code);
    expect(anchored('mitigation', 'G99')).to.deep.equal(['dangling-reference']);
    expect(anchored('prevention', 'G99')).to.deep.equal([]);
    expect(anchored('mitigation', 42)).to.deep.equal([]);
  });

  it('types an obstacle’s and a domain property’s keys, and a resolution’s', () => {
    const view = viewOf('kaos', withIds('kaos', LAS));
    const doc = notationDocument(definition, view)
      .text.replace(
        'O1: Mobilized Ambulance Not On Scene in Time\n',
        'O1: Mobilized Ambulance Not On Scene in Time\n  Category Hazard\n',
      )
      .replace(
        '  DP1: Ambulance On Scene Not In Traffic Jam\n',
        '  DP1: Ambulance On Scene Not In Traffic Jam\n    Kind axiom\n',
      )
      .replace('{ResolutionType = mitigation}', '{ResolutionType = repair}');
    const messages = documentDiagnostics(
      definition,
      doc,
      contextFromView(definition, view, []),
    ).map((d) => d.message);
    expect(messages).to.have.length(2);
    expect(messages).to.include('One of invariant, hypothesis, not axiom');
    expect(
      messages.find((m) => m.startsWith('One of goal substitution, ')),
    ).to.match(/, prevention, mitigation, not repair$/);
  });
});

describe('frameworks: Problems (#171)', () => {
  /** A seed changed as JSON, then read with its framework's root. */
  const changed = (mode: Mode, change: (json: any) => void) => {
    const json = JSON.parse(seed(mode));
    change(json);
    return read(mode)(JSON.stringify(json, null, 2));
  };
  const codes = (mode: Mode, model: ReturnType<ReturnType<typeof read>>) =>
    frameworkProblems(model, DIALECTS[mode]).map((p) => [
      p.code,
      p.elementId,
      p.source,
    ]);
  const idOf = (mode: Mode, text: string) =>
    JSON.parse(seed(mode)).orphans.find((o: any) => o.text === text).id;

  it('finds none in the seeds', () => {
    expect(frameworkProblems(read('kaos')(seed('kaos')), kaos)).to.deep.equal(
      [],
    );
    expect(frameworkProblems(read('nfr')(seed('nfr')), nfr)).to.deep.equal([]);
  });

  it('kaos: a refinement without its end is incomplete, on its hub', () => {
    let hub = '';
    const model = changed('kaos', (json) => {
      const entry = json.links.find((l: any) => l.hub);
      hub = entry.hub.id;
      delete entry.end;
    });
    expect(codes('kaos', model)).to.deep.equal([
      ['incomplete-hub', hub, 'KAOS'],
    ]);
  });

  it('kaos: a link onto a refinement’s hub is a hub-target', () => {
    let hub = '';
    const model = changed('kaos', (json) => {
      hub = json.links.find((l: any) => l.hub).hub.id;
      json.links.push({
        id: 'conflict-onto-hub',
        type: 'kaos.Conflict',
        source: idOf('kaos', 'Save Bandwidth'),
        target: hub,
        customProperties: { BoundaryCondition: '' },
      });
    });
    expect(codes('kaos', model)).to.deep.equal([
      ['hub-target', 'conflict-onto-hub', 'KAOS'],
    ]);
  });

  it('nfr: DSM3’s rules (a softgoal never contributes to an operationalization)', () => {
    const model = changed('nfr', (json) => {
      json.links.push({
        id: 'onto-operationalization',
        type: 'nfr.ContributionLink',
        source: idOf('nfr', 'Usability'),
        target: idOf('nfr', 'Login with Username and Password'),
        label: '+',
      });
    });
    const [problem, ...rest] = frameworkProblems(model, nfr);
    expect(rest).to.deep.equal([]);
    expect(problem).to.include({
      code: 'invalid-target',
      elementId: 'onto-operationalization',
      message: 'you cannot have a NFR contributing to an Operationalization',
    });
  });

  it('nfr: a contribution’s label is one of NFR’s', () => {
    const model = changed('nfr', (json) => {
      json.links.find((l: any) => l.type === 'nfr.ContributionLink').label =
        'help';
      delete json.links.find((l: any) => l.type === 'nfr.CorrelationLink')
        .label;
    });
    expect(
      frameworkProblems(model, nfr).map((p) => [p.code, p.message]),
    ).to.deep.equal([
      [
        'unknown-label',
        'A contribution link\'s label is one of ++, +, some+, some-, –, – –, unknown, not "help"',
      ],
      [
        'unknown-label',
        "A correlation link's label is one of ++, +, some+, some-, –, – –, unknown, not none",
      ],
    ]);
  });
});
