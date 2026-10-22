# Web-banking anti-model (ICSE'04)

A. van Lamsweerde. *Elaborating security requirements by construction of
intentional anti-models*. Proc. ICSE'04: 26th International Conference on
Software Engineering, Edinburgh, ACM-IEEE, May 2004, pp. 148-157
([doi:10.1109/ICSE.2004.1317437](https://doi.org/10.1109/ICSE.2004.1317437)),
§2, §3 and §6's case study: a web-based banking system, and the Thief
agent's anti-goal tree towards learning an account number and matching PIN
(goal-controller#212, #196, #189).

## Where it comes from

No machine-readable model of this example exists (van Lamsweerde's own
site publishes the paper's PDF, not a `.kaos`). `ebanking.kaos` is
re-keyed structurally from the paper's own figures and running text, in
KAOSTools' syntax:

- **the primal model**: §2 and §3's instantiated confidentiality goal,
  `Avoid [AccountNumber&PinKnownByUnauthorized]`, and its countermeasures
  (§5, §6): two new `Avoid [Vulnerability]` goals, each `resolvedby` the
  vulnerability it prevents;
- **the anti-model**: Fig. 3's anti-goal tree in full — `Thief`, a
  `malicious` agent (§4; the paper also elicits `Hacker` and
  `BankQualityAssuranceTeam` at Table 1 step 2, not elaborated further
  "for lack of space", so neither is here), and every anti-goal from the
  root `MoneyStolenFromBankAccounts` down. Fig. 3 marks several branches
  `...`; §6's running text gives their leaf anti-requirements
  (`PinCheckedForAccountNumberMatch`, `CheckIteratedOnOtherPinsIfNoMatch`,
  and the symmetric pair) and vulnerabilities
  (`RepeatablePinCheckFromAccountNumber`,
  `RepeatableAccountNumberCheckFromPin`), so both symmetric branches are
  built out, not only the one the figure expands.

## The anti-model → obstacle mapping (#196 D2, logged on #189)

An anti-goal rides on the obstacle machinery (`kaosObstacles.Obstacle`),
not a new kind: every node of the anti-goal tree is an obstacle whose
`Category` is `AntiGoal` (a value added to the dialect's existing
`ObstacleCategory` vocabulary — the smaller of the two changes
considered, the other being a parallel `AntiGoal` kind). A terminal
anti-goal is told apart as an **anti-requirement** (assigned to the
attacker, `Thief`) or a **vulnerability** (assigned to the attackee,
`banking_system`) by its `kaos.ResponsibilityAssignment`, extended here to
an obstacle source — the same link goals already use, read the same way
`kaosdoc`'s "Requirements and expectations" table already tells a
requirement from an expectation. `kaosdoc`'s new "Threats" section lists
every anti-goal this way; `kaosprop` and every other KAOS engine read the
model unchanged (none inspects `Category` or looks at an obstacle's
responsible agent).

## The epistemic operators (§2, goal-controller#212)

The confidentiality goal's `FormalSpec` and the anti-model's initial
anti-goal both use `KnowsV` (ICSE'04's "knows value": `KnowsV ag (v) ≡
∃x : Knows ag (x = v)`), parsed by goal-language's `src/ltl/` (#211) as a
`Knows` node (`asValue: true`). `Knows` and `Belief` are the same
machinery without the value form. Neither surface's `agent[...]`
subscript spelling is attested anywhere (the paper's own PDF-to-text
extraction prints the subscript with inconsistent spacing); it is this
project's own choice, documented in `packages/dialect/docs/frameworks.md`
and `packages/goal-language/src/ltl/ast.ts`'s `Knows` doc.

## No numeric oracle

§4's open issues list probabilistic obstacle/anti-goal reasoning as future
work the paper doesn't do; there is nothing to propagate. The oracle is
qualitative: the paper's anti-model tree, reproduced structurally (Fig. 3,
with the two symmetric branches both built out) — checked by
`stress:kaos`'s import/validate/roundtrip/analyses, and by
`packages/lib/test/engines/kaosdoc/kaosdoc.test.ts`'s and
`packages/lib/test/importers/kaos.test.ts`'s own tests against this model
and smaller ones.
