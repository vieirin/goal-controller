/**
 * HDDL's grammar (src/engines/mutrose/hddl/hddl.langium) on the domains the
 * definition pool reads: medicine-delivery's, and one with what a domain
 * may also write (constants, functions, quantifiers, numeric effects,
 * labelled subtasks, an ordering, comments, names in any case); and
 * MutRoSe's hddl declaration on the pool, a domain on its own.
 */
import { expect } from 'chai';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  AstUtils,
  createDefaultCoreModule,
  createDefaultSharedCoreModule,
  EmptyFileSystem,
  inject,
  type AstNode,
} from 'langium';
import { createPool } from '../../../src/engines/definitionPool';
import { mutrosePool } from '../../../src/engines/mutrose/pool';
import {
  HddlGeneratedModule,
  HddlGeneratedSharedModule,
} from '../../../src/engines/mutrose/hddl/generated/module';

const shared = inject(
  createDefaultSharedCoreModule(EmptyFileSystem),
  HddlGeneratedSharedModule,
);
const { parser } = inject(
  createDefaultCoreModule({ shared }),
  HddlGeneratedModule,
);

const MEDICINE = readFileSync(
  join(
    __dirname,
    '../../../../../examples/projects/medicine-delivery/hddl/domain.hddl',
  ),
  'utf8',
);

const STRESS = `; a domain with what medicine-delivery doesn't write
(DEFINE (domain stress)
  (:requirements :typing :hierarchy :negative-preconditions)
  (:types room nurse - location location robot - object)
  (:constants hall - room)
  (:predicates (at ?b - robot ?l - location) (clean ?r) (Busy))
  (:functions (objects ?r - room) - number (battery))
  (:task Deliver :parameters (?r - room ?n - nurse))
  (:task idle)
  (:method m-deliver
    :parameters (?b - robot ?r - room ?n - nurse)
    :task (deliver ?r ?n)
    :precondition (and (not (at ?b ?r)) (forall (?x - room) (clean ?x))
      (exists (?b - robot) (at ?b hall)) (> (objects ?r) 0) (= ?r ?r))
    :ordered-subtasks (and (task0 (move ?b ?r)) (idle))
    :ordering (and (< task0 task1)))
  (:method m-idle :parameters () :task (idle) :subtasks ())
  (:action move :parameters (?b - robot ?l - location)
    :precondition ()
    :effect (and (at ?b ?l) (not (busy)) (increase (battery) 1)
      (when (clean ?l) (busy)) (decrease (objects ?l) 2.5)))
)`;

const parsed = (text: string) => {
  const result = parser.LangiumParser.parse(text);
  const nodes = AstUtils.streamAst(result.value).toArray();
  return {
    errors: [...result.lexerErrors, ...result.parserErrors].map(
      (e) => e.message,
    ),
    defined: nodes
      .filter(
        (n): n is AstNode & { name: string } =>
          typeof (n as { name?: unknown }).name === 'string' &&
          n.$type !== 'ConstantRef' &&
          n.$type !== 'Domain',
      )
      .map((n) => `${n.$type} ${n.name}`),
    referred: nodes
      .flatMap((n) => AstUtils.streamReferences(n).toArray())
      .map((r) => `${r.container.$type}.${r.property} ${r.reference.$refText}`),
  };
};

