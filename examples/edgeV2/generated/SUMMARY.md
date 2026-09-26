# edgeV2 vs EDGE reference — example set

_Outputs generated 2026-09-26 by the edgeV2 engine at e9eb9ef + uncommitted engine changes · report rendered 2026-09-26 · 39 models (9 from the EDGE reference suite, 30 free-form)_

## Verdict

✅ **edgeV2 produces the same PRISM model as the EDGE reference for all 21 models the reference can express** (every rule and formula behaves the same).

18 further models use notation the reference cannot express (goals with one child or no operator, custom retry counts); edgeV2 generated 18 of them without errors.

✅ **Storm 1.14:** 38/39 edgeV2 models built and checked; 691/691 properties hold; the probability of achieving the root goal equals the reference in 21/21 models. 1 model(s) were too large to check within the time/memory limits (not an error in the model).

## What was checked

- **Reference models** come from the EDGE fuzzer (`EDGE-XT/code/evaluation/goal_fuzzer.py`). Their goal trees are rebuilt, written as goal models in edgeV2 notation, and converted by edgeV2.
- **Structure:** every PRISM rule and formula in the edgeV2 output is compared with the reference. Names are translated first (edgeV2 writes `g0_state` where the reference writes `gG0`). Two rules count as the same when they fire in exactly the same situations (checked on 400 random states) and have the same effect.
- **Free-form models** exercise the notation beyond the reference: tasks at any depth, 1–4 children, every operator, custom retry counts and goals without notation.
- **Model checking (Storm 1.14):** each model is built and checked: the reference's own properties (translated to edgeV2 names) must hold, and the probability of eventually achieving the root goal is compared with the reference model under the same decision thresholds (the values the EDGE fuzzer uses: decision_X = 0.2·N, _decision_X = (N−1)/#children).

## Results by goal type

| Goal type | Notation | What it does | Compared with reference | Same as reference | Main problem |
|---|---|---|---|---|---|
| Sequence | `[A;B]` | does every child, one after another, in the written order | 24 | 24/24 ✅ | — |
| Any order | `[A+B]` | does every child, one at a time, in any order | 23 | 23/23 ✅ | — |
| Interleaved | `[A#B]` | does every child, possibly at the same time | 22 | 22/22 ✅ | — |
| Alternative | `[A|B]` | needs one child; picks again after every failed attempt | 14 | 14/14 ✅ | — |
| Choice | `[A?B]` | needs one child; picks once and sticks with it | 16 | 16/16 ✅ | — |
| Degradation | `[A@3->B]` | retries the first child up to n times, then falls back to any child | 19 | 19/19 ✅ | — |
| AND without notation | `` | no operator written; edgeV2 treats it as interleaved | 0 | not in reference (generated 25) | — |
| OR without notation | `` | no operator written; edgeV2 treats it as alternative | 0 | not in reference (generated 20) | — |
| Task | `` | a leaf that succeeds with its achievability probability | 148 | 148/148 ✅ | — |

## Defects in the reference that edgeV2 does not copy

These are corrected in the reference before comparing, so they do not count as differences.

- **Choice goals could never give up on their chosen child** (33 occurrences). In the reference, the rule that lets a choice goal give up once its chosen child is no longer worth pursuing requires the goal to be active and inactive at the same time (`g<id>=1 & g<id>=0`), so it can never fire and the goal gets stuck. The intent is clearly "the chosen child is idle" (`g<child>=0`); edgeV2 implements that.
- **Choice goals with more than two children overflow their memory variable** (1 occurrences). The reference always declares `g<id>_chosen: [0..2]`. With a third child it assigns `g<id>_chosen'=3`, which PRISM rejects. edgeV2 declares one value per child.
- **Choice-goal properties are glued together in the .pctl file** (17 occurrences). The reference writes the "only the chosen child runs" properties without a line break between them, so PRISM cannot parse them. A newline is inserted.

## Model checking results (Storm 1.14)

