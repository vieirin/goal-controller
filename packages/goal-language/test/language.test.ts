import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, it } from 'mocha';
import { NOTATION_SYMBOLS } from '@goal-controller/dialect';
import { AstUtils, GrammarAST } from 'langium';
import { GoalGrammar } from '../src/generated/grammar.js';
import {
  ASSERTION,
  CALL_NAMES,
  EXPRESSION,
  INFIX_SYMBOLS,
  OCL_BOOLEANS,
  OCL_CONDITION_WORDS,
  OCL_KEYWORDS,
  OCL_OPERATIONS,
  OCL_OPERATORS,
  POSTFIX_SYMBOLS,
  PREFIX_SYMBOLS,
  STANDALONE_SYMBOLS,
  VALUE_TYPES,
  assertionText,
  errorText,
  expressionText,
  parseDocument,
  parseElementLine,
  parseElementLineIn,
  parseValue,
  readAssertion,
  readExpression,
  rtText,
  type ExpressionTree,
  type RtTree,
} from '../src/index.js';

const PACKAGE = resolve(import.meta.dirname, '..');

describe("the dialect package's copy of the operator catalog", () => {
  it('lists the symbols the catalog has, by form (what `notation()` completes)', () =>
    assert.deepEqual(NOTATION_SYMBOLS, {
      infix: INFIX_SYMBOLS,
      prefix: PREFIX_SYMBOLS,
      postfix: POSTFIX_SYMBOLS,
      calls: CALL_NAMES,
      standalone: STANDALONE_SYMBOLS,
    }));
});

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
    case 'call':
      return `${tree.name}(${tree.args.map(grouped).join(',')})`;
    default:
      return rtText(tree);
  }
};

