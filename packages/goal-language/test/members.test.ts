/**
 * The member atom (goal-controller#135): `ref.member` in assertions and
 * expressions, read into `{ kind: 'member', ref, member }` and printed back;
 * the dot a token of its own; ids and numbers with dots as before.
 */
import { expect } from 'chai';
import {
  assertionMembers,
  assertionText,
  expressionText,
  parseValue,
  readAssertion,
  readExpression,
} from '../src/index.js';

const member = (ref: string, name: string) => ({
  kind: 'member',
  ref,
  member: name,
});

describe('the member atom (#135)', () => {
  it('reads a member of a name or an id, in an expression', () => {
    expect(readExpression('room.level')).to.deep.equal(member('room', 'level'));
    expect(readExpression('G1.done')).to.deep.equal(member('G1', 'done'));
    // an id with dots keeps them: its member is after the last
    expect(readExpression('T1.1.done')).to.deep.equal(member('T1.1', 'done'));
    // the dot is a token: spaces around it read the same
    expect(readExpression('room . level')).to.deep.equal(
      readExpression('room.level'),
    );
  });

  it('binds tighter than everything: `-tank.level * 2` is `(-(tank.level)) * 2`', () => {
    expect(readExpression('-tank.level * 2')).to.deep.equal({
      kind: 'binary',
      operator: '*',
      left: { kind: 'unary', operator: '-', expr: member('tank', 'level') },
      right: { kind: 'number', value: '2' },
    });
    expect(readExpression('previous(tank.level)')).to.deep.equal({
      kind: 'call',
      name: 'previous',
      args: [member('tank', 'level')],
    });
  });

  it('reads a member as a condition, compared, or set', () => {
    expect(readAssertion('room.clean')).to.deep.equal(member('room', 'clean'));
    expect(readAssertion('!room.clean')).to.deep.equal({
      kind: 'not',
      expr: member('room', 'clean'),
    });
    expect(readAssertion('tank.level < 10')).to.deep.equal({
      kind: 'comparison',
      operator: '<',
      left: member('tank', 'level'),
      right: { kind: 'number', value: '10' },
    });
    expect(parseValue('assertion', 'room.clean != false').value).to.deep.equal({
      kind: 'assign',
      variable: 'room',
      member: 'clean',
      value: false,
      negated: true,
    });
  });

  it('prints a member back as it reads', () => {
    for (const text of [
      'room.clean',
      'room.clean = true',
      'tank.level < 10 & !room.clean',
      'previous(tank.level) >= T1.1.x',
    ]) {
      const read = parseValue('assertion', text);
      expect(read.errors, text).to.deep.equal([]);
      expect(assertionText(read.value)).to.equal(text);
    }
    expect(expressionText(readExpression('-tank.level * 2')!)).to.equal(
      '-tank.level * 2',
    );
  });

  it('lists the members a condition reads, in the order written', () => {
    expect(
      assertionMembers(
        readAssertion('room.clean & tank.level < 3 | door.open = true'),
      ),
    ).to.deep.equal([
      { ref: 'room', member: 'clean' },
      { ref: 'tank', member: 'level' },
      { ref: 'door', member: 'open' },
    ]);
    expect(assertionMembers(readAssertion('x > 3 & G1'))).to.deep.equal([]);
  });

  it('leaves conditions without members as they were', () => {
    expect(parseValue('assertion', 'x > 0.5').value).to.deep.equal({
      kind: 'compare',
      variable: 'x',
      operator: '>',
      value: '0.5',
    });
    expect(parseValue('assertion', 'T1.1 > 2').value).to.deep.equal({
      kind: 'compare',
      variable: 'T1.1',
      operator: '>',
      value: '2',
    });
    expect(parseValue('assertion', 'ctx = true').value).to.deep.equal({
      kind: 'assign',
      variable: 'ctx',
      value: true,
    });
    // a member takes a name: `room.` and `room.1` are errors
    expect(parseValue('assertion', 'room.').errors).to.have.length.above(0);
    expect(parseValue('expression', 'room.1').errors).to.have.length.above(0);
  });
});