describe('HDDL’s grammar', () => {
  it('reads medicine-delivery’s domain: its definitions and what refers to them', () => {
    const { errors, defined, referred } = parsed(MEDICINE);
    expect(errors).to.deep.equal([]);
    expect(defined.filter((d) => !d.startsWith('Parameter'))).to.deep.equal([
      'TypeDecl location',
      'TypeDecl request',
      'TypeDecl robot',
      'Predicate at',
      'Predicate served',
      'Task navigateto',
      'Task handover',
      'Task notifynurse',
      'Method m-navigateto',
      'Method m-handover',
      'Method m-notifynurse',
      'Action move',
      'Action give',
      'Action call-nurse',
    ]);
    expect(referred).to.include.members([
      'Method.task navigateto',
      'SubtaskBody.task move',
      'Atomic.predicate served',
      'VariableRef.variable ?l',
      'TypeRef.type robot',
    ]);
  });

  it('reads the rest of a domain, in any case', () => {
    const { errors, defined, referred } = parsed(STRESS);
    expect(errors).to.deep.equal([]);
    expect(defined).to.include.members([
      'Constant hall',
      'FunctionDecl objects',
      'FunctionDecl battery',
      'Task Deliver',
      // a quantifier's variables
      'Parameter ?x',
    ]);
    expect(referred).to.include.members([
      'Method.task deliver',
      'FunctionTerm.function objects',
      'FunctionTerm.function battery',
      'Atomic.predicate busy',
      // a labelled subtask, and one without a label
      'SubtaskBody.task move',
      'SubtaskBody.task idle',
    ]);
  });

  it('reports what isn’t HDDL', () => {
    expect(parsed('(define (domain d) (:task))').errors).to.have.length.above(
      0,
    );
    expect(
      parsed('(define (domain d) (:types a - ))').errors,
    ).to.have.length.above(0);
  });
});

describe('MutRoSe’s HDDL declaration, a domain on its own', () => {
  const DOMAIN = `(define (domain toys)
  (:types box - object)
  (:task pack :parameters (?b - box))
  (:method m-pack :parameters (?b - box)
    :task (pack ?b)
    :ordered-subtasks (and (seal ?b)))
  (:action seal :parameters (?b - box)))
`;
  const indexOf = (text: string) =>
    createPool(mutrosePool).update([{ id: 'd.hddl', kind: 'hddl', text }]);
  /** where the nth `word` is */
  const at = (text: string, word: string, nth = 0) => {
    let from = -1;
    for (let i = 0; i <= nth; i += 1) from = text.indexOf(word, from + 1);
    return from;
  };

  it('defines types, tasks, methods, actions and their parameters, and resolves their uses', () => {
    const index = indexOf(DOMAIN);
    expect(index.diagnostics).to.deep.equal([]);
    expect(
      index.definitions.map((d) => `${d.kind} ${d.name}`).sort(),
    ).to.deep.equal(
      [
        'hddl.type box',
        'hddl.task pack',
        'hddl.param ?b',
        'hddl.method m-pack',
        'hddl.param ?b',
        'hddl.action seal',
        'hddl.param ?b',
      ].sort(),
    );
    expect(index.references().filter((r) => !index.target(r))).to.deep.equal(
      [],
    );
    // a method's ?b is its own, not its task's: its :task's and its subtask's
    const methodParam = index.definitions.find(
      (d) => d.kind === 'hddl.param' && d.location.from === at(DOMAIN, '?b', 1),
    )!;
    expect(
      index
        .referencesTo(methodParam.id)
        .map((r) => r.location.from)
        .sort((a, b) => a - b),
    ).to.deep.equal([at(DOMAIN, '?b', 2), at(DOMAIN, '?b', 3)]);
  });

  it('declares a type by its first use (MutRoSe’s domains use `robot` so)', () => {
    const text =
      '(define (domain d) (:task go :parameters (?r - robot)) (:task stay :parameters (?q - robot)))';
    const index = indexOf(text);
    expect(index.diagnostics).to.deep.equal([]);
    expect(
      index.definitionsOf('hddl.type').map((d) => [d.name, d.location.from]),
    ).to.deep.equal([['robot', text.indexOf('robot')]]);
  });

  it('a quantifier’s variable hides its operation’s parameter of the same name', () => {
    const text = `(define (domain d)
  (:types box)
  (:predicates (sealed ?b - box))
  (:action seal :parameters (?b - box)
    :precondition (forall (?b - box) (sealed ?b))
    :effect (sealed ?b)))`;
    const index = indexOf(text);
    expect(index.diagnostics).to.deep.equal([]);
    const definitionOf = (nth: number) =>
      index.target(
        index
          .references()
          .find((r) => r.location.from === at(text, '?b', nth))!,
      )?.location.from;
    // (sealed ?b) in the forall: the forall's ?b; in the effect: the action's
    expect(definitionOf(3)).to.equal(at(text, '?b', 2));
    expect(definitionOf(4)).to.equal(at(text, '?b', 1));
  });
});