describe('the grammar and the catalog', () => {
  it('binds the binary operators as the catalog lists them, tightest first', () => {
    // `,`, the loosest, is read by RtExpr itself (a call's commas are not it)
    assert.deepEqual(
      [...infix('RtBinary'), keywords('RtExpr')],
      INFIX_SYMBOLS.map((s) => [s]),
    );
    assert.deepEqual(
      infix('AssertBinary'),
      ASSERTION.infix.map((s) => [s]),
    );
    assert.deepEqual(infix('ExprBinary'), EXPRESSION.infix);
  });

  it('has the expression language’s negation, parentheses and separator', () => {
    assert.deepEqual(keywords('ExprUnary'), [...EXPRESSION.prefix]);
    assert.deepEqual(
      [...new Set(keywords('ExprPrimary'))],
      [...EXPRESSION.parens, EXPRESSION.separator, EXPRESSION.member],
    );
  });

  it('has the catalog’s prefix, postfix and standalone symbols', () => {
    assert.deepEqual(keywords('RtPrefix'), [...PREFIX_SYMBOLS]);
    assert.ok(POSTFIX_SYMBOLS.every((s) => keywords('RtPostfix').includes(s)));
    const primary = keywords('RtPrimary');
    for (const symbol of STANDALONE_SYMBOLS)
      assert.ok(primary.includes(symbol));
    for (const name of CALL_NAMES) assert.ok(primary.includes(name));
  });

  it('reads every value type with a rule of its own', () => {
    for (const type of VALUE_TYPES)
      assert.doesNotThrow(() => parseValue(type, ''));
  });

  it('keeps goal.langium’s OCL vocabulary (OclKeyword, OclPart) in sync with the catalog (#172)', () => {
    assert.deepEqual(
      new Set(keywords('OclKeyword')),
      new Set([
        ...OCL_OPERATIONS.map((operation) => operation.name),
        ...OCL_KEYWORDS,
        ...OCL_CONDITION_WORDS,
        ...OCL_BOOLEANS,
      ]),
    );
    assert.deepEqual(new Set(keywords('OclPart')), new Set(OCL_OPERATORS));
  });

  it('reads `!=` in an ocl value as a token, a synonym of `<>` (#172)', () => {
    const { errors } = parseValue('ocl', 'r.x != 0');
    assert.deepEqual(errors.map(errorText), []);
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

  it('reads a call’s operands between its commas, which are not `,`', () => {
    assert.equal(
      grouped(notation('G1;FALLBACK(G2#G3,AT1;G4)')),
      '(G1;FALLBACK((G2#G3),(AT1;G4)))',
    );
    assert.deepEqual(notation('FALLBACK(G2,G3)'), {
      kind: 'call',
      name: 'FALLBACK',
      args: [
        { kind: 'ref', id: 'G2' },
        { kind: 'ref', id: 'G3' },
      ],
    });
    // a comma outside a call is still the operator, loosest of all
    assert.equal(grouped(notation('G1;G2,G3')), '((G1;G2),G3)');
    assert.equal(
      rtText(notation('FALLBACK(G2,[G3,G4])')),
      'FALLBACK(G2,[G3,G4])',
    );
  });

  it('reads groups, skip, standalone symbols and every id form', () => {
    assert.equal(
      grouped(notation('(G2|G3)#[G4;skip]')),
      '(((G2|G3))#[(G4;skip)])',
    );
    for (const symbol of STANDALONE_SYMBOLS)
      assert.deepEqual(notation(symbol), { kind: 'standalone', symbol });
    assert.equal(
      rtText(notation('G1a;T1.2;T1.3X;G2X;R4;AT3')),
      'G1a;T1.2;T1.3X;G2X;R4;AT3',
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
        cost: null,
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

describe('a leaf cost bracket (#231)', () => {
  const costOf = (bracket: string) => parseElementLine(`T1: Do ${bracket}`);
  it('reads a constant, a constant times a variable, a variable', () => {
    assert.deepEqual(costOf('[W = 0.1x]').value?.cost, {
      value: '0.1',
      variable: 'x',
    });
    assert.deepEqual(costOf('[W = 2]').value?.cost, {
      value: '2',
      variable: null,
    });
    assert.deepEqual(costOf('[W = x]').value?.cost, {
      value: null,
      variable: 'x',
    });
  });

  it('reads no cost from a bracket it cannot read whole, the error saying why', () => {
    for (const bracket of ['[W = -1]', '[W = .5]', '[W = 1e3]', '[W = ]']) {
      const { value, errors } = costOf(bracket);
      assert.equal(value?.cost, null, bracket);
      assert.ok(errors.length > 0, bracket);
      // the rest of the line is read
      assert.equal(value?.id, 'T1', bracket);
    }
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

  it('reads MutRoSe’s task ids (`AT1`) as ids, a line starting with one as an element', () => {
    const read = parseDocument(
      'G1: Deliver [AT1;G2]\n  AT1: ApproachNurse\n  Params current_nurse\n',
    );
    assert.deepEqual(read.errors, []);
    assert.deepEqual(
      read.value.map((line) =>
        line.kind === 'element'
          ? [line.id, rtText(line.notation)]
          : [line.key, line.value],
      ),
      [
        ['G1', 'AT1;G2'],
        ['AT1', ''],
        ['Params', 'current_nurse'],
      ],
    );
    assert.deepEqual(parseValue('refList', 'AT1, G2').value, ['AT1', 'G2']);
    // a word that starts with the letters is still a name
    assert.equal(parseElementLine('G1: ATtend it').value?.name, ' ATtend it');
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
  it('reads an assertion: ! before & before |, zero is an int', () => {
    assert.deepEqual(parseValue('assertion', 'x > 0 & !y = true | z'), {
      value: {
        kind: 'or',
        left: {
          kind: 'and',
          left: { kind: 'compare', variable: 'x', operator: '>', value: '0' },
          right: {
            kind: 'not',
            expr: { kind: 'assign', variable: 'y', value: true },
          },
        },
        right: { kind: 'var', variable: 'z' },
      },
      errors: [],
    });
  });

  it('reads ! as negating the operand it precedes, and a group when it precedes one', () => {
    assert.deepEqual(readAssertion('!C13 | C12'), {
      kind: 'or',
      left: { kind: 'not', expr: { kind: 'var', variable: 'C13' } },
      right: { kind: 'var', variable: 'C12' },
    });
    assert.deepEqual(readAssertion('!(a | b)'), {
      kind: 'not',
      expr: {
        kind: 'paren',
        expr: {
          kind: 'or',
          left: { kind: 'var', variable: 'a' },
          right: { kind: 'var', variable: 'b' },
        },
      },
    });
    assert.deepEqual(readAssertion('!!a & b'), {
      kind: 'and',
      left: {
        kind: 'not',
        expr: { kind: 'not', expr: { kind: 'var', variable: 'a' } },
      },
      right: { kind: 'var', variable: 'b' },
    });
  });

  it('reads a dotted id of any prefix as one name (F7.1, ST1.2), and G3.1 as before', () => {
    assert.deepEqual(readAssertion('F7.1 & !ST1.2'), {
      kind: 'and',
      left: { kind: 'var', variable: 'F7.1' },
      right: { kind: 'not', expr: { kind: 'var', variable: 'ST1.2' } },
    });
    assert.deepEqual(readAssertion('G3.1 | T1.2X'), {
      kind: 'or',
      left: { kind: 'var', variable: 'G3.1' },
      right: { kind: 'var', variable: 'T1.2X' },
    });
    assert.deepEqual(readAssertion('room.clean'), {
      kind: 'member',
      ref: 'room',
      member: 'clean',
    });
    assert.equal(
      assertionText(parseValue('assertion', 'F7.1 & !ST1.2').value),
      'F7.1 & !ST1.2',
    );
  });

  it('reads each predefined type', () => {
    assert.deepEqual(parseValue('int', '-3').value, -3);
    assert.deepEqual(parseValue('number', '1.5').value, 1.5);
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
    assert.deepEqual(
      parseValue('ocl', 'rooms->forAll(r | r.clean <> False)').value,
      [
        'rooms',
        '->',
        'forAll',
        '(',
        'r',
        '|',
        'r',
        '.',
        'clean',
        '<>',
        'False',
        ')',
      ],
    );
    // `index` is a name, not `in` and `dex`; `?` is no OCL token
    assert.deepEqual(parseValue('ocl', 'index').value, ['index']);
    assert.equal(parseValue('ocl', 'a ? b').errors.length, 1);
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

describe('an id is one lexical unit (#186)', () => {
  const messages = (read: { errors: { message: string }[] }) =>
    read.errors.map((error) => error.message);

  it('rejects a space inside an id, not read across it', () => {
    assert.deepEqual(messages(parseValue('refList', 'G 1')), [
      "an id has no spaces: 'G1', not 'G 1'",
    ]);
    assert.deepEqual(messages(parseValue('refList', 'T 1.2')), [
      "an id has no spaces: 'T1.2', not 'T 1.2'",
    ]);
    assert.deepEqual(messages(parseValue('refList', 'G1 X')), [
      "an id has no spaces: 'G1X', not 'G1 X'",
    ]);
    assert.equal(parseValue('refList', 'G X').errors.length, 1);
    assert.equal(parseValue('refList', 'G 1a').errors.length, 1);
  });

  it('points at the gap', () => {
    const [error] = parseValue('refList', 'G2, T  3').errors;
    assert.deepEqual(
      { column: error?.column, offset: error?.offset, length: error?.length },
      { column: 5, offset: 5, length: 2 },
    );
  });

  it('keeps spaces around the separators', () => {
    assert.deepEqual(parseValue('refList', 'G1 ,G2'), {
      value: ['G1', 'G2'],
      errors: [],
    });
    assert.deepEqual(parseValue('refList', ' T1.2X , R3 ').errors, []);
  });

  it('rejects a gap in a notation where spaces or tabs are skipped', () => {
    assert.equal(parseElementLine('G1: Name [G\t2;G3]').errors.length, 1);
    assert.equal(
      parseValue('annotatedName', '<<s>> Name [G 2;G3]').errors.length,
      1,
    );
  });

  it('reads a dialect’s own prefix that starts with another of its own (`AS1` beside `A1`, #194)', () => {
    const dialect = {
      elements: {
        'toy.Actor': { prefix: 'A' },
        'toy.Assembly': { prefix: 'AS' },
        'toy.Orb': { prefix: 'O' },
        'toy.Operation': { prefix: 'OP' },
      },
    };
    for (const line of ['A1: Ann', 'AS1: Rig', 'O1: Ball', 'OP2: Spin']) {
      const read = parseElementLineIn(dialect, line);
      assert.deepEqual(read.errors, [], line);
      assert.equal(read.value?.id, line.slice(0, line.indexOf(':')), line);
    }
  });

  it("still reads GODA's bracket without its spaces", () => {
    const read = parseElementLineIn(
      { notation: { whitespace: 'ignore' } },
      'T1: Name [D M(T1.1 2)]',
    );
    assert.deepEqual(read.errors, []);
    assert.equal(read.value?.notation?.text(), 'DM(T1.12)');
  });
});

/** an expression with its groups made explicit: `((a+b)*c)` */
const groupedExpression = (tree: ExpressionTree | null): string => {
  switch (tree?.kind) {
    case 'binary':
      return `(${groupedExpression(tree.left)}${tree.operator}${groupedExpression(tree.right)})`;
    case 'unary':
      return `${tree.operator}${groupedExpression(tree.expr)}`;
    case 'call':
      return `${tree.name}(${tree.args.map(groupedExpression).join(',')})`;
    default:
      return tree ? expressionText(tree) : '';
  }
};

describe('expressions', () => {
  const read = (text: string) => {
    const parsed = parseValue('expression', text);
    assert.deepEqual(parsed.errors.map(errorText), [], text);
    return parsed.value;
  };

  it('binds * and / before + and -, each left-associative, a negation tightest', () => {
    for (const [text, grouped] of [
      ['a + b * c', '(a+(b*c))'],
      ['a - b - c', '((a-b)-c)'],
      ['a / b * c', '((a/b)*c)'],
      ['(a - b) * c', '((a-b)*c)'],
      ['-a * b', '(-a*b)'],
      ['- -a', '--a'],
      ['-(a + b)', '-(a+b)'],
      ['f(a, b + 1) - g()', '(f(a,(b+1))-g())'],
    ])
      assert.equal(groupedExpression(read(text!)), grouped, text);
  });

  it('reads numbers, ids, variables and calls (readExpression)', () => {
    assert.deepEqual(readExpression('0.5 + 0.9 * previous(T2.1) - -x'), {
      kind: 'binary',
      operator: '-',
      left: {
        kind: 'binary',
        operator: '+',
        left: { kind: 'number', value: '0.5' },
        right: {
          kind: 'binary',
          operator: '*',
          left: { kind: 'number', value: '0.9' },
          right: {
            kind: 'call',
            name: 'previous',
            args: [{ kind: 'ref', id: 'T2.1' }],
          },
        },
      },
      right: { kind: 'unary', operator: '-', expr: { kind: 'var', name: 'x' } },
    });
    // an id is an element's, a longer name a variable
    assert.deepEqual(readExpression('R1'), { kind: 'ref', id: 'R1' });
    assert.deepEqual(readExpression('GX'), { kind: 'ref', id: 'GX' });
    assert.deepEqual(readExpression('Rate'), { kind: 'var', name: 'Rate' });
    assert.deepEqual(readExpression('G1a'), { kind: 'var', name: 'G1a' });
    assert.equal(readExpression(''), null);
    assert.equal(readExpression('a +'), null);
  });

  it('prints with the parentheses its shape needs, and reads back the same', () => {
    for (const [text, printed] of [
      ['(a)*((b))', 'a * b'],
      ['a-(b-c)', 'a - (b - c)'],
      ['(a-b)-c', 'a - b - c'],
      ['a*(b+c)', 'a * (b + c)'],
      ['-(a*b)', '-(a * b)'],
      ['f( G1 ,2.50)', 'f(G1, 2.50)'],
    ]) {
      const tree = read(text!);
      assert.equal(expressionText(tree!), printed, text);
      assert.deepEqual(read(printed!), tree, printed);
    }
  });

  it('reports what is not an expression', () => {
    for (const text of ['a +', '(a', 'f(a,)', 'a b', 'a > 1', 'x = true'])
      assert.ok(parseValue('expression', text).errors.length, text);
  });
});

describe('assertions with expressions', () => {
  it('reads every assertion as before: a name and a number is a compare', () => {
    for (const text of [
      'x > 0 & !y = true | z',
      'R1 >= 2.5',
      '(a < 3) | b != false',
    ])
      assert.equal(assertionText(parseValue('assertion', text).value), text);
    assert.deepEqual(parseValue('assertion', 'R1 >= 2.5').value, {
      kind: 'compare',
      variable: 'R1',
      operator: '>=',
      value: '2.5',
    });
  });

  it('compares expressions: calls and arithmetic on either side', () => {
    const text = 'previous(t) < 18 & 0.9 * x >= 1 + y';
    const read = parseValue('assertion', text);
    assert.deepEqual(read.errors, []);
    assert.equal(assertionText(read.value), text);
    assert.deepEqual(read.value, {
      kind: 'and',
      left: {
        kind: 'comparison',
        operator: '<',
        left: {
          kind: 'call',
          name: 'previous',
          args: [{ kind: 'var', name: 't' }],
        },
        right: { kind: 'number', value: '18' },
      },
      right: {
        kind: 'comparison',
        operator: '>=',
        left: {
          kind: 'binary',
          operator: '*',
          left: { kind: 'number', value: '0.9' },
          right: { kind: 'var', name: 'x' },
        },
        right: {
          kind: 'binary',
          operator: '+',
          left: { kind: 'number', value: '1' },
          right: { kind: 'var', name: 'y' },
        },
      },
    });
    // a parenthesis groups an expression, or a condition, as what follows says
    assert.equal(
      assertionText(parseValue('assertion', '(x + 1) * 2 > 3 & (a | b)').value),
      '(x + 1) * 2 > 3 & (a | b)',
    );
  });

  it('gives every comparison’s sides as expressions (readAssertion)', () => {
    assert.deepEqual(readAssertion('assertion trigger x > 3 & on'), {
      kind: 'and',
      left: {
        kind: 'comparison',
        operator: '>',
        left: { kind: 'var', name: 'x' },
        right: { kind: 'number', value: '3' },
      },
      right: { kind: 'var', variable: 'on' },
    });
    assert.deepEqual(readAssertion('G1 = 2'), {
      kind: 'comparison',
      operator: '=',
      left: { kind: 'ref', id: 'G1' },
      right: { kind: 'number', value: '2' },
    });
    assert.equal(readAssertion('x >'), null);
  });

  it('reads a call as a condition on its own, and a comparison of one as before', () => {
    const text = 'previous(hvacOn) & !signalOffS | signalOnS';
    assert.deepEqual(readAssertion(text), {
      kind: 'or',
      left: {
        kind: 'and',
        left: {
          kind: 'call',
          name: 'previous',
          args: [{ kind: 'var', name: 'hvacOn' }],
        },
        right: { kind: 'not', expr: { kind: 'var', variable: 'signalOffS' } },
      },
      right: { kind: 'var', variable: 'signalOnS' },
    });
    assert.equal(assertionText(parseValue('assertion', text).value), text);
    assert.equal(readAssertion('(previous(on)) | f(G1, 2)')?.kind, 'or');
    assert.equal(readAssertion('previous(t) < 18')?.kind, 'comparison');
  });
});
