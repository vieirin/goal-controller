/**
 * The engine definitions against the reference result: the hand-written Langium
 * notation (vn/rt-langium-notation, pinned in test/reference by
 * scripts/sync-reference.sh). The definitions and what the views build from them
 * must equal what the reference declares and computes, on every example model.
 */
import { expect } from 'chai';
import { execFileSync } from 'child_process';
import { mkdtempSync, readFileSync, readdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { parsePistar } from '../../goal-tree/node_modules/@istar-ts/core';
import { goalView, type GoalView } from '../../goal-tree/out';
import { edgeCheckRegistry, type Check } from '../../lib/out';
import {
  contextFromView,
  declarationKeys,
  edge,
  edgeLangium,
  edgeV2,
  inputOf,
  notationDocument,
  notationEdits,
  operatorsFor,
  propertyKeys,
  relationMismatch,
  specsFromDefinition,
  type ElementKind,
} from '../src';
// the UI's own edit writer (React-free), as the Notation view applies edits
import { applyNotationEdits } from '../../ui/lib/workbench/notationDocument';
import { RETRY } from '../src/engines/edgeShared';
import * as reference from './reference/constructs';
import * as referenceContext from './reference/context';
import {
  PROPERTY_SPECS,
  inputOf as referenceInputOf,
} from './reference/edgeProperties';
import * as referenceNotation from './reference/notation';
import * as referenceProperties from './reference/properties';
import { ROOT, models } from './support/models';

const REFERENCE = join(__dirname, 'reference');
const EDGE_V2_FAMILY = [edgeV2, edgeLangium] as const;
const DEFINITIONS = [edge, edgeV2, edgeLangium] as const;

const text = (file: string) => readFileSync(file, 'utf8');

const EDGE_MODELS = [
  ...models('examples/edge'),
  ...models('dissertationExamples'),
];
const EDGE_V2_MODELS = [
  ...models('examples/edgeV2'),
  ...models('dissertationExamples'),
];

const view = (model: string, grammar: 'edge' | 'edgeV2'): GoalView =>
  goalView(parsePistar(model), grammar);

describe('harness: the reference files', () => {
  it('are what the sync script pins (no diff on re-running it)', () => {
    const out = mkdtempSync(join(tmpdir(), 'reference-'));
    execFileSync(join(ROOT, 'scripts', 'sync-reference.sh'), [out]);
    for (const name of readdirSync(REFERENCE))
      expect(text(join(out, name)), name).to.equal(text(join(REFERENCE, name)));
    expect(readdirSync(out).sort()).to.deep.equal(
      readdirSync(REFERENCE).sort(),
    );
  });

  it('finds the example models', () => {
    expect(EDGE_MODELS.length).to.be.greaterThan(10);
    expect(EDGE_V2_MODELS.length).to.be.greaterThan(10);
  });
});

describe('harness 1: constructs', () => {
  for (const definition of DEFINITIONS) {
    it(`${definition.id}: labels, help and relations equal the reference`, () => {
      const table: Record<string, Partial<Record<string, string>>> = definition
        .notation.constructs;
      const pick = (field: 'label' | 'help' | 'relation') =>
        Object.fromEntries(
          Object.entries(table)
            .filter(([, c]) => c[field] !== undefined)
            .map(([name, c]) => [name, c[field]]),
        );
      expect(pick('label')).to.deep.equal(reference.CONSTRUCT_LABEL);
      expect(pick('help')).to.deep.equal(reference.CONSTRUCT_HELP);
      expect(pick('relation')).to.deep.equal(reference.CONSTRUCT_RELATION);
    });
  }

  it('edgeV2: operator → construct table equals RT_OPERATORS, in its order', () => {
    for (const definition of EDGE_V2_FAMILY)
      expect(
        operatorsFor(definition).constructs.map((b) => ({
          op: b.symbol,
          construct: b.construct,
        })),
      ).to.deep.equal(reference.RT_OPERATORS);
  });

  it('the retry help equals RETRY_HELP', () => {
    expect(RETRY.help).to.equal(reference.RETRY_HELP);
  });

  it('relation mismatch reads as the reference says it', () => {
    for (const construct of Object.keys(reference.CONSTRUCT_LABEL))
      for (const relation of ['and', 'or', null] as const)
        expect(
          relationMismatch(edgeV2, construct, relation),
          `${construct}/${relation}`,
        ).to.equal(
          reference.relationMismatch(
            construct as reference.RtConstruct,
            relation,
          ),
        );
  });
});

describe('harness 2: precedence', () => {
  it('edgeV2: the infix order equals the .langium BinaryExpr line, @ tightest', () => {
    const langium = text(join(REFERENCE, 'rt-notation.langium'));
    const line = /infix BinaryExpr on RetryExpr:\s*([^\n]+);\s*$/m.exec(
      langium,
    )![1]!;
    const symbols = [...line.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    // RetryExpr: Primary ({…} '@' times=FLOAT)* — postfix, binds tighter than all
    expect(langium).to.match(
      /RetryExpr infers Expr:\s*Primary \(\{[^}]+\} '@' times=FLOAT\)\*/,
    );
    for (const definition of EDGE_V2_FAMILY) {
      const [first, ...rest] = definition.notation.operators;
      expect(first).to.include({ symbol: '@', form: 'postfix' });
      expect(rest.map((o) => o.symbol)).to.deep.equal(symbols);
      expect(
        rest.every((o) => o.form === 'infix' && o.assoc === 'left'),
      ).to.equal(true);
    }
  });

  /** An RTRegex.g4's operator alternatives, in order: `expr op = 'x' expr` or a lone `op = 'x'`. */
  const g4Operators = (grammar: string) =>
    [
      ...text(
        join(ROOT, 'packages/lib/grammar', grammar, 'RTRegex.g4'),
      ).matchAll(/\|\s*(expr\s+)?op = '([^']+)'\s*(expr|FLOAT)?/g),
    ].map(([, left, symbol, right]) => ({
      symbol,
      form: !left ? 'standalone' : right === 'FLOAT' ? 'postfix' : 'infix',
    }));

  it('edge: the operators match edge/RTRegex.g4 (incl. the standalone +)', () => {
    expect(
      edge.notation.operators.map((o) => ({ symbol: o.symbol, form: o.form })),
    ).to.deep.equal(g4Operators('edge'));
  });

  it('edgeV2: the operators match edgeV2/RTRegex.g4 too', () => {
    expect(
      edgeV2.notation.operators.map((o) => ({
        symbol: o.symbol,
        form: o.form,
      })),
    ).to.deep.equal(g4Operators('edgeV2'));
  });
});

