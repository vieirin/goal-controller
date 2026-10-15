# Tropos4AS: a stress test of the engine framework

Tropos4AS (Morandini, Penserini, Perini; FBK Trento, 2008–2017) extends
Tropos goal models so that an agent can run them:
- goal types, and the conditions each type evaluates;
- an environment of artifacts that the conditions read;
- inhibition and sequence between goals;
- a failure model.

Its tools (TAOM4E's Tropos4AS plug-ins, t2x's Jadex generator) are gone,
and no model file survives (goal-controller#134). So this engine is built
from the papers. It runs AAMAS 2009's goal lifecycle over a scenario, as an
analysis engine: each goal's state per step, drawn on the model. Tropos4AS is
goal-controller's sixth stress test (#136, planned on #134, where its
decisions D1–D9 are logged).

This page records:
- what the dialect reads, and from which figure;
- the lifecycle, rule by rule;
- the oracle;
- what fit as it was;
- where the framework had to grow;
- what is still open.

## What Tropos4AS reads

The sources:
- AAMAS 2009 (*Operational Semantics of Goal Models in Adaptive Agents*), §3–5 and Figs. 1–3;
- iStar 2011 (*Empirical Evaluation of Tropos4AS Modelling*), Fig. 1, the only figure of the failure model and the environment we can read.

Not read: SEAMS 2008 and REJ 2017 (paywalled), and the 2011 thesis (unreachable on 2026-10-15). The definition is `packages/lib/src/engines/tropos4as/definition.ts`.

- **iStar 2.0's kinds** for Tropos's:
  - a hard goal is a goal, a plan a task, a softgoal a quality;
  - AND/OR decomposition is iStar's refinement;
  - a means-end is an OR-refinement from the means to its end (iStar 2.0 has no means-end link);
  - contributions and dependencies are iStar's.
- **Goal types** (AAMAS §3): `type` is `achieve` (the default), `maintain` or `perform`. Fig. 1 draws them as the A, M, P badges.
- **Conditions**, assertions in the goal language over the belief base (#134 D3):
  - `creation`: root goals only, fn. 1;
  - `achievement` (s) and `failure` (f): an achieve-goal's;
  - `maintain` (m), `target` (t) and `drop` (d): a maintain-goal's, §4.3.3;
  - `precondition`: iStar 2011's `precond`, which no rule reads;
  - `onFailure`: §4.3.2's behaviour a) `restart` or b) `drop`.
  - Each applies only to the types it belongs to. iStar 2011 draws conditions as notes; here they are properties (the user's choice, #134 D8).
- **The `tropos4as` extension** (#134 D2):
  - **Kinds:**
    - `tropos4as.Artifact`: the environment; `attributes`, `name:type` pairs, the type `bool`, `int`, `number` or options `a|b`.
    - `tropos4as.Failure`: a star.
    - `tropos4as.Error`: behaves like a goal, so a means-end reaches it; its `condition` is its creation condition.
    - `tropos4as.Symptom`: no semantics; SEAMS 2008 is unread.
  - **Links:**
    - `InhibitsLink` and `SequenceLink`: goal → goal, same actor;
    - `FailureLink`: goal → failure;
    - `ErrorLink`: error → failure, as Fig. 1 draws the arrows; #136's text had it the other way round;
    - `ReadsLink`: artifact → goal or error, the dashed lines of a condition note;
    - `SymptomLink`: symptom → failure.
- **No ids.** Element texts are the figures' (`RoomClean`). Scenarios and traces name elements by their piStar ids (`RC`, `DC`, `WC`, as §5 abbreviates them).
- **Checks.**
  - Named checks (errors):
    - a perform-goal with a condition (§4.3.1, D4);
    - a target without a maintain condition;
    - an artifact's malformed attributes.
  - `tropos4asProblems`, across the model:
    - a creation condition below a root (a warning, fn. 1);
    - a maintain-goal under an achieve- or perform-goal (a warning, §4.4);
    - an inhibition or sequence cycle, or one across actors (an error);
    - a goal decomposed by AND and OR at once (an error);
    - an unreadable condition, a maintain-goal without m, an error without a condition (errors).

## The lifecycle (`engines/tropos4as/lifecycle/`)

- **The abstract architecture** (`architecture.ts`, §4.1–4.2):
  - g(C, E, s, Γ), with s ∈ {Suspended, AD, AU, AS, AF};
  - every transition rule as data with its premises, named as the paper names it: `activateC/E`, `deliberateE/C`, `AND:` and `OR:subg-achieve`, `AND:subg-fail`, `OR:subg-succeed`, `AND:subg-succeed`, `OR:subg-fail`, `cond-succeedC/E`, `cond-failC/E`, `drop-successC/E`, `drop-failureC/E`, `reactivateC/E`, `suspendC/E`, `retryC`;
  - subgoal adoption needs ¬∃⟨c, a⟩ ∈ C . B |= c ∧ a ∈ {Fail, Succeed}.
- **The instantiations** (`instantiations.ts`, §4.3): P, A(s, f) a) and b), M(m, d) and M(m, t, d), as the condition–action sets E and C, quoted in the source. In A, H's d is f ("a failure condition (or drop condition) f"). An achieve-goal without an achievement condition runs as P: it has nothing to evaluate.
- **How the rules are read (D5):**
  - The Γ = ∅ premises printed with C ([AND:subg-succeed], [OR:subg-fail], [cond-succeedE]) are read in E, as §4.1 says E is evaluated when Γ is empty. Under the printed reading, a heating goal would sit in AS below its target.
  - Precedence, in this order:
    1. the premises (failure over success; a true Fail or Succeed before adopting a subgoal);
    2. a decomposition's rule before a condition's;
    3. among condition rules, the order of the pairs that enable them (§4.2.5).
  - A rule that changes nothing doesn't fire.
  - adopt(G, γ) is atomic: the parent's conditions are evaluated again when γ returns.
- **The run** (`run.ts`), over a scenario (`scenarios/`, a project resource):
  - A step's beliefs and outcomes are B′, what pursuing the pending subgoal led to.
  - A task, or a goal the scenario gives an outcome, is executed. Any other goal runs its own lifecycle.
  - Roots are adopted when their creation condition becomes true; an error when its condition does (D7).
  - deliberate(g, B) orders Γ by sequence links. An OR goal's alternatives come most-contributing first, by the contributions of the alternatives and their means to qualities (§3.1, which the paper leaves unformalised; ours, D8).
  - A goal an active goal inhibits is skipped in Γ.
  - A dropped goal adds success(g) or failed(g) to B. A failed goal's failures occur.
- **The analysis** (`tropos4asLifecycle`): a case per scenario step, each goal's state and the rule that put it there drawn on it, failures that occurred too. A model with an error is not run. **The trace** (`traceText`): `step | goal | rule | state | Γ`, one row per rule; `stateChanges` gives a goal's rows that change its state, which is what Fig. 3 draws.

## The oracle (#134 D1)

- **AAMAS 2009 §5 / Fig. 3, exactly**: the Cleaner Agent seed under `scenarios/paper.json`. RoomClean's seven states and rules, in order, ending in success(RoomClean): `reference/trace-paper.txt`, transcribed. The full trace also lists `[OR:subg-achieve]`, WC's failure, a self-loop on AU that Fig. 3 doesn't draw.
- **Derived by hand from the rules, labelled so:**
  - the Cleaner Agent's all-fail scenario: RoomClean, A(s, f) a), restarts with `[reactivateE]`, not `[drop-failureE]` as #134 first said (D6);
  - the patient monitoring "a day";
  - heating's M(m, t, d) hysteresis (unit tests: it activates below 20, heats till 22, and is not reactivated at 21);
  - creation, inhibition, sequence, errors and behaviour b).
