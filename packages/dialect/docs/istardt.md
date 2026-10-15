# iStar-DT / DT-Golog: a stress test of the engine framework

iStar-DT (Liaskos et al.; *iStar-RL* in ER 2024, *iStar-DT* in DKE 2026)
extends iStar 2.0 with what a decision-theoretic model needs: effects with
probabilities, domain predicates and variables, condition boxes, precedence,
and qualities given by numeric formulas, one of them the reward. Its
translator, `dtx2dtg` ([cmg-york/istardt](https://github.com/cmg-york/istardt)),
reads iStarDT-X files (`.istardt`, `.istardtx`) and writes a DT-Golog program
that DT-Golog's `bp/6` solves and dtg2sim's `GMEnv` runs as an RL environment.
iStar-DT was added as goal-controller's fifth stress test (#119, planned on
#117, where its decisions are logged).

This page records:
- what the dialect reads, from the BNF, the XSD and the translator's sources;
- what fit as it was;
- where the framework had to grow;
- the divergences from `dtx2dtg`, and what is unverified;
- what is still open.

## What iStar-DT reads

The references are cmg-york/istardt at `649c9be`: `docs/bnf_grammar.md`,
`src/main/resources/xsd/istar_dt_x_schema.xsd`, the translator
(`translators/dtx2dtg/{com2dtg,FormulaParser,Formatter,PermutationsGenerator}.java`)
and the xmlparser it reads with (`xmlparser/`), all fetched by
`scripts/istardt-stress/fetch.cjs`.

**Elements and ids (#117 D1).** Every element is numbered by kind in the
file's order; its name is the file's `description` (its file name when the
description is empty, as for predicates); an `identifier` property keeps the
file's name where it isn't the camelCase of that name (`deliveredInTimeA_Eff`).
DT-Golog names an element `identifier ?? camelCase(name)`, `Formatter.toCamelCase`'s rule.

| iStarDT-X | Kind | Id | Properties |
| --- | --- | --- | --- |
| `goal` | `istar.Goal` | `G1` | `root`, `episodeLength` (the root's), `terminal`, `identifier` |
| `task` | `istar.Task` | `T1` | `identifier` |
| `quality` | `istar.Quality` | `Q1` (text) | `formula` (an expression; none when its utility links are its sum), `root` (the reward), `exportMin`, `exportMax`, `identifier` |
| `effectGroup` | `istardt.EffectGroup` | (none: a hub) | |
| `effect` | `istardt.Effect` | `E1` | `satisfying`, `set`, `identifier` |
| `condBox` | `istardt.Condition` | `C1` | `formula` (an assertion), `identifier` |
| `predicate` | `istardt.Predicate` | `P1` | `exportMin`, `exportMax`, `identifier` |
| `variable` | `istardt.Variable` | `V1` | `exportMin`, `exportMax`, `identifier` |

Goals, tasks, effects, conditions, predicates and variables have Notation
lines (`G1:`, `T1:`, `E1:`, `C1:`, `P1:`, `V1:`, the dialect's prefixes,
#133), each with its property lines under it. A quality is iStar's kind,
which takes only the catalog's prefixes: `Q1` is its text's, and it has no
line (its properties are the inspector's; a link line can name it). An
effect group has neither text nor line. An element's
piStar id is the file's name for it (`orderMaterial`), the source's id as
importers keep it; a task's effect group's is `<task>/effectGroup`. A piStar
id equal to the text's id would read, in the workbench, as an element without
one.

**Links**, drawn as iStarDT-V draws them (the legend of ER 2024's figures,
mx2dtx's diagrams):
- A refinement, AND or OR, child to parent: a goal's child goals first, then its child tasks, as the translator reads them. The writer follows the links' order.
- `istardt.EffectLink` (`eff`): a task to its effect group; `istardt.EffectGroupLink`: the group to each of its effects, in order, with the effect's `probability` (mx2dtx's `effectGroupLink`, labelled with it).
- `istardt.TurnsTrueLink` and `istardt.TurnsFalseLink`: an effect to the predicates it makes true and false, in order.
- `istardt.PrecedenceLink` and `istardt.NegativePrecedenceLink` (`pre`, `npr`): from the goal, task or condition the formula names to the goal, task or effect that holds it. A formula that isn't one element's name becomes a condition the importer names `<holder>Pre` (`<holder>Npr`), with an info (#117 D2).
- `istardt.UtilityLink` (#117 D3, corrected): a term of a quality's weighted sum, from a quality (`weight × q`) or from an effect (`weight × p`, the one predicate the effect turns true), with its `weight`; mx2dtx's `contributionLink`. A quality whose formula is such a sum is drawn as its links and keeps no `formula` (Order: all three; Heating: Overall Quality); any other quality keeps its formula.
- `istardt.ReadsLink` and `istardt.ReadsPreviousLink` (PRE): from each element a quality's or a condition's formula names to it, the second for a name read through `previous(x)` (an element's own previous value is a link to itself), as the paper's figures draw them (ER 2024; dtg2sim's `GoalModels.drawio`). The importer draws them from the formula, which stays the source; the writer doesn't read them, and `istardtProblems` warns when they don't show what the formula reads. Heating: `hvacOn` → Running Time and Room Temperature, Running Time → Cost, Room Temperature → Comfort, `signalOnS` and `signalOffS` → `hvacOn`, and PRE on `hvacOn`, Room Temperature and Running Time. The figure draws all four effects into `hvacOn`, its two failure effects too; the formula reads the two predicates.

**Formulas (#117 D6).** A quality's formula is the goal language's
`expression` (`0.5 + 0.9 * previous(roomTemperature) + hvacOn * (…)`); a
condition's is an `assertion` with `previous/1` (#126: a call is a condition on
its own), written fully parenthesised since `!` takes everything after it:
`((previous(hvacOn) & (!(signalOffS))) | signalOnS)`. Names are DT-Golog
identifiers. The importer writes a tree as the translator's xmlparser reads
it: through Jackson, which groups an element's children by tag name, in the
order each name first appears.

**The actor's sets (#117 D4).** iStar-DT has one actor. Its cross-run,
exported and initialized sets are its properties, ordered lists of identifiers
(`crossRun`, `exported`, `initializations` as `name:value` pairs), since the
fixtures need the file's order (Order's `init` isn't the declaration order;
Heating's cross-run set mixes kinds). A continuous export's bounds are its
element's `exportMin`/`exportMax`.

**Options.** `continuous` and `infeasibleActionPenalty`, the file's
`<options>`, are the engine's options (`istardtOptions`); the importer records
them for the project.

**No positions.** The file has none: `importers/layout.ts` (#123) places
everything.

## The writer

`istardtOutput(istardtAnalysisModel(model), { modelName })` → one file, `dtgolog`
(`<model>.pl`). It is `com2dtg.translate` ported section by section and string
by string: the header, options, cross-run and exported sets, initializations,
action lists, `nondetActions`, `prob`, `proc` (`#` for OR; one procedure per
order of an AND's children), `dtgRun`, the successor-state axioms, `poss`, the
`_Sat`/`_Att` formulas, the condition boxes, `goalAchieved`, a clause per
quality and `rewardInst`. It reads the model as a graph, the view of its
`GoalModel` (goal-tree's IR of actors, elements and links, #125/#128):
`istardtAnalysisModel` builds it with the engine's mapper, which keeps the
actor's sets and the links' probabilities and weights.

What the translator does, and the writer with it:
- numbers are Java `float`s printed with `Float.toString` (`23` → `23.0`, `-10` → `-10.0`);
- `add`, `multiply`, `and` and `or` are left-nested, every operand parenthesised;
- `previous(x)` is `x_fl(s0)` in a condition, `x(R_x,s0)` (or `val(R_x_fl,x_fl(s0))`) in a quality;
- a quality that reads its own previous value doesn't add its initial value;
- `bp(root,10,…)` is hard-coded;
- a condition in the exported set is left out of both sets (a warning);
- a `pre` reaches the effects of every descendant of the element that holds it.

**Checks.** `istardtProblems` checks the model as a whole: one root goal and
one root quality; an effect group of one task, one per task, each effect in
one group; a group's probabilities summing to 1 (tolerance 1e-9) and a
satisfying effect that turns a predicate true; a quality with a formula or
utility links, not both, and an effect weighing on it by the one predicate it
turns true; formulas, `set` and the sets naming elements of the kinds they
read; a continuous export's range; two elements with one identifier; an `npr`
between OR siblings (info: they already exclude each other). The writer stops
on its errors. The named checks are the declared properties' (one root goal,
an export's range).

## The oracle (#117 D1)

1. **Byte for byte**, the gate: the writer's file for each of the nine golden
   pairs equals its `*-Auth.pl` after the four header lines (`pnpm
   stress:istardt`; the committed Order and Heating in lib's tests).
2. **DT-Golog**, in Docker (`docker/dtgolog/`): SWI-Prolog 9.2.9 with
   Soutchanski's `DT-Golog.pl`, downloaded at build time from the author's page
   (its licence forbids redistribution: never committed, the image never
   pushed), patched as RLGen's README says, and dtg2sim's
   `DT-Golog-Iface.pl`/`DT-Golog-Ext.pl` at `ed424ff`. `pnpm stress:istardt
   --oracle` runs ours and the golden file with the program's own `dtgRun`
   and compares the expected utility, the probability and the policy. Two
   things no published file gives, added in `docker/dtgolog/shim.pl`:
   - `getInitValue/2`, `initiallyTrue/1` and `val/2`, which the generated
     programs call (dtg2sim and RLGen define none of them), read from how the
     programs use them;
   - ECLiPSe's `printf/2,3` and `date/1`, which `bp/6` writes its report with
     (RLGen's patches leave them out).
3. dtg2sim's `*_Trials.py` utilities, informational: Order's 0.9235 is the
   golden file's and ours. The others are hand-written RLGen models, not the
   fixtures.

OrganizeTravel's golden file doesn't terminate under `bp`: its qualities are
cross-run without initializations, so `avoidMoneyLoss(_, s0)` calls itself
(dtg2sim's environment asserts initial values before it queries). Ours does
the same; the stress test reports it as the model's, not the writer's.

## What fit as it was

- New element and link kinds with shapes, from a dialect extension (#110), declared in the model's `"metamodel"` block as GRL's are (#106).
- Link properties on an extension's link (`weight` on `istardt.UtilityLink`), and properties on the actor (#107, #109): the sets are an actor line in the Notation view.
- A numeric formula on an element, with references and a function: the `expression` value type (#120/#122). A Boolean formula with `previous(x)` as a condition on its own: `assertion` with functions (#126).
- A layout for a model without a diagram, and typed engine options (#118/#123).
- One text output matched byte for byte, GODA's shape (#34); the engine object (#124/#127).

## Where the framework had to grow

No engine names in the core packages: the gate (`grep -ri 'istardt\|istar-dt\|golog\|drawio\|mxgraph'` over dialect, goal-language, goal-tree, lib's pool and the layout) finds this page and the docs beside it only.

- **Properties on an extension's kinds (#117 D7)**: grown by #132/#133. The dialect names its extension; effects, conditions, predicates and variables declare their properties and have lines.
- **A link line to an unlisted iStar kind.** #133's check context left out an iStar kind the dialect gives properties without listing it (iStar-DT's qualities), so the document wrote `link Q1 {weight = 0.5}` under an effect and then reported "No element Q1". `contextFromView` now holds such an element (`goal-language/src/notation/document.ts`); no other dialect has one, and the language snapshot is byte-identical.
- **Formulas name identifiers, not keys** (the owner's choice on #133's follow-up): a condition's and a quality's formulas keep the DT-Golog identifiers the file writes (`previous(hvacOn) & !(signalOffS)`), variables to the language; `istardtProblems` resolves them. Typing them as references would make them `previous(C1) & !(P4)`.
- **Checks across elements.** A group's probabilities, an effect's task, a quality's formula or links: the engine's (`istardtProblems`, the Problems panel through `analyze`).
- **Links and actor data in the IR**: #125/#128's `GoalModel`, read through the mapper.
- **The importers' result type** moved to `importers/types.ts`, with the options an importer records (`dialectRecord.options`); `FILE_IMPORTERS` lists the importers the workbench opens a file with, by extension.

## Divergences from dtx2dtg, and what is unverified

Written as ER 2024 §3.2 and the BNF say, where `dtx2dtg` writes nothing or
writes something else. The fixtures don't cover them; `istardt-own` does, and
DT-Golog runs it (`reference/utility.txt`). Unverified otherwise.

- **`npr`** (a TODO in `com2dtg`): the effects of the element that holds it, and of its descendants, get `\+ x_Sat(S)` (`\+ c_fl(S)` from a condition).
- **A task's or an effect's own `pre`** (`com2dtg` reads only its ancestors'): appended to its effects' `poss`.
- **`turnsFalse`** (a TODO): the predicate's axiom keeps it only if none of those effects happens: `p_fl(do(A,S)) :- (p_fl(S),\+ A=e2); A=e1.`
- **`set` and variables** (not written): `v(V,s0) :- getInitValue(v_fl,V),!.` (the initializations write a variable as `v_fl(value)`), a clause per effect that sets it, and a frame clause.
- **A comparison in a condition**: `com2dtg` writes `gt` and `lt` both as `<` and fails on a constant; the writer writes `(x(V_x,S),V_x > 50.0)`, with `=<`, `>=`, `=:=`, `=\=` for the others.
- **A division and a negation** in a quality (a warning text in `com2dtg`): `(L) / (R)`, `-(X)`; a negative constant is a constant (`-0.1`).
- **An effect in a quality's formula** (none in `com2dtg`): `val(R_e_Sat,e_Sat(S))`.
- **`continuous = false`**: `getObsType(discrete)` (`com2dtg` writes `continuous` whatever the option says; its commented line would write `discrete`). Every fixture has `true`.
- **`infeasibleActionPenalty`**: recorded, not written, as `com2dtg`: dtg2sim's interface sets `getInfeasiblePenalty(-100)`.
- **The header**: the model's name, where `com2dtg` writes `Spec`; the date `TEST` unless given.

## Still open

- **A `.drawio` importer** (mx2dtx's conventions, the `iStarDT-V` shapes, positions): not in #119. `scripts/istardt-stress/fetch.cjs` fetches mx2dtx's eight `.drawio` at `97b8a18`; `1.Order.drawio` is the pending fixture.
- **The round trip to iStarDT-X**: no export.
- **`terminal`**: read and kept, not written (`com2dtg` writes nothing for it).
- **The DKE 2026 additions**, beyond the BNF at `649c9be`: none read.
- **dtg2sim's `GMEnv`** as a back-end (#117 D1.3): the image has no Python; not run.
- **A goal-controller-native RL environment** is P12's own work.
- **A quality's line**: iStar's kind takes the catalog's prefixes only, so `Q1` has none; its properties are the inspector's, and a quality's utility links to another quality are written on no line.
- **The paper's figure's shapes** (dtg2sim's `GoalModels.drawio`): ellipses for effects and conditions, clouds for qualities and variables, a satisfying effect's colour; PRE is a link here, not a node of its own.

## Examples

- `examples/istardt/istardt-order/`: dtx2dtg's `1.Order` fixture (LGPL-2.1), its golden file and DT-Golog's utility.
- `examples/istardt/istardt-heating/`: `3.2.Heating_10R_Mixed` (LGPL-2.1), likewise.
- `examples/istardt/istardt-own/`: our model of what the fixtures lack; its reference is DT-Golog's run.

`pnpm stress:istardt` checks all three and the nine fetched pairs
(`scripts/istardt-stress/README.md`).