const MODE_OF_VALUE: Record<string, string> = {
  expression: 'assertion',
  refList: 'dependsOn',
};

describe('harness 3: property config', () => {
  const { PROPERTY_MODES, PROPERTY_HELP, RESOURCE_KEYS } = referenceProperties;

  for (const definition of DEFINITIONS) {
    it(`${definition.id}: goal and task keys, modes and help equal the reference`, () => {
      const lineKeys = new Set([
        ...propertyKeys(definition, 'goal'),
        ...propertyKeys(definition, 'task'),
      ]);
      expect([...lineKeys].sort()).to.deep.equal(
        Object.keys(PROPERTY_MODES).sort(),
      );
      for (const kind of ['goal', 'task'] as const)
        for (const property of definition.properties[kind]) {
          const key = property.key as keyof typeof PROPERTY_MODES;
          const type =
            'when' in property.value ? 'conditional' : property.value.type;
          expect(MODE_OF_VALUE[type] ?? 'value', `${kind}.${key}`).to.equal(
            PROPERTY_MODES[key],
          );
          expect(property.help, `${kind}.${key}`).to.equal(PROPERTY_HELP[key]);
        }
    });

    it(`${definition.id}: resource keys equal RESOURCE_KEYS`, () => {
      expect(
        declarationKeys(definition.elements.resource.declaration),
      ).to.deep.equal([...RESOURCE_KEYS]);
      expect([...propertyKeys(definition, 'resource')].sort()).to.deep.equal(
        [...RESOURCE_KEYS].sort(),
      );
    });

    it(`${definition.id}: property lines are written in PROPERTY_MODES order`, () => {
      expect(definition.propertyLineOrder).to.deep.equal(
        Object.keys(PROPERTY_MODES),
      );
    });

    it(`${definition.id}: the severities equal NOTATION_SEVERITY`, () => {
      const {
        NOTATION_SEVERITY,
        NOT_A_CHILD,
        MISSING_FROM_NOTATION,
        NOT_IN_DIAGRAM,
      } = referenceContext;
      for (const [kind, severity] of Object.entries(NOTATION_SEVERITY))
        expect(
          definition.problems[kind as keyof typeof NOTATION_SEVERITY].severity,
          kind,
        ).to.equal(severity);
      expect(definition.problems.notAChild.message).to.equal(NOT_A_CHILD);
      expect(definition.problems.missingFromNotation.message).to.equal(
        MISSING_FROM_NOTATION,
      );
      expect(definition.problems.notInDiagram.message).to.equal(NOT_IN_DIAGRAM);
    });
  }
});