| Model | edgeV2 model | Properties holding | P(root goal achieved) edgeV2 | reference | Same |
|---|---|---|---|---|---|
| `reference/random_N10_d2_w2_000` | ✅ built | 13/13 ✅ | 1.0 | 1.0 | ✅ |
| `reference/random_N10_d2_w2_001` | ✅ built | 4/4 ✅ | 1.0 | 1.0 | ✅ |
| `reference/random_N10_d2_w2_002` | ✅ built | 12/12 ✅ | 1.0 | 1.0 | ✅ |
| `reference/random_N10_d3_w2_000` | ✅ built | 20/20 ✅ | 1.0 | 1.0 | ✅ |
| `reference/random_N10_d3_w2_001` | ✅ built | 25/25 ✅ | 1.0 | 1.0 | ✅ |
| `reference/random_N10_d3_w2_002` | ✅ built | 23/23 ✅ | 1.0 | 1.0 | ✅ |
| `reference/random_N10_d4_w2_000` | ✅ built | 53/53 ✅ | 1.0 | 1.0 | ✅ |
| `reference/random_N10_d4_w2_001` | ✅ built | 47/47 ✅ | 1.0 | 1.0 | ✅ |
| `reference/random_N10_d4_w2_002` | ✅ built | 43/43 ✅ | 0.0 | 0.0 | ✅ |
| `freeform/freeform_000` | ✅ built | 13/13 ✅ | 1.0 | 1.0 | ✅ |
| `freeform/freeform_001` | ✅ built | 8/8 ✅ | 1.0 | n/a | — |
| `freeform/freeform_002` | ✅ built | 7/7 ✅ | 1.0 | n/a | — |
| `freeform/freeform_003` | ✅ built | 7/7 ✅ | 1.0 | 1.0 | ✅ |
| `freeform/freeform_004` | ✅ built | 13/13 ✅ | 1.0 | n/a | — |
| `freeform/freeform_005` | ✅ built | 34/34 ✅ | 1.0 | n/a | — |
| `freeform/freeform_006` | ✅ built | 13/13 ✅ | 1.0 | 1.0 | ✅ |
| `freeform/freeform_007` | ✅ built | 7/7 ✅ | 1.0 | n/a | — |
| `freeform/freeform_008` | ✅ built | 24/24 ✅ | 0.0 | n/a | — |
| `freeform/freeform_009` | ✅ built | 4/4 ✅ | 1.0 | 1.0 | ✅ |
| `freeform/freeform_010` | ✅ built | 15/15 ✅ | 1.0 | n/a | — |
| `freeform/freeform_011` | ✅ built | 27/27 ✅ | 1.0 | n/a | — |
| `freeform/freeform_012` | ✅ built | 9/9 ✅ | 1.0 | 1.0 | ✅ |
| `freeform/freeform_013` | ✅ built | 8/8 ✅ | 1.0 | n/a | — |
| `freeform/freeform_014` | ✅ built | 17/17 ✅ | 1.0 | n/a | — |
| `freeform/freeform_015` | ✅ built | 10/10 ✅ | 1.0 | 1.0 | ✅ |
| `freeform/freeform_016` | ✅ built | 12/12 ✅ | 1.0 | n/a | — |
| `freeform/freeform_017` | ✅ built | 25/25 ✅ | 1.0 | n/a | — |
| `freeform/freeform_018` | ✅ built | 7/7 ✅ | 1.0 | 1.0 | ✅ |
| `freeform/freeform_019` | ✅ built | 36/36 ✅ | 1.0 | 1.0 | ✅ |
| `freeform/freeform_020` | ✅ built | 13/13 ✅ | 1.0 | n/a | — |
| `freeform/freeform_021` | ✅ built | 12/12 ✅ | 1.0 | 1.0 | ✅ |
| `freeform/freeform_022` | ✅ built | 8/8 ✅ | 1.0 | n/a | — |
| `freeform/freeform_023` | ✅ built | 16/16 ✅ | 1.0 | n/a | — |
| `freeform/freeform_024` | ✅ built | 13/13 ✅ | 1.0 | 1.0 | ✅ |
| `freeform/freeform_025` | ✅ built | 19/19 ✅ | 1.0 | 1.0 | ✅ |
| `freeform/freeform_026` | ✅ built | 59/59 ✅ | 1.0 | n/a | — |
| `freeform/freeform_027` | ✅ built | 10/10 ✅ | 1.0 | 1.0 | ✅ |
| `freeform/freeform_028` | ✅ built | 5/5 ✅ | 1.0 | n/a | — |
| `freeform/freeform_029` | ⚠️ too large to check (ERROR: The program received signal 15 and will be aborted i…) | | | | |

