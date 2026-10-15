# GRL / jUCMNav: a stress test of the engine framework

GRL, the Goal-oriented Requirement Language, is the goal half of URN
(ITU-T Z.151). [jUCMNav](https://github.com/JUCMNAV/jUCMNavPlus) is its
editor. It saves URN specifications as `.jucm` files and evaluates GRL
models under *strategies*. GRL was added as the first *analysis* engine
(goal-controller #106, on #107's framework): its output is a value on every
element and actor of the model, not a file. Its decisions are logged on #105.

This page records:
- what the dialect reads, from jUCMNav's metamodel and algorithms;
- where the framework already fit;
- where it had to grow;
- what is still open.

## What GRL reads

The references are jUCMNavPlus's sources:
- the metamodel, `seg.jUCMNav/src/seg/jUCMNav/emf/grl.ecore`;
- the evaluation, `seg.jUCMNav/src/seg/jUCMNav/strategies/`.

**Elements**
- An `IntentionalElement` of type Softgoal, Goal, Task, Ressource (sic) or Indicator. They are read as:
  - `istar.Quality`, `istar.Goal`, `istar.Task`, `istar.Resource`;
  - `grl.Indicator`, a kind GRL adds (the `grl` extension, `packages/lib/src/engines/grl/extension.ts`).
- A belief is a diagram node, `grl.Belief`. A belief link from it to an element is `grl.BeliefLink`.
- jUCMNav's 2014 metamodel also has a `Feature` type, and `grl:Feature` elements (SmartHome2). Both are read as tasks. Feature models are not ported.
- An element has:
  - `importance` (High, Medium, Low, None);
  - `importanceQuantitative` (0..100, which the quantitative evaluation weighs);
  - `decompositionType` (And, Or, Xor).
- An indicator's `importance` and `importanceQuantitative` are declared on its kind (`'grl.Indicator'` in the dialect's `properties`, goal-controller#132): the inspector edits them. GRL lists no indicator in the Notation view (it has no ids, so no property lines), and the other kinds' are read, not declared (below).

**Links**
- A *decomposition* (child → parent) is an iStar refinement: And as `istar.AndRefinementLink`, Or as `istar.OrRefinementLink`.
  - Xor has no iStar link, so it is written as Or, with `decompositionType: Xor` on the parent (#105 D6). jUCMNav evaluates Xor exactly as Or.
- A *contribution* is `istar.ContributionLink`:
  - its iStar value (`make`, `help`, `hurt`, `break`) is the link's label;
  - GRL's seven types (Make, Help, SomePositive, Unknown, SomeNegative, Hurt, Break) are the link property `contribution`;
  - its weight is `quantitativeContribution` (−100..100, EMF's default 25);
  - a side effect is marked `correlation`.
- A *dependency* is `istar.DependencyLink`, from depender to dependee.
  - An element between a depender and a dependee, outside every actor, is the dependency's dependum.
  - A GRL dependency with no element between is a direct link. The importer warns, and the workbench reports it, since piStar wants a dependum.

**Actors**
- An `istar.Actor` with `importance` and `importanceQuantitative`.
- Written in the Notation view as an actor line at the top of the document, `actor "Home owner" {importance = High} {importanceQuantitative = 80}` (goal-controller#109).
- Its elements are those its diagram box (`ActorRef`) draws.

**Strategies**
- A strategy sets some elements' initial values. jUCMNav saves only those; the propagated values are computed.
- They are the dialect's `strategies` project resource: a folder of JSON files, one per strategies group.
- The format is documented in `engines/grl/strategies.ts`:
  - each strategy's evaluations, by element id;
  - its included strategies;
  - an indicator's KPI value set;
  - the group's preferences: the evaluation `range` (−100..100, or `positive`, 0..100) and the `tolerance`.

**Evaluation**
- Two of jUCMNav's eight algorithms are ported as GRL's analyses, `grlQuantitative` and `grlQualitative`. They are in `engines/grl/evaluation/`.
- Shared by both (`PropagationGRLStrategyAlgorithm`):
  - **order**: an element is evaluated once every source of its links is;
  - an element the strategy sets, or a leaf, keeps its strategy value (0 when none);
  - an element in a cycle is never reached;
  - **KPI conversion**: an indicator's value comes from its KPI value set (`calculateIndicatorEvalLevel`).
- **Quantitative** (`QuantitativeGRLStrategyAlgorithm`):
  - AND is the minimum of the children; OR and XOR the maximum;
  - contributions add `weight × source / 100`, divided as Java ints (toward zero);
  - the sum saturates at 100 and at the range's bottom;
  - a value within `tolerance` of either end is held short of it, unless a contribution reaches that end;
  - jUCMNav's condition applies at the bottom end: the hold there takes effect only over a decomposition;
  - a dependency caps the element at its dependees' minimum;
  - an actor is its elements' importance-weighted mean, as a Java int.
- **Qualitative** (`QualitativeGRLStrategyAlgorithm`): jUCMNav's tables, transcribed:
  - a source's label through its contribution type;
  - several contributions combined by counting weak and full ones of each sign, two full ones of opposite sign making a Conflict;
  - a decomposition's best or worst label;
  - a dependency's lower label;
  - an actor's labels weighted by importance.
- A label is the value's: Satisfied 100, Weakly satisfied 1..99, None 0, Weakly denied −99..−1, Denied −100, Conflict −101, Unknown −102. Under the 0..100 range a value is read as 2v − 100 first.

The checks (`engines/grl/checks.ts`):
- a quantitative contribution outside −100..100;
- a contribution to a belief.

A strategy that evaluates an element the model doesn't have is said in its case's name, since no check sees both the model and a resource.

## The importer

`importJucm` (`packages/lib/src/importers/jucm/`) reads a `.jucm` into a piStar model in the GRL dialect. See [importers.md](importers.md). It keeps the file's ids, so a model element is the `.jucm`'s and jUCMNav's rows join on them. The import is one way: there is no export back to `.jucm`.

## The oracle (#105 D1)

`docker/jucmnav/` builds jUCMNavPlus at a pinned commit (`ffe86d60`) in Docker and runs one test in its test fragment. The test calls `BatchEvaluationUtil.calculateAllEvaluations` over each seed, under three settings: quantitative at tolerance 0, quantitative at tolerance 10 (jUCMNav's default), and qualitative. It writes one CSV per seed. The seeds' `reference/evaluations.csv` are its output.

To load the seeds, the oracle adapts three things before it reads them, each documented in `OracleTest.java`:
- the 2014 feature types, renamed into jUCMNavPlus's `fm` package;
- GoalCat's links' `refs` to `LinkRef` ids, which jUCMNavPlus's `LinkRef` can't resolve, removed;
- the elements' `linksSrc`/`linksDest`, which GoalCat doesn't write, written from the links.

None of them changes what is evaluated.

Our evaluations equal jUCMNav's on every row of the seeds checked:
- SmartHome2, 60/60;
- GoalCat's RTFM, 81/81, KPI conversion included;
- RTFM mini, 81/81;
- our own model, 72/72, which reaches saturation, both tolerance branches, the dependency cap, a decimal KPI and both actors' means.

`pnpm stress:grl` checks them again, with TURNtoURN's per-construct files as the import conformance set.

## What fit as it was

- **Element kinds.** iStar's four (a softgoal is a quality) and refinement links carry GRL's elements and decompositions.
- **Contributions.** The iStar link keeps its contribution value as its label, and GRL's seven types are a property beside it (#107).
- **New kinds.** Indicators and beliefs needed no core change: a model's own `"metamodel"` block (istar-ts) declares them, and the GRL extension draws them as jUCMNav does.
- **Strategies.** A `many` project resource of JSON files, with a parser that reports positions (#25).
- **Results.** #107's analysis shape: one case per strategy, a value and a label per element and actor, drawn by the workbench's Analyse control. Nothing GRL-specific was added to the shared workbench components. The engine has its own diagram and inspector, built from its definition like GODA's.

## Where the framework had to grow

- **#107 (blue):**
  - properties on links and on actors;
  - analysis engines (`Analysis`, `analysisModel`, `defineAnalyses`, the Analyse control);
  - a link check's context, `readLink` with the ends' kinds, which "a contribution to a belief" needs.
- **Engine modes read a model's own kinds (#106).** The workbench read a model's `"metamodel"` block only in a modelling dialect's mode, so an imported GRL model, with its indicators and beliefs, didn't load in the GRL mode. An engine whose models declare kinds of their own is now listed with its extension (`ENGINE_FILE_KINDS`), and its models are read with their block applied. The other engines still read iStar 2.0 only, so Edge still rejects a model with kinds of its own.
- **lib's XML reader (#106).** It dropped a tag's namespace prefix, so every `.jucm` was malformed to it (`</urn:URNspec> closes <URNspec>`). It now reads a prefixed name as written; MutRoSe's world files read the same.
- **Properties on an extension's own kinds (#132).** An extension's kinds couldn't declare properties, so an indicator's importance was read from the model but not declarable. GRL's dialect now names its extension (`extension: grlExtension`; the engine's kinds are its dialect's) and declares an indicator's `importance` and `importanceQuantitative` as an actor's. The workbench's view holds the indicators, keyed by their piStar id (their names have no ids), and the inspector shows their rows as a goal's. GRL lists none, so its Notation document is unchanged. See [adding-an-engine.md §2.6](adding-an-engine.md#26-properties-on-an-extensions-own-kinds).
- **Link lines without ids (#106).** GRL's contributions are written in the Notation view, under their source, and the target is named by its text, quoted: `link "Low running cost" {contribution = Make} {quantitativeContribution = 100}`. Where several elements have that text, `"Comfort"#2` names the second, in the document's order. The setting is generic, the dialect's `linkLines` (by default a dialect with ids writes link lines, and one without doesn't); GRL sets it. A link line keeps its place among the positional lines. It is checked like the id form: the target (unknown, or ambiguous without `#n`), the values against their config, and GRL's named checks (`grl.link.contribution`, `grl.link.quantitativeContribution`) through `readLink`. Edits map back to the link's `customProperties`. See the goal language's [link lines](../../goal-language/docs/goal-language.md#link-lines-properties-on-links).
- **Logged on #105, not built:**
  - *Element properties in a dialect without ids.* GRL's `quality` kind has no id prefix, so the dialect has none. defineDialect then allows no property on a kind it lists: there are no property lines, and an element line holds only annotations and declarations. So an iStar kind's `importance`, `importanceQuantitative` and `decompositionType` are read from the model, but not declared, and the inspector can't edit them. (An indicator's are declared since #132: GRL doesn't list its kind.) The proposal: an inspector-only element property (`line: false`), allowed in such a dialect.
  - *No check sees both the model and a resource.* A strategy that evaluates an unknown element is said by the analysis instead.
  - *iStar 2.0's link rules are stricter than GRL's.* GRL allows contributions to any element, decompositions of any element, links across actors, and dependencies without a dependum. The workbench reports these as link issues on imported models. A dialect can't relax iStar's rules.

## Still open

- **Z.151** (`.z151`, the standard's XML). The same metamodel in another serialisation, with no importer yet. jUCMNavPlus's `expected/actor.z151` is the pending fixture.
- **The other six algorithms:** mixed, formula-based, conditional, constraint solver (`Hao2011Algorithm`), feature model and timed GRL.
- **Not ported in the two that are:**
  - contribution contexts (`ContributionContext`);
  - KPI qualitative mappings (`QualitativeMappings`);
  - the `ST_Legal` stereotype (jUCMNav leaves an element tagged `No` out of AND decompositions and actors; the importer warns);
  - aggregate contributions (run-time metadata).
- **Round trip.** There is no export to `.jucm`.
- **Feature models.** Features are read as tasks.
- **Xor.** Drawn as Or. A check that at most one child is satisfied is not written.
- **Actors inside actors**, which jUCMNav weighs too: piStar has none.

## Examples

- `examples/grl/grl-smart-home/`: jUCMNav's SmartHome2 (EPL-1.0, committed with attribution).
- `examples/grl/grl-own/`: our model of every construct.
- GoalCat's RTFM models (no licence) and TURNtoURN's per-construct files are fetched by `scripts/grl-stress`, not committed (#105 D7).
