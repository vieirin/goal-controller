# edgeV2 vs EDGE reference — AFTER the fixes (PRISM, same 6 models as the baseline)

_Outputs generated 2026-09-26 by the edgeV2 engine at e9eb9ef + uncommitted engine changes · report rendered 2026-09-26 · 6 models (3 from the EDGE reference suite, 3 free-form)_

## Verdict

✅ **edgeV2 produces the same PRISM model as the EDGE reference for all 4 models the reference can express** (every rule and formula behaves the same).

2 further models use notation the reference cannot express (goals with one child or no operator, custom retry counts); edgeV2 generated 2 of them without errors.

✅ **PRISM 4.9:** 6/6 edgeV2 models built and checked; 57/57 properties hold; the probability of achieving the root goal equals the reference in 4/4 models.

## What was checked

- **Reference models** come from the EDGE fuzzer (`EDGE-XT/code/evaluation/goal_fuzzer.py`). Their goal trees are rebuilt, written as goal models in edgeV2 notation, and converted by edgeV2.
- **Structure:** every PRISM rule and formula in the edgeV2 output is compared with the reference. Names are translated first (edgeV2 writes `g0_state` where the reference writes `gG0`). Two rules count as the same when they fire in exactly the same situations (checked on 400 random states) and have the same effect.
- **Free-form models** exercise the notation beyond the reference: tasks at any depth, 1–4 children, every operator, custom retry counts and goals without notation.
- **Model checking (PRISM 4.9):** each model is built and checked: the reference's own properties (translated to edgeV2 names) must hold, and the probability of eventually achieving the root goal is compared with the reference model under the same decision thresholds (the values the EDGE fuzzer uses: decision_X = 0.2·N, _decision_X = (N−1)/#children).

## Results by goal type

| Goal type | Notation | What it does | Compared with reference | Same as reference | Main problem |
|---|---|---|---|---|---|
| Sequence | `[A;B]` | does every child, one after another, in the written order | 3 | 3/3 ✅ | — |
| Any order | `[A+B]` | does every child, one at a time, in any order | 1 | 1/1 ✅ | — |
| Interleaved | `[A#B]` | does every child, possibly at the same time | 1 | 1/1 ✅ | — |
| Alternative | `[A|B]` | needs one child; picks again after every failed attempt | 4 | 4/4 ✅ | — |
| Choice | `[A?B]` | needs one child; picks once and sticks with it | 2 | 2/2 ✅ | — |
| Degradation | `[A@3->B]` | retries the first child up to n times, then falls back to any child | 1 | 1/1 ✅ | — |
| AND without notation | `` | no operator written; edgeV2 treats it as interleaved | 0 | not in reference (generated 4) | — |
| OR without notation | `` | no operator written; edgeV2 treats it as alternative | 0 | not in reference (generated 1) | — |
| Task | `` | a leaf that succeeds with its achievability probability | 16 | 16/16 ✅ | — |

## Defects in the reference that edgeV2 does not copy

These are corrected in the reference before comparing, so they do not count as differences.

- **Choice goals could never give up on their chosen child** (4 occurrences). In the reference, the rule that lets a choice goal give up once its chosen child is no longer worth pursuing requires the goal to be active and inactive at the same time (`g<id>=1 & g<id>=0`), so it can never fire and the goal gets stuck. The intent is clearly "the chosen child is idle" (`g<child>=0`); edgeV2 implements that.
- **Choice-goal properties are glued together in the .pctl file** (2 occurrences). The reference writes the "only the chosen child runs" properties without a line break between them, so PRISM cannot parse them. A newline is inserted.

## Model checking results (PRISM 4.9)

| Model | edgeV2 model | Properties holding | P(root goal achieved) edgeV2 | reference | Same |
|---|---|---|---|---|---|
| `reference/random_N10_d2_w2_000` | ✅ built | 13/13 ✅ | 1.0 | 1.0 | ✅ |
| `reference/random_N10_d2_w2_001` | ✅ built | 4/4 ✅ | 1.0 | 1.0 | ✅ |
| `reference/random_N10_d2_w2_002` | ✅ built | 12/12 ✅ | 1.0 | 1.0 | ✅ |
| `freeform/freeform_000` | ✅ built | 13/13 ✅ | 1.0 | 1.0 | ✅ |
| `freeform/freeform_001` | ✅ built | 8/8 ✅ | 1.0 | n/a | — |
| `freeform/freeform_002` | ✅ built | 7/7 ✅ | 1.0 | n/a | — |

## Models

Each model folder holds `goal.txt` (edgeV2 input), `edgev2.prism` (output), `reference.prism` when the reference can express it, and `findings.json` with the raw differences.

| Model | Structure | Result |
|---|---|---|
| `reference/random_N10_d2_w2_000` | G0 needs one of G1 and G4 (alternative); G1 does T2 then T3; G4 needs one of T5 and T6 (choice, fixed once picked) | ✅ same as reference |
| `reference/random_N10_d2_w2_001` | G0 needs one of G1 and G4 (alternative); G1 does T2 and T3 in parallel; G4 needs one of T5 and T6 (alternative) | ✅ same as reference |
| `reference/random_N10_d2_w2_002` | G0 tries G1 up to 3×, then any of G1 and G4; G1 does T2 then T3; G4 does T5 and T6 in any order | ✅ same as reference |
| `freeform/freeform_000` | G0 needs one of G1 and G4 (alternative); G1 does T2 then T3; G4 needs one of T5 and T6 (choice, fixed once picked) | ✅ same as reference |
| `freeform/freeform_001` | G0 needs G1 and G11 (AND, no notation); G1 needs one of G2, T6 and G7 (OR, no notation); G2 does T3 then T4 then T5; G7 does T8 then T9 then T10; G11 does G12 and G14 in any order; G12 needs T13 (AND, no notation); G14 … | generated (no reference for this notation) |
| `freeform/freeform_002` | G0 does G1 then G4; G1 needs T2 and T3 (AND, no notation); G4 needs G5, T18 and T19 (AND, no notation); G5 needs one of G6, G9 and G13 (choice, fixed once picked); G6 does T7 and T8 in parallel; G9 does T10, T11 and T12… | generated (no reference for this notation) |
