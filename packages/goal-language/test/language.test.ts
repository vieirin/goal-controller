import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, it } from 'mocha';
import { AstUtils, GrammarAST } from 'langium';
import { GoalGrammar } from '../src/generated/grammar.js';
import {
  ASSERTION,
  INFIX_SYMBOLS,
  POSTFIX_SYMBOLS,
  PREFIX_SYMBOLS,
  STANDALONE_SYMBOLS,
  VALUE_TYPES,
  errorText,
  parseDocument,
  parseElementLine,
  parseValue,
  rtText,
  type RtTree,
} from '../src/index.js';

const PACKAGE = resolve(import.meta.dirname, '..');

const rule = (name: string) => {
  const found = GoalGrammar().rules.find((r) => r.name === name);
  assert.ok(found, `no rule ${name}`);
  return found;
};
const infix = (name: string) => {
  const found = rule(name);
  assert.ok(GrammarAST.isInfixRule(found));
  return found.operators.precedences.map((p) =>
    p.operators.map((o) => o.value),
  );
};
const keywords = (name: string) =>
  AstUtils.streamAllContents(rule(name))
    .filter(GrammarAST.isKeyword)
    .map((k) => k.value)
    .toArray();

const notation = (text: string): RtTree | null => {
  const read = parseElementLine(`G1: Name [${text}]`);
  assert.deepEqual(read.errors.map(errorText), [], text);
  return read.value!.notation;
};
/** a notation with its groups made explicit by precedence: `((G2;G3)->G4)` */
const grouped = (tree: RtTree | null): string => {
  switch (tree?.kind) {
    case 'binary':
      return `(${grouped(tree.left)}${tree.operator}${grouped(tree.right)})`;
    case 'postfix':
      return `${grouped(tree.expr)}${tree.operator}${tree.argument}`;
    case 'prefix':
      return `${tree.operator}${grouped(tree.expr)}`;
    case 'group':
      return `${tree.open}${grouped(tree.expr)}${tree.open === '[' ? ']' : ')'}`;
    default:
      return rtText(tree);
  }
};

describe('the grammar and the catalog', () => {
  it('binds the binary operators as the catalog lists them, tightest first', () => {
    assert.deepEqual(
      infix('RtBinary'),
      INFIX_SYMBOLS.map((s) => [s]),
    );
    assert.deepEqual(
      infix('AssertBinary'),
      ASSERTION.infix.map((s) => [s]),
    );
  });

  it('has the catalog’s prefix, postfix and standalone symbols', () => {
    assert.deepEqual(keywords('RtPrefix'), [...PREFIX_SYMBOLS]);
    assert.ok(POSTFIX_SYMBOLS.every((s) => keywords('RtPostfix').includes(s)));
    const primary = keywords('RtPrimary');
    for (const symbol of STANDALONE_SYMBOLS)
      assert.ok(primary.includes(symbol));
  });

  it('reads every value type with a rule of its own', () => {
    for (const type of VALUE_TYPES)
      assert.doesNotThrow(() => parseValue(type, ''));
  });

  it('is generated from goal.langium as committed', () => {
    const copy = mkdtempSync(join(tmpdir(), 'goal-language-'));
    try {
      cpSync(join(PACKAGE, 'src/goal.langium'), join(copy, 'src/goal.langium'));
      cpSync(
        join(PACKAGE, 'langium-config.json'),
        join(copy, 'langium-config.json'),
      );
      execFileSync(join(PACKAGE, 'node_modules/.bin/langium'), ['generate'], {
        cwd: copy,
        stdio: 'ignore',
      });
      for (const file of ['ast.ts', 'grammar.ts', 'module.ts'])
        assert.equal(
          readFileSync(join(copy, 'src/generated', file), 'utf8'),
          readFileSync(join(PACKAGE, 'src/generated', file), 'utf8'),
          `src/generated/${file} is stale: run pnpm generate`,
        );
    } finally {
      rmSync(copy, { recursive: true, force: true });
    }
  });
});

describe('the RT notation', () => {
  it('binds each operator tighter than the next one in the catalog', () => {
    for (let i = 0; i + 1 < INFIX_SYMBOLS.length; i++) {
      const [tight, loose] = [INFIX_SYMBOLS[i], INFIX_SYMBOLS[i + 1]];
      assert.equal(
        grouped(notation(`G2${loose}G3${tight}G4`)),
        `(G2${loose}(G3${tight}G4))`,
      );
      assert.equal(
        grouped(notation(`G2${tight}G3${loose}G4`)),
        `((G2${tight}G3)${loose}G4)`,
      );
    }
  });

  it('associates every binary operator to the left', () => {
    for (const symbol of INFIX_SYMBOLS)
      assert.equal(
        grouped(notation(`G2${symbol}G3${symbol}G4`)),
        `((G2${symbol}G3)${symbol}G4)`,
      );
  });

  it('binds a postfix tightest, then a prefix', () => {
    assert.equal(grouped(notation('G2@2@3->G3')), '(G2@2@3->G3)');
    assert.equal(grouped(notation('!G2@2;G3')), '(!G2@2;G3)');
    assert.deepEqual(notation('!G2@2'), {
      kind: 'prefix',
      operator: '!',
      expr: {
        kind: 'postfix',
        operator: '@',
        argument: '2',
        expr: { kind: 'ref', id: 'G2' },
      },
    });
    assert.equal(grouped(notation('[G2;G3]@2->G4')), '([(G2;G3)]@2->G4)');
  });

  it('reads groups, skip, standalone symbols and every id form', () => {
    assert.equal(
      grouped(notation('(G2|G3)#[G4;skip]')),
      '(((G2|G3))#[(G4;skip)])',
    );
    for (const symbol of STANDALONE_SYMBOLS)
      assert.deepEqual(notation(symbol), { kind: 'standalone', symbol });
    assert.equal(
      rtText(notation('G1a;T1.2;T1.3X;G2X;R4')),
      'G1a;T1.2;T1.3X;G2X;R4',
    );
  });
});