## Models

Each model folder holds `goal.txt` (edgeV2 input), `edgev2.prism` (output), `reference.prism` when the reference can express it, and `findings.json` with the raw differences.

| Model | Structure | Result |
|---|---|---|
| `reference/random_N10_d2_w2_000` | G0 needs one of G1 and G4 (alternative); G1 does T2 then T3; G4 needs one of T5 and T6 (choice, fixed once picked) | ✅ same as reference |
| `reference/random_N10_d2_w2_001` | G0 needs one of G1 and G4 (alternative); G1 does T2 and T3 in parallel; G4 needs one of T5 and T6 (alternative) | ✅ same as reference |
| `reference/random_N10_d2_w2_002` | G0 tries G1 up to 3×, then any of G1 and G4; G1 does T2 then T3; G4 does T5 and T6 in any order | ✅ same as reference |
| `reference/random_N10_d3_w2_000` | G0 needs one of G1 and G8 (choice, fixed once picked); G1 needs one of G2 and G5 (alternative); G2 does T3 and T4 in parallel; G5 does T6 then T7; G8 needs one of G9 and G12 (alternative); G9 does T10 then T11; G12 does… | ✅ same as reference |
| `reference/random_N10_d3_w2_001` | G0 does G1 and G8 in parallel; G1 does G2 and G5 in any order; G2 tries T3 up to 3×, then any of T3 and T4; G5 needs one of T6 and T7 (alternative); G8 does G9 then G12; G9 needs one of T10 and T11 (choice, fixed once p… | ✅ same as reference |
| `reference/random_N10_d3_w2_002` | G0 does G1 and G8 in parallel; G1 tries G2 up to 3×, then any of G2 and G5; G2 needs one of T3 and T4 (choice, fixed once picked); G5 does T6 and T7 in any order; G8 does G9 then G12; G9 does T10 then T11; G12 does T13 … | ✅ same as reference |
| `reference/random_N10_d4_w2_000` | G0 tries G1 up to 3×, then any of G1 and G16; G1 does G2 and G9 in any order; G2 does G3 and G6 in parallel; G3 tries T4 up to 3×, then any of T4 and T5; G6 does T7 and T8 in any order; G9 tries G10 up to 3×, then any o… | ✅ same as reference |
| `reference/random_N10_d4_w2_001` | G0 tries G1 up to 3×, then any of G1 and G16; G1 does G2 and G9 in any order; G2 does G3 and G6 in parallel; G3 needs one of T4 and T5 (alternative); G6 needs one of T7 and T8 (choice, fixed once picked); G9 does G10 an… | ✅ same as reference |
| `reference/random_N10_d4_w2_002` | G0 does G1 and G16 in any order; G1 does G2 and G9 in any order; G2 does G3 then G6; G3 does T4 and T5 in any order; G6 tries T7 up to 3×, then any of T7 and T8; G9 does G10 and G13 in any order; G10 does T11 then T12; … | ✅ same as reference |
| `freeform/freeform_000` | G0 needs one of G1 and G4 (alternative); G1 does T2 then T3; G4 needs one of T5 and T6 (choice, fixed once picked) | ✅ same as reference |
| `freeform/freeform_001` | G0 needs G1 and G11 (AND, no notation); G1 needs one of G2, T6 and G7 (OR, no notation); G2 does T3 then T4 then T5; G7 does T8 then T9 then T10; G11 does G12 and G14 in any order; G12 needs T13 (AND, no notation); G14 … | generated (no reference for this notation) |
| `freeform/freeform_002` | G0 does G1 then G4; G1 needs T2 and T3 (AND, no notation); G4 needs G5, T18 and T19 (AND, no notation); G5 needs one of G6, G9 and G13 (choice, fixed once picked); G6 does T7 and T8 in parallel; G9 does T10, T11 and T12… | generated (no reference for this notation) |
| `freeform/freeform_003` | G0 does G1 and G4 in any order; G1 does T2 and T3 in parallel; G4 tries T5 up to 3×, then any of T5 and T6 | ✅ same as reference |
| `freeform/freeform_004` | G0 does G1 then G6 then G14; G1 does T2 then G3; G3 does T4 then T5; G6 does G7, G10 and T13 in parallel; G7 does T8 and T9 in parallel; G10 needs one of T11 and T12 (OR, no notation); G14 tries T15 up to 3×, then any o… | generated (no reference for this notation) |
| `freeform/freeform_005` | G0 tries G1 up to 2×, then any of G1, G18 and G30; G1 tries G2 up to 2×, then any of G2, G7, G13 and T17; G2 needs one of G3 (OR, no notation); G3 does T4 then T5 then T6; G7 needs one of G8 and T12 (choice, fixed once … | generated (no reference for this notation) |
| `freeform/freeform_006` | G0 needs one of G1 and G4 (choice, fixed once picked); G1 needs one of T2 and T3 (alternative); G4 does T5 then T6 | ✅ same as reference |
| `freeform/freeform_007` | G0 does G1, G5 and G12 in any order; G1 does G2 then T4; G2 needs T3 (AND, no notation); G5 does G6 and G8 in any order; G6 needs T7 (AND, no notation); G8 does T9 then T10 then T11; G12 needs G13 (AND, no notation); G1… | generated (no reference for this notation) |
| `freeform/freeform_008` | G0 needs one of G1 and G15 (alternative); G1 does T2 then G3; G3 needs one of T4, G5, G8 and G11 (alternative); G5 needs one of T6 and T7 (choice, fixed once picked); G8 needs one of T9 and T10 (alternative); G11 needs … | generated (no reference for this notation) |
| `freeform/freeform_009` | G0 needs one of G1 and G4 (alternative); G1 does T2 and T3 in parallel; G4 does T5 and T6 in any order | ✅ same as reference |
| `freeform/freeform_010` | G0 needs one of G1, G10 and G17 (alternative); G1 does G2, G5 and T9 in any order; G2 tries T3 up to 1×, then any of T3 and T4; G5 does T6, T7 and T8 in any order; G10 needs one of G11, T15 and T16 (choice, fixed once p… | generated (no reference for this notation) |
| `freeform/freeform_011` | G0 needs one of G1, G13 and G34 (choice, fixed once picked); G1 needs one of T2 and G3 (choice, fixed once picked); G3 does G4 and G8 in any order; G4 needs T5, T6 and T7 (AND, no notation); G8 needs one of T9, T10, T11… | generated (no reference for this notation) |
| `freeform/freeform_012` | G0 needs one of G1 and G4 (alternative); G1 tries T2 up to 3×, then any of T2 and T3; G4 does T5 and T6 in any order | ✅ same as reference |
| `freeform/freeform_013` | G0 tries G1 up to 3×, then any of G1 and G6; G1 tries G2 up to 2×, then any of G2 and T5; G2 does T3 and T4 in any order; G6 does T7 then G8 then T11; G8 does T9 and T10 in parallel | generated (no reference for this notation) |
| `freeform/freeform_014` | G0 needs G1 and G18 (AND, no notation); G1 does T2, G3, G13 and T17 in parallel; G3 needs one of G4, G7 and T12 (alternative); G4 needs T5 and T6 (AND, no notation); G7 tries T8 up to 5×, then any of T8, T9, T10 and T11… | generated (no reference for this notation) |
| `freeform/freeform_015` | G0 does G1 and G4 in any order; G1 needs one of T2 and T3 (choice, fixed once picked); G4 does T5 and T6 in any order | ✅ same as reference |
| `freeform/freeform_016` | G0 needs one of G1, G8 and G13 (alternative); G1 needs one of G2 and G5 (alternative); G2 does T3 and T4 in parallel; G5 needs one of T6 and T7 (OR, no notation); G8 tries T9 up to 3×, then any of T9, T10 and G11; G11 n… | generated (no reference for this notation) |
| `freeform/freeform_017` | G0 does G1, G21 and G28 in parallel; G1 tries G2 up to 5×, then any of G2, T13, G14 and G18; G2 does G3 then G8; G3 does T4, T5, T6 and T7 in parallel; G8 tries T9 up to 3×, then any of T9, T10, T11 and T12; G14 needs G… | generated (no reference for this notation) |
| `freeform/freeform_018` | G0 does G1 and G4 in any order; G1 tries T2 up to 3×, then any of T2 and T3; G4 does T5 and T6 in parallel | ✅ same as reference |
| `freeform/freeform_019` | G0 needs one of G1 and G11 (choice, fixed once picked); G1 needs one of G2, T6 and G7 (alternative); G2 does T3, T4 and T5 in any order; G7 does T8 then T9 then T10; G11 does G12 then G16; G12 does T13 then T14 then T15… | ✅ same as reference |
| `freeform/freeform_020` | G0 tries G1 up to 2×, then any of G1 and G12; G1 tries G2 up to 5×, then any of G2 and G7; G2 does G3 and T6 in any order; G3 does T4 then T5; G7 does T8 and G9 in any order; G9 needs one of T10 and T11 (alternative); G… | generated (no reference for this notation) |
| `freeform/freeform_021` | G0 does G1 and G4 in any order; G1 tries T2 up to 3×, then any of T2 and T3; G4 tries T5 up to 3×, then any of T5 and T6 | ✅ same as reference |
| `freeform/freeform_022` | G0 does G1 and G5 in any order; G1 needs one of G2 (OR, no notation); G2 does T3 and T4 in parallel; G5 does G6 then G10 then T13; G6 needs one of T7, T8 and T9 (choice, fixed once picked); G10 needs T11 and T12 (AND, n… | generated (no reference for this notation) |
| `freeform/freeform_023` | G0 does G1 and G35 in parallel; G1 needs one of G2, G5 and G20 (OR, no notation); G2 tries T3 up to 5×, then any of T3 and T4; G5 needs G6, G10 and G15 (AND, no notation); G6 tries T7 up to 3×, then any of T7, T8 and T9… | generated (no reference for this notation) |
| `freeform/freeform_024` | G0 tries G1 up to 3×, then any of G1 and G4; G1 needs one of T2 and T3 (choice, fixed once picked); G4 does T5 and T6 in any order | ✅ same as reference |
| `freeform/freeform_025` | G0 does G1 then G8; G1 does T2, G3 and T7 in parallel; G3 does T4, T5 and T6 in parallel; G8 needs one of G9 and G13 (choice, fixed once picked); G9 needs one of T10, T11 and T12 (choice, fixed once picked); G13 does T1… | ✅ same as reference |
| `freeform/freeform_026` | G0 does G1, G37, G50 and G80 in any order; G1 needs one of T2, G3, G16 and G25 (choice, fixed once picked); G3 does G4 then G8 then G13 then T15; G4 tries T5 up to 2×, then any of T5, T6 and T7; G8 does T9, T10, T11 and… | generated (no reference for this notation) |
| `freeform/freeform_027` | G0 tries G1 up to 3×, then any of G1 and G4; G1 tries T2 up to 3×, then any of T2 and T3; G4 does T5 and T6 in parallel | ✅ same as reference |
| `freeform/freeform_028` | G0 needs G1 (AND, no notation); G1 tries G2 up to 3×, then any of G2, T6 and G7; G2 does T3, T4 and T5 in any order; G7 does T8 and T9 in any order | generated (no reference for this notation) |
| `freeform/freeform_029` | G0 does G1, G16, G32 and G48 in parallel; G1 does G2 and G8 in parallel; G2 needs one of G3 and G5 (alternative); G3 needs one of T4 (OR, no notation); G5 needs one of T6 and T7 (OR, no notation); G8 tries G9 up to 5×, … | generated (no reference for this notation) |
