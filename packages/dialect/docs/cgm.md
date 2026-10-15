# Contextual goal models: a stress test of the engine framework

Contextual goal models (Ali, Dalpiaz, Giorgini; DISI Trento, 2008–2014) put
**contexts on the variation points** of a Tropos goal model. A context is a
formula over facts the system can observe. It decides:
- whether a root goal is active;
- which OR alternative or means-end task is adoptable;
- whether an AND subgoal is needed;
- whether a dependency may be used;
- which sign a contribution has.

The analyses then derive variants from the contexts. GODA's context conditions descend from this work (below).

No tool survives and no model file was ever published. RE-Context, the authors' prototype, read a DLV program written by hand (REJ 2010 §6). So this engine is built from the papers, as an analysis engine: each case is a variant, or a set of them, drawn on the model as a selection.

It is goal-controller's seventh stress test (#153), planned on #151, where decisions D1–D16 and the seed verdicts are logged. Its framework half was #152 (blue).

This page records:
- what the dialect reads, and from which figure;
- the four analyses;
- the oracle;
- the errata;
- what fit as it was;
- where the framework had to grow;
- what is still open;
- how GODA maps onto it.

## What the dialect reads

The sources:
- **REJ 2010**, *A goal-based framework for contextual requirements modeling and analysis*, Requirements Engineering 15 (2010) 439–458. Its parts:
  - Table 1's six variation points;
  - context analysis (§3.4, Defs. 3–7);
  - §4's runtime derivation;
  - §5's design-time reasoning;
  - RE-Context's DLV listings, Codes 2–4;
  - the museum guide, Figs. 2, 3, 4, 7, 9, 11 and 13.
- **IST 2013**, *Reasoning with contextual requirements: detecting inconsistency and conflicts*, Information and Software Technology 55 (2013) 35–57. Its parts:
  - the smart home, Fig. 1;
  - ϕ0–ϕ16, Table 2;
  - the analysis of ϕ1, Fig. 2;
  - §4.1's consistency analysis.
