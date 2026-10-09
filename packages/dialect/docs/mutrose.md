# MutRoSe: a stress test of the engine framework

MutRoSe is a mission decomposer for robot teams
([MutRoSe-Mission-Decomposer](https://github.com/ericbg27/MutRoSe-Mission-Decomposer)).
Its goal models are piStar files, the same as ours, edited in VS Code by
[mutrose-vscode](https://github.com/CPeluti/mutrose-vscode) with an istar-ts
editor. It was added to the workbench as a fourth engine, following
[adding-an-engine.md](adding-an-engine.md). This page records:

- what MutRoSe requires of a goal model, taken from the decomposer's source;
- where the framework already fit;
- where it had to grow;
- what is still open.

## What MutRoSe reads

The decomposer's sources are the reference: `gm/gm.cpp`,
`utils/gm_utils.{hpp,cpp}`, `rannot/` and `annotmanager/`.

- **Elements**
  - Goals `G1` and abstract tasks `AT1`, in one actor (the mission, `M1`).
    With several actors, only the last one's nodes are read.
  - A task's first word after the colon is the HDDL task it stands for.
  - Every link is a refinement. An OR link makes the goal OR-decomposed.
- **Runtime annotations** in a goal's name:
  - `;` is sequential and `#` is parallel; `#` binds tighter.
  - `FALLBACK(a,b)` takes exactly two operands. Parentheses group.
  - With no annotation, a goal with several children runs them in
    parallel, and a goal with one child is a means-end.
  - `;` and `FALLBACK` are errors on an OR-decomposed goal.
- **Properties.** A closed list; any other key is an error.
  - `GoalType` is Perform (the default), Achieve or Query.
  - `Controls` and `Monitors` hold `name : Type` lists.
  - `AchieveCondition` (Achieve only) is `coll->forAll(it | cond)` or a
    condition.
  - `QueriedProperty` (Query only) is `src->select(v:Type | cond)`.
  - `CreationCondition`, `Group`, `Divisible`, `RobotNumber` (`N` or
    `[lo,hi]`), `Location`, `Params`, `Description`.
- **Validity** (`check_gm_validity`), depth-first over the goals:
  - a Monitors variable must have been declared by an earlier goal's
    Controls, and a declared variable can't be declared again;
  - a forAll's variables must be in the goal's lists;
  - a Query's variable type must match its first controlled variable.

  Each task's Params must also be bound (`at_manager.cpp`).
- **Output.** The decomposition needs an HDDL domain, a configuration and a
  world database, and runs as a native binary. A browser can produce the
  runtime annotation the decomposer prints with `-v`, after the same
  checks. That is the template's output (`output.rannot`, highlighted:
  ids, `;`/`#`, `FALLBACK`/`NC`), for example:

  ```
  (G2;NC(G4;NC(FALLBACK(NC(AT1;AT2),AT3))))
  ```

All 17 goal models of MutRoSe-Docs pass the checks and print. Their
nesting, `FALLBACK` and non-cooperative (`NC`) parts are as the decomposer's
rules give them.

## What fit as it was

- **The definition.**
  - Kinds with id prefixes; the operators `;` and `#` from the catalog, with
    MutRoSe's own precedence already the language's.
  - Properties with value types; `applies`/`required` for
    AchieveCondition and QueriedProperty by `GoalType`.
  - `relation: 'and'` on sequential and fallback, which turns MutRoSe's "no
    `;` on an OR goal" into the editors' relation mismatch.
- **Named checks** for what a value type can't say: the decomposer's own
  parsers were ported with their messages (`Invalid select statement … in
  GM.`).
- **Everything the UI derives from a definition.** It worked unchanged:
  - the Notation view, inspector fields, lint, completion and hover;
  - the language server.

## Where the framework had to grow

| What MutRoSe needed | What changed |
| --- | --- |
| Task ids `AT1` | The language's `ID_PREFIXES` gained `AT`. The lexer, grammar and highlighter build their id rules from the catalog, longest prefix first. The highlighter joined an id's prefix and number only for one-letter prefixes. |
| `FALLBACK(a,b)` | A new form in the catalog: **calls**, each with its number of operands. `,` moved out of the infix rule so a call's commas aren't the operator. See [extending-the-grammar.md](../../goal-language/docs/extending-the-grammar.md). |
| Nested annotations (`[G4;FALLBACK(G5,AT3)]`) | An engine was handed only the outermost construct and its operands (`executionDetail`). `mapGoalProps` now also gets the goal's text, read with `parseElementLine`. The language has `notationRefs` (every id a notation names, through groups and calls). |
| Query goals with no children | goal-tree rejected any leaf goal (an Edge rule). It is now the mapper's `allowLeafGoals`. The UI's own copy of the rule asks the engine's mapper. |
| Check names kept per engine | Registries were typed `Record<string, Check>` in the UI, which loses their names. `ENGINE_CHECKS` is a mapped type over the engines, keyed by each definition's `CheckNameOf`: a registry missing a check doesn't compile, and `ENGINE_CHECKS[engine]` goes with `ENGINE_DIALECTS[engine]` in generic code. |
| A view's children order through calls | The workbench's "missing from the notation" check read the outermost operands, so `G5`, `AT3` inside `FALLBACK` were reported missing. The view's `order` now lists every id the notation names, in the order written. |
| OCL values (`world_db->select(r:Room \| r.dirty)`) | A new value type, `ocl`, in the goal language: OCL's tokens, read leniently (MutRoSe's own conditions are: `forAll(x \|)`). The editors colour variables, types (after `:`, in `Sequence(…)`), keywords, operators and literals. The decomposer's structure is still its named checks'. |
| A goal type to pick when adding a goal | Palette entries that preset properties (Edge's Boolean and Integer resources): Goal offers Perform, Achieve and Query, each in its fill. |
| A fourth engine in the UI | The engine's label, output label and extension, and its options, were written out in four to six places each. They are now one `ENGINES` list in `engineDialects.ts`. Model conversion takes what an engine reads from a table (`ENGINE_READS`), and new elements get the target definition's id prefixes. |

Every change kept the Edge engines byte for byte: the Notation documents
and PRISM of every example are the same (`pnpm snapshot:language`).

## Still open

- **OCL has tokens, not a grammar.** The `ocl` type colours a value, but
  its structure is read by MutRoSe's checks, with their messages on the
  whole field. A grammar for it (paths `a.b`, `->select`, `->forAll`,
  `&&`/`||`) would point at the part that's wrong and complete the
  variables in scope; Edge's `assertion` could be a subset of it.
- **Checks see one element.** A check gets the element's properties and
  `kindOf`. MutRoSe's scoping needs the walk over the tree: Monitors
  declared by an earlier goal's Controls. So it runs in the template, and
  the analysis shows its first problem. The editors can't mark the field.
- **The fill follows a property.** A definition gives one fill per kind.
  mutrose-vscode colours goals by `GoalType`, which the MutRoSe diagram's
  goal component does itself. The inspector's Color row doesn't know: it
  shows the kind's default.
- **Children order.**
  - goal-tree keeps a goal's goal children and task children apart, and in
    link order.
  - The decomposer visits all of them by their x coordinate. With an
    annotation the order is the annotation's in both; without one, the
    runtime annotation's parallel operands can come out in another order.
- **forAll goals aren't expanded.** That needs the world database, which the
  browser doesn't have.
- **Empty properties print.** piStar gives every element `Description: ""`,
  and the Notation view writes a defined property with an empty value as a
  bare key, so every MutRoSe line has a `Description` under it. Skipping
  empty values would change the view's round trip for every engine.
- **The decomposer's own quirks**, ported as they are:
  - the forAll messages name the lists the other way round;
  - `-v` prints `NC(a;b))`, one parenthesis too many (ours is balanced);
  - an unknown `GoalType` reads as Perform (ours is an error, as an enum).

## Examples

- `examples/mutrose/MedicineDelivery.txt` (written for the workbench)
  exercises:
  - a Query leaf and an Achieve forAll;
  - `FALLBACK`, `NC` from `Group`/`Divisible`;
  - `Params`, `Location` and `RobotNumber`.
- `examples/mutrose/LabSampleLogistics.txt` is mutrose-vscode's test model,
  as its istar-ts editor saved it. Compared with MutRoSe-Docs' original, its
  `G2` (the Query that declares `deliveries_requested`) is gone, and `G3`'s
  AchieveCondition and Group changed. The decomposer would reject it as the
  workbench does: `Undeclared variable [deliveries_requested] of type [] in
  goal G3`.
