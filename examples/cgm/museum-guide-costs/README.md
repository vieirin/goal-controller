# Museum guide, minimum-cost fragment (REJ 2010 Fig. 13)

Ali, Dalpiaz, Giorgini, *A goal-based framework for contextual requirements modeling and analysis*, Requirements Engineering 15 (2010) 439–458. This seed is **Fig. 13**, "Illustration of the minimum-cost core requirements extraction": a fragment of Fig. 2 (`../museum-guide`) with its labels, task costs and cost relations. It also carries Code 3's contributions.

- `museum-guide-costs.txt`: the model (dialect `cgm`).
- `situations/code-3.json`: Code 3 (C14 holds, SG1 priority 3, SG2 priority 1).
- `relations/fig-13.json`: Fig. 13's implication `C13 → C12`.

What Fig. 13 gives, and what the analyses must reproduce (#151 references 1 and 2):

- the variants left after the non-core ones are removed: `V1 = {T1,T3}`, `V2 = {T1,T4}`, `V3 = {T2,T3}`, `V4 = {T2,T4}`, `V5 = {T5,T8,T9}`, `V6 = {T7,T8,T9}`;
- the core groups `{V1…V4}`, `{V5}` and `{V6}`;
- the tasks to develop `{T1,T4,T5,T7,T8,T9}`, which cost 215 and implement `{V2,V5,V6}`;
- the cost of developing all tasks, 340;
- Code 3: G10's variant scores 4 and G11's −2.

## Mapping

Every element keeps Fig. 13's label. The placeholders `[v]` and so on are written `(v)`, because brackets are the goal language's notation.

| Fig. 13 | Kind | Id |
|---|---|---|
| G1–G11 | goals | G1–G11, as labelled |
| T1–T11 | tasks, with Fig. 13's `Cost(Ti, n)` as `cost` | T1–T11 |
| direct [s] to [v] place (unlabelled, AND-refined into T8 and T9) | task, means to G10 | T12 |
| SG1, SG2 | softgoals | SG1, SG2 |
| the dependency G3 → Staff Assistance System, under C10 | depender, dependum, dependee | G3, G3.1, G3.2 |
| C5, C6, C10–C15 | contexts (descriptions from §3.3) | C5, C6, C10–C15 |
| `Include(T2, T1)` | `cgm.IncludesLink` T2 → T1 | |
| `Intersect(T3, T4, 40)`, `Intersect(T3, T5, 20)`, `Intersect(T4, T5, 20)`, `Intersect(T4, T9, 30)` | `cgm.IntersectsLink` with `amount` | |

| Contribution | Label | Properties |
|---|---|---|
| G10 → SG1 (Code 3 line 4, `pos`) | help | |
| G10 → SG2 under C14 (Code 3 line 5, `pos :- phi(c14)`) | help | `context C14`, `opposite !C14` |
| G11 → SG1 (Code 3 line 6, `neg`; dash marks in the figure) | break | |
| G11 → SG2 (Code 3 line 7, `pos`) | help | |

## Readings

1. **Two goals labelled G3** (the visitor's and the staff's): they are a dependency's ends. The dependum is `G3.1` and the staff's goal `G3.2` (#151 D9).
2. **Cost relations as links** (#151 D11). A set's cost is Σ cost minus the overlap of each pair in it, where `Include(T2, T1)` overlaps by T1's whole cost. #151 shows they are not Code 4's resources, because T4's three overlaps sum to 90, more than its cost of 80.
3. **The text's `Intersect(T4, T8, C)`** is the figure's `Intersect(T4, T9, 30)`. The seed follows the figure, which gives the same result because both tasks are in the set.
4. **G10 → SG2's opposite** (`!C14`) is Example 1's reading of Table 1, kind 6. Code 3 states only the positive line, and with C14 true the opposite doesn't apply, so Code 3's scores don't change.
5. **The situation lists C6, C10, C12 and C15 besides C14** (its label says so). Code 3 compares only G10's and G11's variants. Without these contexts no variant of G1 would be applicable in it (G3 needs C6, its dependency C10, G8's T5 C12, G11 C15), and the ranking would have nothing to rank.
6. **The non-core variants.** Fig. 13 lists two (NV1, NV2) and says "replaced by V2". The fragment has seven, and they are replaceable by V5 or V6 (#151's errata). The analyses report that, with the paper's text beside it.