describe('harness 4: inspector specs', () => {
  const checks = edgeCheckRegistry as Record<string, Check>;
  const engines = [
    { key: 'edge', definition: edge, models: EDGE_MODELS, grammar: 'edge' },
    {
      key: 'edgev2',
      definition: edgeV2,
      models: EDGE_V2_MODELS,
      grammar: 'edgeV2',
    },
  ] as const;
  // the element's properties, and variants flipping what conditions read
  const variants = (properties: Record<string, string>) => [
    properties,
    { ...properties, type: 'int' },
    { ...properties, type: 'bool' },
    { ...properties, type: 'maintain' },
    { ...properties, type: '' },
    {},
  ];

  for (const { key, definition, models: list, grammar } of engines) {
    it(`${key}: specsFromDefinition equals PROPERTY_SPECS on every node of every model`, () => {
      const derived = specsFromDefinition(definition, checks);
      let compared = 0;
      for (const { file, model } of list) {
        const tree = view(model, grammar);
        const kindOf = (id: string) => {
          const kind = tree.nodes.get(id)?.kind;
          return kind === 'quality' ? undefined : kind;
        };
        for (const node of tree.nodes.values()) {
          const kind = node.kind as ElementKind;
          const ours = derived[kind];
          const theirs = PROPERTY_SPECS[key][kind];
          const where = `${file} ${node.id}`;
          expect(
            ours.map((s) => s.key),
            where,
          ).to.deep.equal(theirs.map((s) => s.key));
          for (const [i, spec] of theirs.entries()) {
            const mine = ours[i]!;
            for (const properties of variants(node.properties)) {
              const at = `${where} ${spec.key} ${JSON.stringify(properties)}`;
              expect(inputOf(mine, properties), at).to.deep.equal(
                referenceInputOf(spec, properties),
              );
              expect(mine.applies?.(properties) ?? true, at).to.equal(
                spec.applies?.(properties) ?? true,
              );
              expect(mine.required?.(properties) ?? false, at).to.equal(
                spec.required?.(properties) ?? false,
              );
              expect(mine.notApplying?.(properties), at).to.equal(
                spec.notApplying?.(properties),
              );
              expect(!!mine.validate, at).to.equal(!!spec.validate);
              const context = { self: node.id, kindOf };
              expect(mine.validate?.(properties, context), at).to.equal(
                spec.validate?.(properties, context),
              );
              compared++;
            }
          }
        }
      }
      expect(compared).to.be.greaterThan(1000);
    });
  }
});

/** Scripted modifications of a document: each a function of its lines. */
const MODIFICATIONS: Array<{
  name: string;
  edit: (lines: string[]) => string[] | null;
  /** false: being typed, it must change nothing yet */
  changes?: false;
}> = [
  {
    name: 'rename an element',
    edit: (lines) => {
      const i = lines.findIndex((l) => /^\s*G\d+: /.test(l));
      if (i < 0) return null;
      const next = [...lines];
      next[i] = next[i]!.replace(/: ([^[{]+?)(\s*[[{]|$)/, ': Renamed goal$2');
      return next;
    },
  },
  {
    name: 'change a notation',
    edit: (lines) => {
      const i = lines.findIndex((l) => /\[[^\]]*;[^\]]*\]/.test(l));
      if (i < 0) return null;
      const next = [...lines];
      next[i] = next[i]!.replace(/;/g, '#');
      return next;
    },
  },
  {
    name: 'add a property line',
    edit: (lines) => {
      const i = lines.findIndex((l) => /^\s*G\d+: /.test(l));
      if (i < 0) return null;
      const indent = /^\s*/.exec(lines[i]!)![0];
      return [
        ...lines.slice(0, i + 1),
        `${indent}  utility 7`,
        ...lines.slice(i + 1),
      ];
    },
  },
  {
    name: 'remove a property line',
    edit: (lines) => {
      const i = lines.findIndex((l) =>
        /^\s+(maintain|assertion|utility|cost|maxRetries|type) /.test(l),
      );
      return i < 0 ? null : [...lines.slice(0, i), ...lines.slice(i + 1)];
    },
  },
  {
    name: 'change a property line',
    edit: (lines) => {
      const i = lines.findIndex((l) => /^\s+(assertion|maintain) /.test(l));
      if (i < 0) return null;
      const next = [...lines];
      next[i] = `${next[i]} & true`;
      return next;
    },
  },
  {
    name: 'edit a resource declaration',
    edit: (lines) => {
      const i = lines.findIndex((l) => /\{[^}]*\}\s*$/.test(l));
      if (i < 0) return null;
      const next = [...lines];
      next[i] = next[i]!.replace(/\{[^}]*\}\s*$/, '{int 0..9 = 4}');
      return next;
    },
  },
  {
    name: 'an unreadable line',
    changes: false,
    edit: (lines) => {
      const i = lines.findIndex((l) => /^\s+\w+ /.test(l));
      if (i < 0) return null;
      const next = [...lines];
      next[i] = `${next[i]!.replace(/\S.*/, '')}not a property`;
      return next;
    },
  },
  {
    name: 'an unreadable declaration',
    changes: false,
    edit: (lines) => {
      const i = lines.findIndex((l) => /\{[^}]*\}\s*$/.test(l));
      if (i < 0) return null;
      const next = [...lines];
      next[i] = next[i]!.replace(/\{[^}]*\}\s*$/, '{int 0..}');
      return next;
    },
  },
];

