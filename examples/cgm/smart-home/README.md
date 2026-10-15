# Smart home for a patient with dementia (IST 2013 Fig. 1, Table 2, Fig. 2)

Ali, Dalpiaz, Giorgini, *Reasoning with contextual requirements: detecting inconsistency and conflicts*, Information and Software Technology 55 (2013) 35–57:

- **Fig. 1**, a partial Tropos goal model for the smart-home case study;
- its contexts **ϕ0–ϕ16**, described in **Table 2**;
- **Fig. 2**, the context analysis of ϕ1.

The seed is used for variants and context consistency (§4.1). Task effects and conflicts (§4.2) are out of this round (#151 D6).

- `smart-home.txt`: the model (dialect `cgm`).
- `relations/ist-2013.json`: §4.1's contradictions: ϕ1 against ϕ7 (Example 1, Fig. 6), and ϕ7 against ϕ10.
- `situations/anxious-at-night.json`: ours, derived by hand. Its facts make ϕ1 hold through Fig. 2's analysis.

## Mapping

| IST 2013 | Kind | Id |
|---|---|---|
| G0–G14, as labelled (G0 under ϕ0) | goals | G0–G14 |
| T1–T14, as labelled | tasks | T1–T14 |
| make relaxation effects (unlabelled, OR-refined into T6 and T7) | task, means to G10 | T15 |
| police is notified (unlabelled, AND-refined into T11–T13) | task, means to G13 | T16 |
| SG1 patient privacy, SG2 energy spent wisely, SG3 less noise | softgoals | SG1–SG3 |
| G14 → Neighbor Smart home, under ϕ13 | depender, dependum, dependee actor | G14, G14.1, Neighbor Smart home |
| ϕ0–ϕ16 | contexts (description and technology from Table 2) | C0–C16 |
| f1–f10 (Fig. 2) | facts | F1–F10 |
| st1–st6 (Fig. 2) | statements | ST1–ST6 |
| wp7.1, wp7.2 (§4.1, ϕ7), wp10.1 (ϕ10) | facts | F7.1, F7.2, F10.1: **not** related to F7 (f7, lying in bed) or F10 (f10, irregular breathing); the dotted ids are §4.1's per-context numbering |

Where each context sits, as Fig. 1 draws it:
- ϕ0 is G0's `activation`.
- ϕ1, ϕ2 sit on G0's AND children G1, G2; ϕ7, ϕ8 on G3's, G6 and G7.
- ϕ3, ϕ4 sit on G1's OR children G4, G5.
- ϕ5 sits on T8's means-end to G2; ϕ9, ϕ10 on T4's and T5's to G9.
- ϕ11 sits on T6's OR refinement of T15; ϕ12 on T12's AND refinement of T16.
- ϕ13 sits on the dependency.
- ϕ6 and ϕ5 also sit on contributions (below).

| Contribution (Fig. 1) | Label | Properties |
|---|---|---|
| T8 open windows → SG1 patient privacy, × at ϕ6 | help | `context C6`, `opposite !C6` |
| T8 open windows → SG2 energy spent wisely, × | help | |
| T9 turn on air ventilator → SG1 patient privacy, × | help | |
| T9 turn on air ventilator → SG2 energy spent wisely, - - at ϕ5 | break | `context C5` |
| T4 call caregiver by phone → SG3 less noise, × | help | |
| T5 call caregiver by public call → SG3 less noise, - - | break | |

## Readings

1. **Contribution signs: the mark decides, not the line.** A cross (×) is positive (`help`), and dash marks (`- -`) are negative (`break`). Two contributions are readings:
   - **T8 → SG1** is drawn `+` under ϕ6 ("the patient is outside home"), but §3 says "open windows contributes negatively to patient privacy". Read with Table 1, kind 6, it is positive iff ϕ6 and negative iff ¬ϕ6: `help {context C6} {opposite !C6}` (#151 D10).
   - **T9 → SG2** carries dash marks under ϕ5: `break {context C5}`.
2. **Table 2's technology** is per context, and a fact's `technology` is per fact. Contexts without an analysis keep it in their `description` ("… Technology: …").
3. **ϕ1's formula, as printed above Fig. 2**, is `f1 ∧ (f2 ∧ f3 ∧ f4) ∨ f5 ∨ f6 ∨ (…)`, missing the parenthesis after `∧`. The tree gives `f1 ∧ st1`, with st1 supported by `st2 ∨ st3 ∨ st4`, and the seed follows the tree.
4. **ϕ7's and ϕ10's world predicates** come from §4.1 (`wp7.1`, `wp7.2`, `wp10.1`), and Example 1's ϕ1 is Fig. 2's (`f1` "patient at home" is §4.1's `wp1.1`). §4.1 prints "ϕ7 → ¬ϕ10 because wp7.1 → ¬wp10.1". It is wp7.2 ("it is night time") that contradicts wp10.1 ("it is not night time"), so the relation is written over F7.2.
5. **The dependee is the actor.** Fig. 1 draws Neighbor Smart home with no goals, so the variant stops at the dependum G14.1.
6. **Contexts as names.** Table 2's sentences are the contexts' names, with a capital lowered and the last full stop dropped.
