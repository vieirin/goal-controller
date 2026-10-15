# Museum guide (REJ 2010 Fig. 2 and Fig. 4)

Ali, Dalpiaz, Giorgini, *A goal-based framework for contextual requirements
modeling and analysis*, Requirements Engineering 15 (2010) 439–458:

- **Fig. 2**, the goal model of the museum-guide system with context annotation;
- the contexts **C0–C15** as §3.3 describes them;
- **Fig. 4**, the context analysis of C1;
- Example 2's world predicates of C7 and C8.

Drawn by hand from the figures (no model of it survives, goal-controller#151).

- `museum-guide.txt`: the model (dialect `cgm`).
- `situations/example-1.json`: §4's Example 1 (Fig. 7). Its paper value is an erratum: the formula gives in person −1 and by call +1, while the paper prints 1 and −1 and selects in person.
- `relations/rej-2010.json`: Examples 2–4's relations.

## Mapping

Ids are the paper's labels where it has them (#151 D9). Fig. 2 labels only its contexts. Its elements take **Fig. 13's labels** where Fig. 13 shows them (the same goals and tasks), and the others are numbered on, G12… and T13….

The figures' placeholders `[v]`, `[p]`, `[m]`, `[s]` and `[t]` are written `(v)` and so on, because brackets are the goal language's notation.

| Fig. 2 | Kind | Id |
|---|---|---|
| visitor is assisted | goal, root, `activation C0` | G12 |
| visitor [v] follows museum [m] process and rules | goal, AND child of G12 | G13 |
| visitor [v] gets informed about a piece of art [p] in museum [m] | goal, AND child of G12 under C1 | G1 |
| [v] is out of museum by closing time | goal, AND child of G13 under C2 | G14 |
| [v] accomplishes registration | goal, AND child of G13 under C3 | G15 |
| [v] is notified before closing time | task, means to G14 | T13 |
| [v] is notified to not enter | task, AND child of T13 under C7 | T14 |
| [v] is notified to get out | task, AND child of T13 under C8 | T15 |
| [v] gets info. via terminal [t] | goal, OR child of G1 under C4 | G16 |
| [v] gets info via his/her PDA | goal, OR child of G1 under C5 | G2 |
| [v] gets info through [m] staff [s] | goal, OR child of G1 under C6; depender | G3 |
| [v] is notified for the service through [v]'s PDA | goal, AND child of G16 | G17 |
| [v] arrives to [t] | goal, AND child of G16 | G18 |
| [v] know how to use [t] | goal, AND child of G16 | G19 |
| send [v] a voice command | task, means to G17 under C9 | T16 |
| alert [v] via PDA vibration and SMS | task, means to G17 under ¬C9 (`!C9`) | T17 |
| direct [v] to [t] place | task, means to G18 | T18 |
| show demo to [v] how to use [t] | task, means to G19 | T19 |
| [p] info suitable to [v] is prepared | goal, AND child of G2 | G4 |
| [p] info is presented to [v] | goal, AND child of G2 | G5 |
| prepare [p] brief simple information | task, means to G4 | T1 |
| prepare [p] detailed information | task, means to G4 | T2 |
| [p] info is presented to [v] via video | task, means to G5 | T3 |
| [v] info is presented to [v] interactively | task, means to G5 | T4 |
| (the dependency, under C10) | dependum | G3.1 |
| [v] gets info through [m] staff [s] (Staff) | goal, root of the staff's tree; dependee | G3.2 |
| [s] is alerted | goal, AND child of G3.2 | G6 |
| [s] gives [p] info to [v] | goal, AND child of G3.2 | G7 |
| [s] is alerted through [s]'s PDA | goal, OR child of G6 | G8 |
| [s] is alerted through public call | goal, OR child of G6 under C11 | G9 |
| [s] is alerted via ringing tone and SMS | task, means to G8 under C12 | T5 |
| send [s] a voice command | task, means to G8 under C13 | T6 |
| make a call through speakers in [s] current room | task, means to G9 | T7 |
| [s] gives [p] info to [v] in person | goal, OR child of G7 | G10 |
| [s] gives [p] info to [v] by call | goal, OR child of G7 under C15 | G11 |
| direct [s] to [v] place (the upper one) | task, means to G10 | T12 |
| show [v] picture | task, AND child of T12 | T8 |
| direct [s] to [v] place (the lower one) | task, AND child of T12 | T9 |
| make video call between [s] and [v] | task, means to G11 | T10 |
| make voice call between [s] and [v] | task, means to G11 | T11 |
| visitor well informed | softgoal | SG1 |
| staff is more comfortable | softgoal | SG2 |
| calm museum | softgoal | SG3 |

| Contribution (Fig. 2) | Label | Properties |
|---|---|---|
| in person → visitor well informed, × | help | |
| in person → staff is more comfortable, × at C14 | help | `context C14`, `opposite !C14` |
| by call → visitor well informed, - - | break | |
| by call → staff is more comfortable, × | help | |
| ringing tone and SMS → calm museum, - - | break | |
| voice command → calm museum, × | help | |
| call through speakers → calm museum, - - | break | |

| Fig. 4 / Example 2 | Kind | Id | Supported by / formula |
|---|---|---|---|
| C1 | context | C1 | `F1.1 & ST1.2` ("C1 applies if wp1 & α") |
| wp1 = visitor is inside the gallery building | fact | F1.1 | |
| wp2 = visitor [v] is interested in getting explanation … | statement | ST1.2 | `ST1 & ST2 & ST3 & ST4` |
| w1 = [v] is in a place where [p] can be still of interest | statement | ST1 | `(F1 & F2) \| F3` |
| w2 = there is still time to accomplish explanation … | statement | ST2 | `ST5 & F8` |
| w3 = [p] is interesting to [v] | statement | ST3 | `ST8 \| ST9` |
| w4 = [v] does not already know about [p] | statement | ST4 | `F14 \| F15` |
| w5 = [v] is not in a hurry | statement | ST5 | `ST6 \| ST7` |
| w6 = [v] does not have to work | statement | ST6 | `(F4 \| F5) & F6` |
| w7 = [v] behaves in calm way | statement | ST7 | `F7` |
| w8 = [v] historically interested in [p] | statement | ST8 | `F9 \| F10 \| F11` |
| w9 = [v] behaviorally interested in [p] | statement | ST9 | `F12 \| F13` |
| f1–f15 | facts | F1–F15 | |
| C7 = wp7.1, "visitor is on the way to enter the museum" | context, fact | C7, F7.1 | C7: `F7.1` |
| C8 = wp8.1 ∧ wp8.2 | context, facts | C8, F8.1, F8.2 | C8: `F8.1 & F8.2` |

## Readings

1. **wp1 and wp2** are numbered as IST 2013 numbers a context's world predicates (`wp1.1`, `wp1.2`). REJ's Fig. 4 has no context index on them.
2. **α, as printed under Fig. 4**, has one parenthesis too few: `((f1 & f2) v f3) & ((f4 v f5) & f6) v f7) & …`. The figure's tree gives `(((f4 ∨ f5) ∧ f6) ∨ f7)`. The seed follows the tree, and a test checks that ST1.2's support, expanded to facts, is equivalent to α with the parenthesis restored.
3. **[v] accomplishes registration** has nothing under it in Fig. 2, so it is a leaf goal.
4. **The dependency.** Fig. 2 draws it from the visitor's "[v] gets info through [m] staff [s]" to the Staff Assistance System, and the staff's tree has a root with the same name. The seed has a dependum (`G3.1`) and the staff's goal as its dependee (`G3.2`), which is the iStar 2.0 form. Fig. 13 labels both goals G3.
5. **Contribution signs: the mark decides, not the line.** A cross (×, a `+` drawn along the line) is positive (`help`), and dash marks (`- -`) are negative (`break`, Fig. 1's `--`). In person → staff is more comfortable is `+` with C14. §3.3 (kind 6) and Example 1 make it negative when C14 is false, so it has `opposite = !C14` (#151 D10).
6. **The context descriptions** are §3.3's sentences, as written there, and are the contexts' names too. Fig. 4's `f8 = > 30 minutes until [m] closes` is named "more than 30 minutes until (m) closes", because `>` can't be in a name.
7. **Example 3's relation.** Example 3 names no world predicates for "C7 contradicts C1". The relation is written over C1's and C7's facts, `!F7.1 | !F1.1`: one can't be on the way into the museum and inside the gallery building.
8. **Fig. 9's `C7 & ¬C8`** is the variant's literals (T14 kept under C7, T15 dropped), not a context written on a link.