describe('harness 5: the notation document', () => {
  it('equals the reference document on every edgeV2 example', () => {
    for (const { file, model } of EDGE_V2_MODELS) {
      const tree = view(model, 'edgeV2');
      for (const definition of EDGE_V2_FAMILY)
        expect(notationDocument(definition, tree), file).to.deep.equal(
          referenceNotation.notationDocument(tree),
        );
    }
  });

  it('gives the reference edits for scripted modifications', () => {
    const exercised = new Set<string>();
    for (const { file, model } of EDGE_V2_MODELS) {
      const tree = view(model, 'edgeV2');
      const { text: doc } = notationDocument(edgeV2, tree);
      expect(
        notationEdits(edgeV2, doc, tree),
        `${file} unchanged`,
      ).to.deep.equal([]);
      for (const { name, edit, changes } of MODIFICATIONS) {
        const lines = edit(doc.split('\n'));
        if (!lines) continue;
        const modified = lines.join('\n');
        const ours = notationEdits(edgeV2, modified, tree);
        expect(ours, `${file}: ${name}`).to.deep.equal(
          referenceNotation.notationEdits(modified, tree),
        );
        if (changes === false)
          expect(ours, `${file}: ${name} changes nothing`).to.deep.equal([]);
        if (changes === false || ours.length > 0) exercised.add(name);
      }
    }
    // every modification changed something in some model
    expect(
      MODIFICATIONS.map((m) => m.name).filter((name) => !exercised.has(name)),
    ).to.deep.equal([]);
  });

  it('round-trips: doc → edits → model → doc is stable', () => {
    let roundTrips = 0;
    for (const { file, model } of EDGE_V2_MODELS) {
      const tree = view(model, 'edgeV2');
      const { text: doc } = notationDocument(edgeV2, tree);
      for (const { name, edit } of MODIFICATIONS) {
        const lines = edit(doc.split('\n'));
        if (!lines) continue;
        const edits = notationEdits(edgeV2, lines.join('\n'), tree);
        if (edits.length === 0) continue;
        const next = view(applyNotationEdits(model, edits), 'edgeV2');
        const again = notationDocument(edgeV2, next).text;
        // the model now says what the edited document said: nothing left to edit
        expect(
          notationEdits(edgeV2, again, next),
          `${file}: ${name}`,
        ).to.deep.equal([]);
        roundTrips++;
      }
    }
    expect(roundTrips).to.be.greaterThan(20);
  });
});

describe('harness 6: context', () => {
  it('contextFromView equals the reference notationContext on every example', () => {
    const variables = ['battery', 'ctx'];
    for (const { file, model } of EDGE_V2_MODELS) {
      const tree = view(model, 'edgeV2');
      expect(contextFromView(edgeV2, tree, variables), file).to.deep.equal(
        referenceNotation.notationContext(tree, variables),
      );
    }
    for (const { file, model } of EDGE_MODELS) {
      const tree = view(model, 'edge');
      expect(contextFromView(edge, tree, variables), file).to.deep.equal(
        referenceNotation.notationContext(tree, variables),
      );
    }
  });
});
