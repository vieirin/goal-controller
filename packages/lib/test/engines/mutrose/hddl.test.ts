/**
 * HDDL's grammar (src/engines/mutrose/hddl/hddl.langium) on the domains the
 * definition pool reads: medicine-delivery's, and one with what a domain
 * may also write (constants, functions, quantifiers, numeric effects,
 * labelled subtasks, an ordering, comments, names in any case).
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