- **No Jadex and no t2x**: nothing to run them against.

`pnpm stress:tropos4as` runs every seed: import, checks, the analysis and each scenario's trace against its reference (`scripts/tropos4as-stress/README.md`).

## What fit as it was

- Goal types and conditions: `enum`, and `assertion` with `resolves` and `declaresVariables`, each applying to its type (`applies`).
- New kinds and links with shapes and rules: a dialect extension (#110), declared in the model's `"metamodel"` block (#106); properties on an extension's kinds (#132), in the inspector.
- A scenario beside the model: a project resource (#25), as GRL's strategies.
- Values drawn on the model per case: an analysis engine (#107), its model read through the IR (#125/#128): actors, links and dependums.
- The engine object (#124), registered in the workbench as GRL is.

## Where the framework had to grow

No engine names in the core packages: the gate (`grep -ri 'tropos\|taom4e\|jadex\|t2x\|cleaner'` over dialect, goal-language, goal-tree, lib's pool, the XMI reader and the layout) finds this page and the docs beside it only.

- **Members** (`room.clean`): blue's #137. Until it lands, conditions name bare variables (`roomClean`); then `medicineSensor.taken`, `mealSensor.meals` and `room.clean`.
- **A step series** for an analysis: blue's #137. Until then, a case per step.
- **Property lines in a dialect without ids**: #138, blue, option A (the declared keys read as tokens). Without it, the properties are the inspector's.
- **Shared by engines** (in lib, not the core):
  - an element's text read as its id and name, and `name:value` lists (`engines/elementText.ts`, from iStar-DT's model);
  - an extension's `"metamodel"` block (`engines/metamodelBlock.ts`, which GRL's and iStar-DT's were copies of).

## Still open

- **The TAOM4E importer** (#136 item 4) waits for #137's XMI reader. Its mapping from `TAOM4E-MM.ecore` is logged on #134:
  - `creationProperty`, `fulfillmentProperty` and `invariantProperty` → `creation`, `achievement` and `maintain`;
  - `mode` → `type`.
- **Proactive maintain-goals**: AAMAS 2009 formalises reactive ones only.
- **Softgoal-driven choice** among OR alternatives: the paper cites TAAS 2007 and leaves it out. The contribution order above is ours.
- **Symptoms' semantics, preconditions**: drawn, not run.
- **t2x's Jadex output**: no reference exists.
- **The Tropos4AS metamodel attributes TAOM4E wrote**: in REJ 2017's figures only.
- **SEAMS 2008, REJ 2017 and the thesis**: unread. The failure model's kinds stand as D2 says until they are read.
- **What the shapes can't say**: the goal-type badges, and conditions as notes (D8); actor boundaries are rectangles fitted to their elements, not the figures' ellipses.

## Examples

- `examples/tropos4as/cleaner-agent/`: AAMAS 2009 Fig. 1; the §5 scenario and its transcribed trace; all-fail, derived.
- `examples/tropos4as/patient-monitoring/`: iStar 2011 Fig. 1, as far as the paper shows it; "a day", ours and derived.

Each README maps the figure element by element. The orchestrator reviewed both seeds as equivalent to their figures (#134 D9).
