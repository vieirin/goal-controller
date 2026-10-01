import * as assert from 'assert';
import { describe, it } from 'mocha';
import { __test_only_exports__ } from '../../../../../../src/engines/edge/template/modules/system/system';

const { extractOldSystemTransitions } = __test_only_exports__;

const prismWithSystemModule = `dtmc

module Goal_G1
  [pursue_G1] true -> true;
endmodule

module ChangeManager
  [try_T1] true -> true;
endmodule

module System
  // sets inFlight when T3 is achieved
  [achieved_T3] true -> (inFlight'=true);
  [achieved_T4] true -> (commLink'=true);
  [achieved_T7] true -> (missionReady'=true);
  [achieved_T6] true -> (R0'=max(0, R0-2));
endmodule
`;

describe('extractOldSystemTransitions', () => {
  it('extracts every transition from the System module', () => {
    const transitions = extractOldSystemTransitions(prismWithSystemModule);

    // 4 transitions, plus the comment line preceding [achieved_T3]
    assert.strictEqual(transitions.length, 5);
    assert.ok(transitions.some((t) => t.includes('[achieved_T3]')));
    assert.ok(transitions.some((t) => t.includes('[achieved_T4]')));
    assert.ok(transitions.some((t) => t.includes('[achieved_T7]')));
    assert.ok(transitions.some((t) => t.includes('[achieved_T6]')));
    assert.ok(transitions.some((t) => t.includes("(inFlight'=true)")));
    assert.ok(transitions.some((t) => t.includes("(commLink'=true)")));
    assert.ok(transitions.some((t) => t.includes("(R0'=max(0, R0-2))")));
  });

  it('includes preceding comment lines for a transition', () => {
    const transitions = extractOldSystemTransitions(prismWithSystemModule);

    assert.ok(
      transitions.some((t) =>
        t.includes('// sets inFlight when T3 is achieved'),
      ),
      'Should keep the comment preceding a transition',
    );
  });

  it('returns an empty array when there is no System module', () => {
    const transitions = extractOldSystemTransitions(
      'dtmc\n\nmodule Goal_G1\nendmodule\n',
    );

    assert.strictEqual(transitions.length, 0);
  });

  it('returns an empty array for empty input', () => {
    assert.strictEqual(extractOldSystemTransitions('').length, 0);
  });

  it('preserves original line formatting', () => {
    const transitions = extractOldSystemTransitions(prismWithSystemModule);

    transitions
      .filter((t) => !t.trim().startsWith('//'))
      .forEach((transition) => {
        assert.ok(transition.includes('[') && transition.includes(']'));
        assert.ok(transition.includes('->'));
      });
  });

  it('only extracts transitions from the System module', () => {
    const transitions = extractOldSystemTransitions(prismWithSystemModule);

    transitions.forEach((transition) => {
      assert.ok(!transition.includes('[pursue_G'));
      assert.ok(!transition.includes('[try_T'));
    });
  });
});
