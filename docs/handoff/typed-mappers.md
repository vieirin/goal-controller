# Handoff: typed mapper props, per-kind entries and their follow-ups

State as of 2026-10-17, main at `538bc4b5` (after #268). This file is the single plan for
the work started under #187. Follow it top to bottom. Do not re-open a decision listed in
"Decisions already made"; if something here contradicts what you find in the code, stop and
ask the user instead of improvising.

Out of scope: the KAOS stress tests (#181, #182, #189–#214). Don't touch them.

## Rules (apply to every step)

1. **One PR per step**, branched from the latest `origin/main`, in its own git worktree under
   `.claude/worktrees/<name>`. Never work in the main checkout
   (`/Users/vieira/vieirin/goal-controller`): it is the user's, on their own branch.
2. **Rebase onto `origin/main` right before opening or re-running CI.** A PR that branched
   before another merged can be green locally and red on main (that is how #253 happened).
3. **Merge gate is CI only.** Required jobs: `test`, `stress:cgm`, `stress:goda`,
   `stress:grl`, `stress:istardt`, `stress:tropos4as`. `test-prism-model`, Vercel and
   CodeRabbit are **not** gates. Check each required job **by name** is `pass` before
   merging (script below). Never merge while one is `fail` or `pending`.
4. **A stress job failing with `403 rate limit exceeded`** in its fetch step is infrastructure
   (#271), not the change: re-run the failed jobs once with `gh run rerun <run-id> --failed`.
   Any other failure is real.
5. **Behaviour is pinned.** `packages/lib/test/engines/*/mapperCharacterization.test.ts` and
   `edgeFamily/checksCharacterization.test.ts` pin every engine's output. A PR that changes a
   pinned value must mark the test line with the issue number and list the change in the PR
   body. Unlisted changes are bugs.
6. **Every finding is a new GitHub issue**, never a comment on an existing issue. Comments are
   for decisions and status only. An issue has: problem, repro, impact, proposed fix,
   sequencing, `Related:` links.
7. **Merge with a merge commit** (`gh pr merge <n> --merge`). Never bump `version` in any
   `package.json`.
8. Commit messages end with the attribution line the harness gives you; PR bodies end with
   `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
9. Local verification before opening a PR: `pnpm test` (builds lib first), `pnpm lint`
   (13 warnings on main is the baseline; 15 until #272), `pnpm format:check` (main has
   pre-existing failures; only your files matter), `cd packages/ui && npx tsc --noEmit -p .`.
   Don't run the stress scripts locally unless the step says so; CI runs them.

### Merge script (use exactly this)

```sh
pr=<number>
gates() { gh pr checks $pr 2>/dev/null | awk -F'\t' '$1=="test"||$1~/^stress:/{print $1"\t"$2}'; }
for i in $(seq 1 80); do
  out=$(gates); n=$(echo "$out" | grep -c .)
  p=$(echo "$out" | awk -F'\t' '$2=="pass"' | grep -c .)
  f=$(echo "$out" | awk -F'\t' '$2=="fail"' | grep -c .)
  [ "$f" -gt 0 ] && { echo FAILED; echo "$out"; break; }
  [ "$n" -ge 6 ] && [ "$p" -eq "$n" ] && { gh pr merge $pr --merge; break; }
  sleep 15
done
gh pr view $pr --json state -q .state
```

If it prints `FAILED`, read the log: `gh run view --job <job-id> --log-failed`.

## What is done (don't redo)

| Issue | PR | What landed |
| --- | --- | --- |
| #187 | #218, #241, #221, #250, #245 | mappers get `props` (typed from the dialect), `raw` (strings), `text` (the line); every engine reads `props` |
| #188 | #220 | value types carry their operations as non-enumerable members (`assertion.variables()`, `refList.refs()`, …) |
| #215 step 1 | #258 | goal-tree per-kind entries, `as` naming, `useIstarDefaultNaming`, roots per actor, link graph; old `mapGoalProps` API kept as sugar |
| #222, #257 | #268 | checks receive `{ props, raw, kind }`; `kindOf` answers dialect kinds |
| #224, #228 | #223 | multi-line text values read whole; open-enum multi-line reported |
| #227 | #242 | case-insensitive enums |
| #235 | #246 | typed pairList members |
| #247 | #248 | goal-language tests type-checked |
| #249, #253 | #252, #254 | int min/max applied by the reader; hotfix for pinned tests |
| #251 | #255 | edge `variables` typed, last edge parser gone |
| #225 | #256 | blank SLEEC Obstacle unset |
| #259, #260 | #261, #262 | goal-tree link exhaustiveness, test type-check |
| #234 | #263 | conditions compare trimmed |
| #231 | #264 | unreadable GODA cost bracket is no cost |
| #243 | #265 | references resolve against the model (`readProperties(..., { kindOf })`) |
| #232 | #267 | `assertion` value with a `separator` (list of conditions) |

## Decisions already made

- `props` typed, `raw` strings as written, `text` the element's line.
- A value the dialect can't read (syntax, bounds, unknown reference) is `undefined` in
  `props`, kept in `raw`, reported by the dialect's checks. The mapper never parses text.
- **Exception:** when dropping a value would change what an engine generates (a dangling
  `dependsOn` in Edge), the engine must still refuse to generate. See step 1 and #274.
- The dialect is the truth about what a kind has; the data is the truth about key names
  (#230: read `ObstacleEvent`, don't rename keys in existing models).
- Roles are not in the dialect. goal-tree exposes roots and links; the engine names kinds
  in its entries (`as`). Pure-iStar engines use `useIstarDefaultNaming`.
- #238: analyses **exclude** a variant whose context is unreadable (the dialect's diagnostic
  is what the user sees); the opposite check compares assertion trees structurally, with
  `&` / `|` operands in canonical order.
- #270: `crossRun` / `exported` are `refList` over several kinds (goal, task, quality,
  `istardt.Predicate`, `istardt.Variable`).

## The pool, in order

Each step names its owner role. "Language" steps touch `packages/dialect`,
`packages/goal-language`, `packages/goal-tree` only. "Engine" steps touch `packages/lib` (and
`packages/ui` if needed) only. Two agents may run one language step and one engine step at
the same time; never two steps that touch the same package.

### Step 1 (language): finish PR #273, refList of several kinds (#270)

Branch `blue/reflist-kinds`, worktree `.claude/worktrees/blue-reflist-kinds`. CI is green
**but do not merge it as it is.** It makes Edge's `dependsOn` naming a missing node or a
non-goal read as unset, so Edge generates without the dependency.

1. In `packages/lib/src/engines/edgeFamily/mapper.ts`, where `dependsOn` is read: if
   `raw.dependsOn` is non-blank and `props.dependsOn` is `undefined`, throw with exactly the
   messages main throws today (`Dependency G99 not found…`, `… must be a goal, got task`).
2. Revert the edits #273 made to Edge's characterization test. They must pass unchanged.
3. Rebase, push, run the merge script.

### Step 2 (engine): #215 step 2, engines onto entries, four PRs

Worktrees already exist with local branches (not pushed): `red/entries-edge`
(`agent-ac7abccc3c798f789`, has a #236 pin commit), `red/entries-mutrose-goda`
(`agent-a453c98fe32ffc239`, has a GODA cost commit), `red/entries-cgm-grl-istardt-tropos4as`
and `red/entries-sleec-kaos-nfr` (both at main, nothing yet). Rebase each onto main after step 1.

Read first: PR #258's body and `packages/goal-tree/README.md`. Facts from them: `entry()` is
overloaded to keep `as` literal; `createEngineMapper` has two overloads (with and without
`links`); link entries are required wherever the dialect gives link kinds properties, and a
link kind without an entry gets `{}`; `KindNode<P, N, S>`; `model.elements[].engine` is set
only for kinds with `tree: false`; `ignore: [...]` replaces `skipResource` and never visits
the kind (a Resource with children no longer throws: list it as intentional).

Pure-iStar engines (edge, edgeV2, goda, mutrose, sleec) should need
`useIstarDefaultNaming` plus their `mapProps` and nothing else.

- **2a** edge + edgeV2. Also: #233 (dependsOn holds the tree's node, not a stale copy), #266
  (the mapper rejects a dependsOn naming a quality, same message as the check), #236 (rewards
  template reads typed utility/cost; dialect `min: 0`).
- **2b** mutrose + goda. Also: GODA's mapper reads `props.creationProperty` (an `Assertion[]`,
  from #267) and drops `contextsOf`; GODA's template drops the `!` on `node.cost.value`
  (`goda/template/formulas.ts:173`, `formulas5305bc1.ts:199`) and handles `null`.
- **2c** cgm + grl + istardt + tropos4as. Add entries for their extension kinds (cgm.Context,
  cgm.Fact, cgm.Statement; grl.Belief, grl.Indicator; istardt.Condition, Effect, EffectGroup,
  Predicate, Variable; tropos4as.Artifact, Error, Failure, Symptom) and drop their
  `model.elements` reads. Also: #240 (`TRUE` in a tropos4as condition is the constant), #238
  (both decisions above; put structural assertion comparison in goal-language as a member if
  it's more than a few lines; that one change may touch goal-language, say so in the PR).
- **2d** sleec + kaosdoc + kaosprop + nfrprop, each with its own naming (replaces goal-tree's
  `FRAMEWORK_NODE_TYPES`). Also: #226 and #244 (hub `Category`, `initialLabel`, ESR/RSR/
  Probability read through entries, `tree: false` where they aren't tree nodes), #229 (kaos
  dialect's `schemaProperties` returns a tuple so props are typed per key), #230 (dialect and
  mapper read `ObstacleEvent`), and drop kaosdoc's "anchored on nowhere" handling (#243 makes
  the anchor unset).
- **2e** after 2a–2d are all merged: remove the `mapGoalProps` / `mapTaskProps` /
  `mapResourceProps` sugar and the 3-parameter aliases from goal-tree. This is the only engine
  step that touches goal-tree; nothing else may be in goal-tree at the same time.

Open 2a–2d as each is ready; they touch different engines. Merge in any order.

### Step 3 (engine, after 2c merges): #217, writers on typed values (+ #269, #270)

- iStarDT-X writer: take `readIstardtModel`'s typed values (root/terminal/satisfying,
  episodeLength, set, formula trees, probability, weight, exportMin/Max) instead of parsing.
  Set `crossRun` / `exported` to the multi-kind refList from step 1 in
  `istardt/definition.ts` and read the typed list (no hand split).
- jUCM writer: read through `grlReading()` / `viewValues` like `grlGraph`, replacing `pick()`
  and `integer()`. Pin a 150 importance and a 300 contribution writing the default (#269).
- XML→piStar importers and geometry are out of scope.

### Step 4 (engine, after step 2): #237, then #239

- #237 mutrose: RobotNumber rejects `[3,1]` and `0` (dialect or check, not mapper parsing);
  blank values handled the same way everywhere; fix the wrong "decomposer warns" comment.
- #239 istardt: check initializations before writing (`moisture:abc`); the writer's messages
  for an unreadable formula and a blank probability say what is wrong.

### Anytime, small, independent

- #272: remove the unused `PropertyTexts` / `PropertyValues` imports in
  `packages/goal-tree/src/internal/entries.ts` (goal-tree: don't run it during 2e).
- #271: `scripts/goda-stress/fetch.cjs` sends `Authorization: Bearer $GITHUB_TOKEN` when set;
  the stress workflow passes `GITHUB_TOKEN`; or cache the pinned corpus. Check the other
  stress scripts for the same pattern.

### Needs the user's decision before anyone starts

- #274: should generation refuse when the dialect reports an error on a property the engine
  reads (one gate in `packages/lib/src/engines/engine.ts`), or keep per-engine guards like
  step 1's? Recommendation in the issue: one gate.

### Backlog from the same day, not started, after everything above

#185 (framework-aware model types, drop `as unknown as IStarModel`), #186 (an element id read
across spaces), #172 (OCL vocabulary defined twice), #171's deferred items.

## Worktrees

Merged-PR worktrees can be removed (`git worktree remove <path>`) once you've confirmed their
branch is merged: every `blue-*` except `blue-reflist-kinds` and `blue-kaos-dialect`; the
`red/typed-*` agent worktrees; `red-typed-engines`; `/private/tmp/gc-review-242`. Keep:
`blue-reflist-kinds` (step 1), the four `red/entries-*` worktrees (step 2), and every `vn/*`,
`fix/*` and the user's other worktrees (`atomic-brewing-owl`, `hashed-drifting-micali`,
`home-by-framework`, `luminous-dreaming-snail`, `sts-*`, `blue-kaos-dialect`): not part of
this plan, don't touch.