describe('element lines', () => {
  it('reads the id, the name as written, the notation and the declaration', () => {
    assert.deepEqual(parseElementLine('R1: Battery {int 0..100 = 80}'), {
      value: {
        id: 'R1',
        name: ' Battery ',
        annotations: [],
        notation: null,
        declaration: {
          type: 'int',
          lowerBound: '0',
          upperBound: '100',
          initialValue: '80',
        },
      },
      errors: [],
    });
    assert.deepEqual(
      parseElementLine('R2: Alarm {bool = false}').value?.declaration,
      {
        type: 'bool',
        initialValue: 'false',
      },
    );
  });

  it('reads annotations before the id', () => {
    const read = parseElementLine('<<action>> {type = duty} T1: Do it [T2;T3]');
    assert.deepEqual(read.errors, []);
    assert.deepEqual(read.value?.annotations, [
      { kind: 'stereotype', stereotype: 'action' },
      { kind: 'tag', tag: 'type', tagValue: 'duty' },
    ]);
    assert.equal(read.value?.id, 'T1');
    assert.deepEqual(
      parseElementLine('{Id=G1}{Reference to} G1: x').value?.annotations,
      [
        { kind: 'tag', tag: 'Id', tagValue: 'G1' },
        { kind: 'tag', tag: 'Reference to' },
      ],
    );
  });

  it('reads as RTRegex.g4 did: a blank is nothing, spaces belong to the name', () => {
    assert.deepEqual(parseElementLine(''), { value: null, errors: [] });
    assert.deepEqual(parseElementLine('\t'), { value: null, errors: [] });
    // a space is part of a WORD: not allowed inside the notation, nor before the id
    assert.deepEqual(
      parseElementLine('G1: x [G2; G3]').errors.map((e) => e.column),
      [10],
    );
    assert.equal(parseElementLine(' G1: Name').errors.length, 1);
    assert.equal(parseElementLine('G1: Step 2').errors.length, 1);
    assert.deepEqual(
      parseElementLine('G1: Name [G2$G3]').errors.map(errorText)[0],
      "1:12 token recognition error at: '$'",
    );
  });
});

describe('documents', () => {
  it('reads element lines and the property lines under them', () => {
    const read = parseDocument(
      'G1: Root [G2;G3]\n  maintain battery > 0\n  dependsOn G2, G3\n  G2: A\n\nR1: B {bool = false}\n',
    );
    assert.deepEqual(read.errors, []);
    assert.deepEqual(
      read.value.map((line) =>
        line.kind === 'element'
          ? [line.line, line.id, rtText(line.notation)]
          : [line.line, line.key, line.value],
      ),
      [
        [1, 'G1', 'G2;G3'],
        [2, 'maintain', 'battery > 0'],
        [3, 'dependsOn', 'G2, G3'],
        [4, 'G2', ''],
        [6, 'R1', ''],
      ],
    );
  });

  it('reads a key alone as a property without a value', () => {
    assert.deepEqual(parseDocument('G1: Root\n  root\n').value.at(-1), {
      kind: 'property',
      line: 2,
      key: 'root',
      value: '',
    });
  });

  it('reads lines without ids: any name, with annotations', () => {
    const read = parseDocument(
      '<<goal-based>> {Id = A1} Robot: arm (1)\n  Other thing\n',
      { ids: false },
    );
    assert.deepEqual(read.errors, []);
    assert.deepEqual(
      read.value.map(
        (line) =>
          line.kind === 'element' && [line.name, line.annotations.length],
      ),
      [
        ['Robot: arm (1)', 2],
        ['Other thing', 0],
      ],
    );
  });
});

describe('values', () => {
  it('reads an assertion: & before |, ! takes the rest, zero is an int', () => {
    assert.deepEqual(parseValue('assertion', 'x > 0 & !y = true | z'), {
      value: {
        kind: 'and',
        left: { kind: 'compare', variable: 'x', operator: '>', value: '0' },
        right: {
          kind: 'not',
          expr: {
            kind: 'or',
            left: { kind: 'assign', variable: 'y', value: true },
            right: { kind: 'var', variable: 'z' },
          },
        },
      },
      errors: [],
    });
  });

  it('reads each predefined type', () => {
    assert.deepEqual(parseValue('int', '-3').value, '-3');
    assert.deepEqual(parseValue('number', '1.5').value, '1.5');
    assert.deepEqual(parseValue('bool', 'false').value, false);
    assert.deepEqual(
      parseValue('text', ' any text, here ').value,
      'any text, here',
    );
    assert.deepEqual(
      parseValue('enum', 'model-based reflex').value,
      'model-based reflex',
    );
    assert.deepEqual(parseValue('refList', 'G2, G5').value, ['G2', 'G5']);
    assert.deepEqual(parseValue('pairList', 't:9, loc:3').value, [
      { name: 't', value: '9' },
      { name: 'loc', value: '3' },
    ]);
    assert.equal(parseValue('annotatedName', '<<s>> Name').value?.name, 'Name');
  });

  it('reads an empty value as unset, and reports one of another type', () => {
    assert.deepEqual(parseValue('int', ''), { value: null, errors: [] });
    assert.deepEqual(parseValue('refList', ''), { value: [], errors: [] });
    assert.equal(parseValue('int', 'x').errors.length, 1);
    assert.equal(parseValue('bool', '1').errors.length, 1);
    assert.equal(parseValue('refList', 'G2 G3').errors.length, 1);
  });
});