- Read, not implemented: IST 2013's task effects and conflicts (§4.2), and SoSyM 2013's deployment analyses (#151 D6).

The definition is `packages/lib/src/engines/cgm/definition.ts`.

- **iStar 2.0's kinds** for Tropos's:
  - a goal is a goal, a task a task, a softgoal a quality;
  - AND/OR decomposition is iStar's refinement;
  - a means-end is an OR-refinement from the task to its goal;
  - contributions and dependencies are iStar's (a depender's link to the dependum, the dependum's to the dependee).
- **The variation points** (Table 1), each a formula over contexts in the goal language's `assertion` (#151 D2, D3; `a → b` is written `!a | b`):

  | Table 1 | Where | Property |
  |---|---|---|
  | 1. Root goal activation | the root goal | `activation` (roots only, a check) |
  | 2. OR-decomposition | its OR refinement link | `context` |
  | 3. Means-end | the task's OR refinement link | `context` |
  | 4. Actor dependency | the depender's link to the dependum | `context` |
  | 5. AND-decomposition | its AND refinement link: the child is needed iff it holds, otherwise dropped (Fig. 3's `¬C2 ∧ ¬C3 → Null`) | `context` |
  | 6. Contribution | its contribution link: the label applies iff `context` holds, the opposite label (make↔break, help↔hurt) iff `opposite` holds | `context`, `opposite` |

  iStar 2.0 allows one contribution link per pair, and istar-ts rejects a second (`duplicate-link`). So Table 1's "negatively iff Cj" is the same link's `opposite`, not a second link (#151 D10).
- **The `cgm` extension** (#151 D2, D11):
  - `cgm.Context` (`C4: …`), with a `formula` over statements and facts and a `description`, the paper's sentence;
  - `cgm.Statement` (`ST1: …`), with its `supportedBy` formula;
  - `cgm.Fact` (`F1: …`), with its `technology`;
  - Fig. 13's cost relations, task → task: `cgm.IncludesLink` (`Include(T2, T1)`: T1's whole cost shared) and `cgm.IntersectsLink` with `amount` (`Intersect(T3, T4, 40)`). Neither needs the same actor, because Fig. 13's T4–T9 crosses actors.
- **Tasks** have a `cost`.
- **Ids** are the papers' labels (#151 D9):
  - goals `G1`, tasks `T1`, contexts `C1` (IST's ϕ1 is `C1`), statements `ST1`, facts `F1`;
  - a world predicate a paper numbers per context keeps that number: `F7.1` (`wp7.1`), REJ Fig. 4's `wp1` and `wp2` as `F1.1` and `ST1.2`. Dotted ids are names in conditions since #154;
  - softgoals are `SG1` in their text only, because iStar's quality takes only the goal language's prefixes and so has no line (as iStar-DT's `Q1`);
  - a dependency's ends are `G3` (the depender), `G3.1` (the dependum) and `G3.2` (the dependee's goal).
- **No notation**: a decomposition is its refinement links. Names are free text (`notation.names: 'text'`). The figures' `[v]` placeholders are written `(v)`, because brackets are the goal language's notation.
- **The Notation view** lists goals, tasks, contexts, statements and facts. A link's properties are link lines under its source: a context, an opposite, an amount. A dependency's are under its depender (#152 item 4). All three seeds' documents read back to the same model, with no diagnostic:

  ```
  G1: visitor (v) gets informed about a piece of art (p) in museum (m)
    G2: (v) gets info via his/her PDA
      link G1 {context = C5}
      …
    G3: (v) gets info through (m) staff (s)
      link G1 {context = C6}
      link G3.1 {context = C10}
  …
      G10: (s) gives (p) info to (v) in person
        link SG2 {context = C14} {opposite = !C14}
  C1: the visitor is still inside the gallery building and is interested in the piece of art
    formula F1.1 & ST1.2
  ST1.2: visitor (v) is interested in getting explanation of piece of art (p) in museum (m)
    supportedBy ST1 & ST2 & ST3 & ST4
  ```
- **Checks**:
  - named checks (the editors run them):
    - a context is monitorable: every statement it names is supported, transitively, down to facts, with no cycle (Defs. 6–7);
    - a statement is supported in the same way;
    - `activation` sits on a root;
    - an `opposite` needs the contribution's own `context`, and differs from it;
  - `cgmProblems`, across the model:
    - the same checks;
    - a formula that doesn't read;
    - a formula naming what isn't a context (on a variation point) or a statement or fact (in context analysis);
    - a context on a link that isn't a variation point;
    - a statement without support.
- **Project resources** (#151 D15), declared by the definition, never in the model:
  - `situations/*.json`: the contexts that hold, or the facts (each context then evaluated from its formula, its statements through their support), and the softgoals' priorities. Closed-world, as Code 3's `phi(c14).`.
  - `relations/*.json`: the analyst's logical relations (§5.1), absolute and per operational environment, each an assertion over contexts, statements and facts.

## The analyses (`engines/cgm/analyses.ts`)

They are written in this engine's folder over #152's `variantsOf` and propositional solver. The engine gives the walk:
- its guards: a root's `activation`, a link's `context`;
- its relations: iStar's refinements as iStar's, and a **dependency as an alternative**, so its context is a required context, not an activation (IST 2013 §3.1, #151 D16);
- `follow`: into the dependee's goal.

A variant's context is the conjunction of its guards as it passed them, so a dropped AND child's is negated (Fig. 3). Each context is then replaced by its formula, down to facts, where the relations name facts (§5.1).

1. **Variants in a situation** (§4), `cgmVariants`, per situation:
   - the variants whose every guard holds as they passed it;
   - each ranked by `priority(v) = Σ_sg percentPos(v, sg)·priority(sg) − Σ_sg percentNeg(v, sg)·priority(sg)`, best first. The percentages are over the contributions from the variant's goals and tasks that apply in the situation (#151 D14).
   - Each case is the variant as a selection, its summary its score and context.
2. **Unadoptable variants** (§5.1, Fig. 8, `CheckSAT`), `cgmUnadoptable`, per relations file and environment: the variants whose context is unsatisfiable under the relations, each with the relations the solver's `conflict` names.
3. **Core variants** (§5.2, Def. 8, Fig. 10), `cgmCore`:
   - the satisfiable variants, grouped by context equivalence;
   - a group whose context strictly implies another's is non-core, and each of its variants is reported with a core variant that replaces it.
   - Fig. 10's lines 9–14 print `temp`. Read as the implying group, the figure agrees with Def. 8 (#151 D14).
4. **Minimum-cost tasks** (§5.3, Fig. 12), `cgmMinimumCost`:
   - the mandatory tasks;
   - the groups those tasks already implement, excluded;
   - the mandatory tasks left out of the rest, and the groups that became equal unified;
   - the product's cheapest combination.

   A set's cost is Σ cost less each pair's overlap (#151 D11). It reports the tasks, their cost, the cost of developing all tasks, and the core variants the set implements.

## RE-Context's DLV encoding (`engines/cgm/dlv.ts`)

`reContextDlv(model, { situation?, costs? })` writes a model as Codes 2–4 write one by hand (#151 D12: a lib function, not an engine output: cgm is an analysis engine):
- **Code 2**: `ach(g)`, `todo(t)`, a disjunction per OR, a rule per AND child. A context is an atom its child derives (`c5 :- ach(g2).`). A guarded AND child is kept or dropped (`ach(g14) | drop(g14) :- ach(g13).`, `not_c2 :- drop(g14).`). Each answer set is a variant.
- **Code 3**: `phi(c)`, `softgoal(sg, p)`, and `contrib(x, sg, pos|neg)` under its contexts (`contrib(g10,sg2,neg) :- not phi(c14).`).
- **Code 4**: a resource per task and per cost relation. A task's own resource costs its cost less what it shares, which may be negative: Fig. 13's T4 shares 90 of its 80. Only then do a set's resources sum to the pairwise cost. Fig. 13's `Include(T2, T1)` comes out as Code 4's own lines: `r_t2_t1` (30) shared, `r_t2` (10) T2's.

DLV 2 writes a disjunction `|`, where DLV of 2008 and Code 2 write `v`. Each seed's programs are committed (`examples/cgm/<seed>/reference/*.dlv`) and tested byte for byte.

## The oracle (#151 D1)

1. **The papers' numbers, exactly** (`pnpm stress:cgm`, rows R1–R4, from the seeds):
   - R1, Fig. 13: tasks `{T1,T4,T5,T7,T8,T9}`, cost 215, implementing `{V2,V5,V6}`; developing all tasks costs 340; the core groups are `{V1…V4}`, `{V5}`, `{V6}`.
   - R2, Code 3: G10's variant scores 4, G11's −2.
   - R3, Fig. 3: the variant's context is `C0 ∧ ¬C2 ∧ ¬C3 ∧ C1 ∧ C6 ∧ C10 ∧ C11`, and C14 decides its quality.
   - R4, Examples 2–3:
     - under `wp8.1 → ¬wp7.1`, `C7 → ¬C8`, and all 32 variants with C7 ∧ C8 are unadoptable;
     - Fig. 9's variant is unsatisfiable, with the conflict the solver names (`!F7.1 | !F1.1`).
   - IST 2013 Example 1: every variant activating ϕ1 and ϕ7 is inconsistent.
2. **DLV 2.1.2 and z3, independent** (`--oracle`, `docker/dlv`):
   - DLV's answer sets of each seed's Code 2 equal the TS enumerator's variants, elements and contexts as sets: 160, 13 and 168.
   - DLV's Code 4 totals Fig. 13 as D11's rule does: 340 and 215.
   - z3 re-checks every satisfiability, equivalence and implication verdict the analyses take on the seeds' relations: 3439, all agreeing.
3. **No importer**: there is nothing to import.

## Errata

The engine follows the formula, and the stress test reports each erratum as "paper prints X, the formula gives Y":

- **REJ Example 1 (§4)**: with comfort 4, well informed 3 and C14 false, the in-person variant v′ scores 3 − 4 = **−1**, and the call variant v″ **+1**. The paper prints `priority(v′) = 1`, `priority(v″) = −1` and selects v′.
- **Fig. 13's non-core variants**: it lists NV1 and NV2, "both can be replaced by V2". V2 is on the PDA branch, under C5, which neither implies. The fragment has seven non-core variants, each replaced by V5 or V6.
- **Fig. 13's `Intersect(T4, T8, C)`** in the text is the figure's `Intersect(T4, T9, 30)`. The seed follows the figure, which gives the same result because both tasks are in the set.
- **Fig. 13's overlaps are not resources**: T4's three overlaps sum to 90, more than its cost of 80. Code 4 writes them with a negative own resource (above).
- **Fig. 4's α and IST Fig. 2's ϕ1** are each a parenthesis short as printed. The seeds follow the trees, and tests check that each, restored, is the trees' formula, by truth table.
- **IST §4.1** says "ϕ7 → ¬ϕ10 because wp7.1 → ¬wp10.1". It is wp7.2 ("it is night time") that contradicts wp10.1 ("it is not night time").

## What fit as it was

- New kinds and links with shapes and rules: a dialect extension (#110), in the model's `"metamodel"` block (#106). Properties on its kinds (#132), and its kinds' lines with ids of their own (`C`, `ST`, `F`).
- Formulas: the goal language's `assertion`, resolving the extension's kinds, read as trees (`readAssertion`).
- Link properties (#107) and link lines.
- Situations and relations beside the model: project resources (#25), as GRL's strategies and Tropos4AS's scenarios.
- An analysis engine (#107) reading the IR (#125), and the engine object (#124), registered in the workbench as GRL and Tropos4AS are.

## Where the framework had to grow

No engine names in the core packages. The gate (`grep -rniE '\bcgm\b|re-context|dlv|museum|smart.?home'` over dialect, goal-language, goal-tree, lib's pool, `engines/analysis.ts`, `engines/variants.ts` and `engines/propositional.ts`) finds only two docs: this page, and grl.md's jUCMNav Smart Home.

- **`!` negates the operand it precedes**, and **dotted ids of any prefix are names in conditions** (#154). Before it, `!C13 | C12` read as `!(C13 | C12)`, and `F7.1` didn't read.
- **Variant enumeration** (`variantsOf`) and **propositional reasoning** (`satisfiable`, `implies`, `equivalent`) over assertion trees, with the engine's guards, relations and follows: blue's #152 (#151 D7, D8).
- **Analysis cases that are a selection**, with a summary, and a picker that searches: #152.
- **An `assertion` on a link that resolves an extension's kind, end to end**: #152 item 4, which fixed the two gaps the seeds found:
  - a link line to a quality was written but rejected;
  - a dependency's line couldn't be written.

## Still open

- **IST 2013's conflict analysis** (task effects on objects, §4.2) and **SoSyM 2013's deployment** (augmentation, unusability, redundancy): out of this round (#151 D6).
- **No importer**: RE-Context's sources and models never surfaced.
- **Context analysis's support as evidence**: REJ §6.2's weighted support and temporal relations aren't modelled. A statement is replaced by its supporting formula.
- **Larger models**: REJ's own museum case had 324,000 variants. The analyses enumerate up to 20,000 per root, and Fig. 12's product up to 10⁶ combinations. REJ §6.2's divide and conquer is not done.
- **The DLV writer is a function, not an engine output**: an engine either writes files or analyses (#151 D12).

## GODA's context conditions (#151 D5)

GODA is not run on these models. Its context conditions descend from this work:
- a contextual goal model's **root and AND activation contexts** are GODA's goal **`creationProperty`** (`assertion condition …`): the goal is pursued only when it holds;
- a **means-end context** is a task's **`assertion trigger`**: the task is adoptable only when it holds.

GODA has no OR-decomposition, dependency or contribution contexts. Its conditions are formulas over context variables, with no context analysis.

## Examples

- `examples/cgm/museum-guide/`: REJ 2010 Fig. 2, its contexts C0–C15, and Fig. 4's analysis of C1. It carries Example 1 (a situation) and Examples 2–4's relations.
- `examples/cgm/museum-guide-costs/`: Fig. 13, with its costs and cost relations, Code 3's situation, and `C13 → C12`.
- `examples/cgm/smart-home/`: IST 2013 Fig. 1, ϕ0–ϕ16 from Table 2, and Fig. 2's analysis of ϕ1. It carries §4.1's contradictions and a situation of ours.

Each README maps the figure element by element and lists every reading. The orchestrator judged all three equivalent to their figures (#151).
