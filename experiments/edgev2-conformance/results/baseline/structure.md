# edgeV2 vs EDGE reference — BEFORE the fixes (structure)

_Outputs generated 2026-09-26 by the edgeV2 engine at 19660b7 (before the edgeV2 fixes) · report rendered 2026-09-26 · 60 models (30 from the EDGE reference suite, 30 free-form)_

## Verdict

❌ **edgeV2 matches the EDGE reference in 0 of 42 models.**

Where the differences are (number of goals or tasks affected): Task (344), Sequence (56), Any order (55), Interleaved (49), Degradation (48), Choice (44), Whole model (42), Alternative (41).

18 further models use notation the reference cannot express (goals with one child or no operator, custom retry counts); edgeV2 generated 18 of them without errors.

## What was checked

- **Reference models** come from the EDGE fuzzer (`EDGE-XT/code/evaluation/goal_fuzzer.py`). Their goal trees are rebuilt, written as goal models in edgeV2 notation, and converted by edgeV2.
- **Structure:** every PRISM rule and formula in the edgeV2 output is compared with the reference. Names are translated first (edgeV2 writes `g0_state` where the reference writes `gG0`). Two rules count as the same when they fire in exactly the same situations (checked on 400 random states) and have the same effect.
- **Free-form models** exercise the notation beyond the reference: tasks at any depth, 1–4 children, every operator, custom retry counts and goals without notation.

## Results by goal type

| Goal type | Notation | What it does | Compared with reference | Same as reference | Main problem |
|---|---|---|---|---|---|
| Sequence | `[A;B]` | does every child, one after another, in the written order | 56 | 0/56 ❌ | rule for starting a child differs |
| Any order | `[A+B]` | does every child, one at a time, in any order | 55 | 0/55 ❌ | relative share used to pick the next child is in the reference but missing from the edgeV2 output |
| Interleaved | `[A#B]` | does every child, possibly at the same time | 49 | 0/49 ❌ | achievability estimate (drives the pursue/skip decisions) is computed differently |
| Alternative | `[A|B]` | needs one child; picks again after every failed attempt | 41 | 0/41 ❌ | rule for starting a child differs |
| Choice | `[A?B]` | needs one child; picks once and sticks with it | 44 | 0/44 ❌ | achievability estimate (drives the pursue/skip decisions) is computed differently |
| Degradation | `[A@3->B]` | retries the first child up to n times, then falls back to any child | 48 | 0/48 ❌ | "achieved" condition is computed differently |
| AND without notation | `` | no operator written; edgeV2 treats it as interleaved | 0 | not in reference (generated 25) | — |
| OR without notation | `` | no operator written; edgeV2 treats it as alternative | 0 | not in reference (generated 20) | — |
| Task | `` | a leaf that succeeds with its achievability probability | 344 | 0/344 ❌ | a state variable of the reference is missing from the edgeV2 output |

## Problems found

One section per goal type; each problem comes with one example (edgeV2 names on both sides).

### Sequence — 56 of 56 goals differ

**Rule for starting a child differs** — 115× in 27 model(s). Example: `G1` in `freeform/freeform_000`

```
reference: [pursue_T2] !g1_achieved & g1_state=1 & G1_achievable*N>decision_G1 & t3_state=0 -> true
edgeV2:    [pursue_T2] !g1_achieved & g1_state=1 & G1_achievable*10.0 > decision_G1 -> true
```

**Achievability estimate (drives the pursue/skip decisions) is computed differently** — 56× in 27 model(s). Example: `G1` in `freeform/freeform_000`

```
reference: formula G1_achievable = g1_achieved ? 0 : 1* (!t2_achieved ? T2_achievable : 1)* (!t3_achieved ? T3_achievable : 1)
edgeV2:    formula G1_achievable = T2_achievable * T3_achievable
```

**"achieved" condition is computed differently** — 34× in 22 model(s). Example: `G1` in `freeform/freeform_000`

```
reference: formula g1_achieved = (true & t2_achieved & t3_achieved)
edgeV2:    formula g1_achieved = (T2_achieved & T3_achieved)
```

**Completion rule (when it is marked done) differs** — 34× in 22 model(s). Example: `G1` in `freeform/freeform_000`

```
reference: [achieved_G1] g1_state=1 & g1_achieved & t2_state=0 & t3_state=0 -> (g1_state'=0)
edgeV2:    [achieved_G1] g1_state=1 & g1_achieved & T2_pursued=0 & T3_pursued=0 -> (g1_state'=0)
```

**Give-up rule (when it stops without being achieved) differs** — 34× in 22 model(s). Example: `G1` in `freeform/freeform_000`

```
reference: [skip_G1] !g1_achieved & g1_state=1 & t2_state=0 & t3_state=0 & G1_achievable * N <= decision_G1 -> (g1_state'=0)
edgeV2:    [skip_G1] !g1_achieved & g1_state=1 & T2_pursued=0 & T3_pursued=0 & G1_achievable*10.0 <= decision_G1 -> (g1_state'=0)
```

### Any order — 55 of 55 goals differ

**Relative share used to pick the next child is in the reference but missing from the edgeV2 output** — 111× in 31 model(s). Example: `G0` in `freeform/freeform_003`

```
reference: formula G1_relative = g1_achieved ? 0 : G1_achievable/(G1_achievable + (g4_achieved ? 0 : G4_achievable))
edgeV2:    (not declared)
```

**Rule for starting a child differs** — 110× in 31 model(s). Example: `G0` in `freeform/freeform_003`

```
reference: [pursue_G1] !g0_achieved & g0_state=1 & G0_achievable*N>decision_G0 & g4_state=0 & G1_relative*N>_decision_G0 -> true
edgeV2:    [pursue_G1] !g0_achieved & g0_state=1 & G0_achievable*10.0 > decision_G0 & g4_state!=1 & (g4_state=1 | (G1_achievable/(G1_achievable+G4_achievable))*10.0 > _decision_G0) -> true
```

**Achievability estimate (drives the pursue/skip decisions) is computed differently** — 55× in 31 model(s). Example: `G0` in `freeform/freeform_003`

```
reference: formula G0_achievable = g0_achieved ? 0 : 1* (!g1_achieved ? G1_achievable : 1)* (!g4_achieved ? G4_achievable : 1)
edgeV2:    formula G0_achievable = G1_achievable * G4_achievable
```

**"achieved" condition is computed differently** — 32× in 23 model(s). Example: `G4` in `freeform/freeform_009`

```
reference: formula g4_achieved = (true & t5_achieved & t6_achieved)
edgeV2:    formula g4_achieved = (T5_achieved & T6_achieved)
```

**Completion rule (when it is marked done) differs** — 32× in 23 model(s). Example: `G4` in `freeform/freeform_009`

```
reference: [achieved_G4] g4_state=1 & g4_achieved & t5_state=0 & t6_state=0 -> (g4_state'=0)
edgeV2:    [achieved_G4] g4_state=1 & g4_achieved & T5_pursued=0 & T6_pursued=0 -> (g4_state'=0)
```

**Give-up rule (when it stops without being achieved) differs** — 32× in 23 model(s). Example: `G4` in `freeform/freeform_009`

```
reference: [skip_G4] !g4_achieved & g4_state=1 & t5_state=0 & t6_state=0 & G4_achievable * N <= decision_G4 -> (g4_state'=0)
edgeV2:    [skip_G4] !g4_achieved & g4_state=1 & T5_pursued=0 & T6_pursued=0 & G4_achievable*10.0 <= decision_G4 -> (g4_state'=0)
```

### Interleaved — 49 of 49 goals differ

**Achievability estimate (drives the pursue/skip decisions) is computed differently** — 49× in 24 model(s). Example: `G1` in `freeform/freeform_003`

```
reference: formula G1_achievable = g1_achieved ? 0 : 1* (!t2_achieved ? T2_achievable : 1)* (!t3_achieved ? T3_achievable : 1)
edgeV2:    formula G1_achievable = T2_achievable * T3_achievable
```

**Give-up rule (when it stops without being achieved) differs** — 49× in 24 model(s). Example: `G1` in `freeform/freeform_003`

```
reference: [skip_G1] !g1_achieved & g1_state=1 & t2_state=0 & t3_state=0 & !(T2_achievable*N>decision_T2 | T3_achievable*N>decision_T3 | false) -> (g1_state'=0)
edgeV2:    [skip_G1] !g1_achieved & g1_state=1 & T2_pursued=0 & T3_pursued=0 -> (g1_state'=0)
```

**"achieved" condition is computed differently** — 29× in 21 model(s). Example: `G1` in `freeform/freeform_003`

```
reference: formula g1_achieved = (true & t2_achieved & t3_achieved)
edgeV2:    formula g1_achieved = (T2_achieved & T3_achieved)
```

**Completion rule (when it is marked done) differs** — 29× in 21 model(s). Example: `G1` in `freeform/freeform_003`

```
reference: [achieved_G1] g1_state=1 & g1_achieved & t2_state=0 & t3_state=0 -> (g1_state'=0)
edgeV2:    [achieved_G1] g1_state=1 & g1_achieved & T2_pursued=0 & T3_pursued=0 -> (g1_state'=0)
```

### Alternative — 41 of 41 goals differ

**Rule for starting a child differs** — 42× in 25 model(s). Example: `G0` in `freeform/freeform_000`

```
reference: [pursue_G4] !g0_achieved & g0_state=1 & G0_achievable*N>decision_G0 & g1_state=0 & (G4_achievable/(G1_achievable+G4_achievable+0))*N > _decision_G0 & !(G1_achievable/(G1_achievable+G4_achievable+0))*N > _decision_G0 -> true
edgeV2:    [pursue_G4] !g0_achieved & g0_state=1 & G0_achievable*10.0 > decision_G0 & g1_state=0 & (G1_achievable/(G1_achievable+G4_achievable))*10.0 <= _decision_G0 -> true
```

**Give-up rule (when it stops without being achieved) differs** — 41× in 25 model(s). Example: `G0` in `freeform/freeform_000`

```
reference: [skip_G0] !g0_achieved & g0_state=1 & g1_state=0 & g4_state=0 & G0_achievable * N <= decision_G0 -> (g0_state'=0)
edgeV2:    [skip_G0] !g0_achieved & g0_state=1 & g1_state=0 & g4_state=0 -> (g0_state'=0)
```

**"achieved" condition is computed differently** — 24× in 18 model(s). Example: `G1` in `freeform/freeform_006`

```
reference: formula g1_achieved = (false | t2_achieved | t3_achieved)
edgeV2:    formula g1_achieved = (T2_achieved | T3_achieved)
```

**Completion rule (when it is marked done) differs** — 24× in 18 model(s). Example: `G1` in `freeform/freeform_006`

```
reference: [achieved_G1] g1_state=1 & g1_achieved & t2_state=0 & t3_state=0 -> (g1_state'=0)
edgeV2:    [achieved_G1] g1_state=1 & g1_achieved & T2_pursued=0 & T3_pursued=0 -> (g1_state'=0)
```

### Choice — 44 of 44 goals differ

**Achievability estimate (drives the pursue/skip decisions) is computed differently** — 44× in 25 model(s). Example: `G4` in `freeform/freeform_000`

```
reference: formula G4_achievable = g4_chosen=1 ? T5_achievable:g4_chosen=2 ? T6_achievable:(0 + T5_achievable + T6_achievable - 1 * T5_achievable * T6_achievable )
edgeV2:    formula G4_achievable = T5_achievable + T6_achievable - (T5_achievable * T6_achievable)
```

**Give-up rule (when it stops without being achieved) differs** — 44× in 25 model(s). Example: `G4` in `freeform/freeform_000`

```
reference: [skip_G4] g4_chosen=0 & !g4_achieved & g4_state=1 & t5_state=0 & t6_state=0 & G4_achievable * N <= decision_G4 -> (g4_state'=0)
reference: [skip_G4] !g4_achieved & g4_state=1 & t5_state=0 & g4_chosen=1 & T5_achievable*N <= decision_T5 -> (g4_state'=0)
reference: [skip_G4] !g4_achieved & g4_state=1 & t6_state=0 & g4_chosen=2 & T6_achievable*N <= decision_T6 -> (g4_state'=0)
edgeV2:    [skip_G4] !g4_achieved & g4_state=1 & T5_pursued=0 & T6_pursued=0 -> (g4_state'=0)
```

**Rule for starting a child differs** — 39× in 23 model(s). Example: `G4` in `freeform/freeform_000`

```
reference: [pursue_T6] !g4_achieved & g4_state=1 & g4_chosen=0 & G4_achievable*N>decision_G4 & t5_state=0 & (T6_achievable/(T5_achievable+T6_achievable+0))*N > _decision_G4 & !(T5_achievable/(T5_achievable+T6_achievable+0))*N > _decision_G4 -> (g4_chosen'=2)
edgeV2:    [pursue_T6] !g4_achieved & g4_state=1 & g4_chosen=0 & G4_achievable*10.0 > decision_G4 & t5_state=0 & (T5_achievable/(T5_achievable+T6_achievable))*10.0 <= _decision_G4 -> (g4_chosen'=2)
```

**"achieved" condition is computed differently** — 23× in 18 model(s). Example: `G4` in `freeform/freeform_000`

```
reference: formula g4_achieved = (false | t5_achieved | t6_achieved)
edgeV2:    formula g4_achieved = (T5_achieved | T6_achieved)
```

**Completion rule (when it is marked done) differs** — 23× in 18 model(s). Example: `G4` in `freeform/freeform_000`

```
reference: [achieved_G4] g4_state=1 & g4_achieved & t5_state=0 & t6_state=0 -> (g4_state'=0)
edgeV2:    [achieved_G4] g4_state=1 & g4_achieved & T5_pursued=0 & T6_pursued=0 -> (g4_state'=0)
```

### Degradation — 48 of 48 goals differ

**"achieved" condition is computed differently** — 48× in 27 model(s). Example: `G4` in `freeform/freeform_003`

```
reference: formula g4_achieved = (t5_achieved | (t5_failed=3 & t6_achieved))
edgeV2:    formula g4_achieved = (T5_achieved | T6_achieved)
```

**A state variable of the reference is missing from the edgeV2 output** — 48× in 27 model(s). Example: `G4` in `freeform/freeform_003`

```
reference: t5_failed : [0..3]
edgeV2:    (not declared)
```

**Give-up rule (when it stops without being achieved) differs** — 48× in 27 model(s). Example: `G4` in `freeform/freeform_003`

```
reference: [skip_G4] !g4_achieved & g4_state=1 & t5_state=0 & t5_failed<3 & T5_achievable*N <= decision_T5 -> (g4_state'=0)
reference: [skip_G4] t5_failed=3 & !g4_achieved & g4_state=1 & t5_state=0 & t6_state=0 & G4_achievable * N <= decision_G4 -> (g4_state'=0)
edgeV2:    [skip_G4] !g4_achieved & g4_state=1 & T5_pursued=0 & T6_pursued=0 -> (g4_state'=0)
```

**Rule for starting a child differs** — 44× in 27 model(s). Example: `G4` in `freeform/freeform_003`

```
reference: [pursue_T6] !g4_achieved & g4_state=1 & t5_failed=3 & G4_achievable*N>decision_G4 & t5_state=0 & (T6_achievable/(T5_achievable+T6_achievable+0))*N > _decision_G4 & !(T5_achievable/(T5_achievable+T6_achievable+0))*N > _decision_G4 -> true
edgeV2:    [pursue_T6] !g4_achieved & g4_state=1 & t5_failed=3 & G4_achievable*10.0 > decision_G4 & t5_state=0 & (T5_achievable/(T5_achievable+T6_achievable))*10.0 <= _decision_G4 -> true
```

**Completion rule (when it is marked done) differs** — 27× in 19 model(s). Example: `G4` in `freeform/freeform_003`

```
reference: [achieved_G4] g4_state=1 & g4_achieved & t5_state=0 & t6_state=0 -> (g4_state'=0)
edgeV2:    [achieved_G4] g4_state=1 & g4_achieved & T5_pursued=0 & T6_pursued=0 -> (g4_state'=0)
```

### Task — 344 of 344 tasks differ

**A state variable of the reference is missing from the edgeV2 output** — 688× in 42 model(s). Example: `T2` in `freeform/freeform_000`

```
reference: t2_state : [0..1]
edgeV2:    (not declared)
```

**"achieved" condition is in the reference but missing from the edgeV2 output** — 344× in 42 model(s). Example: `T2` in `freeform/freeform_000`

```
reference: formula t2_achieved = (t2_achieved_=1)
edgeV2:    (not declared)
```

**Completion rule (when it is marked done) differs** — 344× in 42 model(s). Example: `T2` in `freeform/freeform_000`

```
reference: [achieved_T2] t2_state=1 & t2_achieved_=1 -> (t2_state'=0)
edgeV2:    [achieved_T2] t2_state=1 & t2_achieved -> true
```

**Start rule (when it becomes active) differs** — 344× in 42 model(s). Example: `T2` in `freeform/freeform_000`

```
reference: [pursue_T2] t2_state=0 & t2_achieved_=0 -> (t2_state'=1)
edgeV2:    [pursue_T2] t2_state=0 & !t2_achieved -> (t2_state'=1)
```

**Attempt rule (the task succeeds with its probability) differs** — 344× in 42 model(s). Example: `T2` in `freeform/freeform_000`

```
reference: [try_T2] t2_state=1 & t2_achieved_=0 -> T2_achievable: (t2_achieved_'=1) + 1-T2_achievable: (t2_state'=0)
edgeV2:    [try_T2] t2_state=1 & !t2_achieved -> T2_achievable: (t2_achieved'=1) + 1-T2_achievable: (t2_state'=0)
```

**A decision constant of the reference is missing from the edgeV2 output** — 134× in 36 model(s). Example: `T5` in `freeform/freeform_000`

```
reference: const int decision_T5;
edgeV2:    (not declared)
```

### Whole model

**The discretisation constant N is missing from the edgeV2 output (achievabilities are scaled by a literal instead)** — 42× in 42 model(s). Example: `model` in `freeform/freeform_000`

```
reference: const int N;
edgeV2:    (not declared)
```

## Defects in the reference that edgeV2 does not copy

These are corrected in the reference before comparing, so they do not count as differences.

- **Choice goals could never give up on their chosen child** (89 occurrences). In the reference, the rule that lets a choice goal give up once its chosen child is no longer worth pursuing requires the goal to be active and inactive at the same time (`g<id>=1 & g<id>=0`), so it can never fire and the goal gets stuck. The intent is clearly "the chosen child is idle" (`g<child>=0`); edgeV2 implements that.
- **Choice goals with more than two children overflow their memory variable** (1 occurrences). The reference always declares `g<id>_chosen: [0..2]`. With a third child it assigns `g<id>_chosen'=3`, which PRISM rejects. edgeV2 declares one value per child.
- **Choice-goal properties are glued together in the .pctl file** (45 occurrences). The reference writes the "only the chosen child runs" properties without a line break between them, so PRISM cannot parse them. A newline is inserted.

## Models

Each model folder holds `goal.txt` (edgeV2 input), `edgev2.prism` (output), `reference.prism` when the reference can express it, and `findings.json` with the raw differences.

| Model | Structure | Result |
|---|---|---|
| `freeform/freeform_000` | G0 needs one of G1 and G4 (alternative); G1 does T2 then T3; G4 needs one of T5 and T6 (choice, fixed once picked) | ❌ 40 problem(s) |
| `freeform/freeform_001` | G0 needs G1 and G11 (AND, no notation); G1 needs one of G2, T6 and G7 (OR, no notation); G2 does T3 then T4 then T5; G7 does T8 then T9 then T10; G11 does G12 and G14 in any order; G12 needs T13 (AND, no notation); G14 … | generated (no reference for this notation) |
| `freeform/freeform_002` | G0 does G1 then G4; G1 needs T2 and T3 (AND, no notation); G4 needs G5, T18 and T19 (AND, no notation); G5 needs one of G6, G9 and G13 (choice, fixed once picked); G6 does T7 and T8 in parallel; G9 does T10, T11 and T12… | generated (no reference for this notation) |
| `freeform/freeform_003` | G0 does G1 and G4 in any order; G1 does T2 and T3 in parallel; G4 tries T5 up to 3×, then any of T5 and T6 | ❌ 42 problem(s) |
| `freeform/freeform_004` | G0 does G1 then G6 then G14; G1 does T2 then G3; G3 does T4 then T5; G6 does G7, G10 and T13 in parallel; G7 does T8 and T9 in parallel; G10 needs one of T11 and T12 (OR, no notation); G14 tries T15 up to 3×, then any o… | generated (no reference for this notation) |
| `freeform/freeform_005` | G0 tries G1 up to 2×, then any of G1, G18 and G30; G1 tries G2 up to 2×, then any of G2, G7, G13 and T17; G2 needs one of G3 (OR, no notation); G3 does T4 then T5 then T6; G7 needs one of G8 and T12 (choice, fixed once … | generated (no reference for this notation) |
| `freeform/freeform_006` | G0 needs one of G1 and G4 (choice, fixed once picked); G1 needs one of T2 and T3 (alternative); G4 does T5 then T6 | ❌ 38 problem(s) |
| `freeform/freeform_007` | G0 does G1, G5 and G12 in any order; G1 does G2 then T4; G2 needs T3 (AND, no notation); G5 does G6 and G8 in any order; G6 needs T7 (AND, no notation); G8 does T9 then T10 then T11; G12 needs G13 (AND, no notation); G1… | generated (no reference for this notation) |
| `freeform/freeform_008` | G0 needs one of G1 and G15 (alternative); G1 does T2 then G3; G3 needs one of T4, G5, G8 and G11 (alternative); G5 needs one of T6 and T7 (choice, fixed once picked); G8 needs one of T9 and T10 (alternative); G11 needs … | generated (no reference for this notation) |
| `freeform/freeform_009` | G0 needs one of G1 and G4 (alternative); G1 does T2 and T3 in parallel; G4 does T5 and T6 in any order | ❌ 41 problem(s) |
| `freeform/freeform_010` | G0 needs one of G1, G10 and G17 (alternative); G1 does G2, G5 and T9 in any order; G2 tries T3 up to 1×, then any of T3 and T4; G5 does T6, T7 and T8 in any order; G10 needs one of G11, T15 and T16 (choice, fixed once p… | generated (no reference for this notation) |
| `freeform/freeform_011` | G0 needs one of G1, G13 and G34 (choice, fixed once picked); G1 needs one of T2 and G3 (choice, fixed once picked); G3 does G4 and G8 in any order; G4 needs T5, T6 and T7 (AND, no notation); G8 needs one of T9, T10, T11… | generated (no reference for this notation) |
| `freeform/freeform_012` | G0 needs one of G1 and G4 (alternative); G1 tries T2 up to 3×, then any of T2 and T3; G4 does T5 and T6 in any order | ❌ 41 problem(s) |
| `freeform/freeform_013` | G0 tries G1 up to 3×, then any of G1 and G6; G1 tries G2 up to 2×, then any of G2 and T5; G2 does T3 and T4 in any order; G6 does T7 then G8 then T11; G8 does T9 and T10 in parallel | generated (no reference for this notation) |
| `freeform/freeform_014` | G0 needs G1 and G18 (AND, no notation); G1 does T2, G3, G13 and T17 in parallel; G3 needs one of G4, G7 and T12 (alternative); G4 needs T5 and T6 (AND, no notation); G7 tries T8 up to 5×, then any of T8, T9, T10 and T11… | generated (no reference for this notation) |
| `freeform/freeform_015` | G0 does G1 and G4 in any order; G1 needs one of T2 and T3 (choice, fixed once picked); G4 does T5 and T6 in any order | ❌ 45 problem(s) |
| `freeform/freeform_016` | G0 needs one of G1, G8 and G13 (alternative); G1 needs one of G2 and G5 (alternative); G2 does T3 and T4 in parallel; G5 needs one of T6 and T7 (OR, no notation); G8 tries T9 up to 3×, then any of T9, T10 and G11; G11 n… | generated (no reference for this notation) |
| `freeform/freeform_017` | G0 does G1, G21 and G28 in parallel; G1 tries G2 up to 5×, then any of G2, T13, G14 and G18; G2 does G3 then G8; G3 does T4, T5, T6 and T7 in parallel; G8 tries T9 up to 3×, then any of T9, T10, T11 and T12; G14 needs G… | generated (no reference for this notation) |
| `freeform/freeform_018` | G0 does G1 and G4 in any order; G1 tries T2 up to 3×, then any of T2 and T3; G4 does T5 and T6 in parallel | ❌ 42 problem(s) |
| `freeform/freeform_019` | G0 needs one of G1 and G11 (choice, fixed once picked); G1 needs one of G2, T6 and G7 (alternative); G2 does T3, T4 and T5 in any order; G7 does T8 then T9 then T10; G11 does G12 then G16; G12 does T13 then T14 then T15… | ❌ 120 problem(s) |
| `freeform/freeform_020` | G0 tries G1 up to 2×, then any of G1 and G12; G1 tries G2 up to 5×, then any of G2 and G7; G2 does G3 and T6 in any order; G3 does T4 then T5; G7 does T8 and G9 in any order; G9 needs one of T10 and T11 (alternative); G… | generated (no reference for this notation) |
| `freeform/freeform_021` | G0 does G1 and G4 in any order; G1 tries T2 up to 3×, then any of T2 and T3; G4 tries T5 up to 3×, then any of T5 and T6 | ❌ 42 problem(s) |
| `freeform/freeform_022` | G0 does G1 and G5 in any order; G1 needs one of G2 (OR, no notation); G2 does T3 and T4 in parallel; G5 does G6 then G10 then T13; G6 needs one of T7, T8 and T9 (choice, fixed once picked); G10 needs T11 and T12 (AND, n… | generated (no reference for this notation) |
| `freeform/freeform_023` | G0 does G1 and G35 in parallel; G1 needs one of G2, G5 and G20 (OR, no notation); G2 tries T3 up to 5×, then any of T3 and T4; G5 needs G6, G10 and G15 (AND, no notation); G6 tries T7 up to 3×, then any of T7, T8 and T9… | generated (no reference for this notation) |
| `freeform/freeform_024` | G0 tries G1 up to 3×, then any of G1 and G4; G1 needs one of T2 and T3 (choice, fixed once picked); G4 does T5 and T6 in any order | ❌ 44 problem(s) |
| `freeform/freeform_025` | G0 does G1 then G8; G1 does T2, G3 and T7 in parallel; G3 does T4, T5 and T6 in parallel; G8 needs one of G9 and G13 (choice, fixed once picked); G9 needs one of T10, T11 and T12 (choice, fixed once picked); G13 does T1… | ❌ 99 problem(s) |
| `freeform/freeform_026` | G0 does G1, G37, G50 and G80 in any order; G1 needs one of T2, G3, G16 and G25 (choice, fixed once picked); G3 does G4 then G8 then G13 then T15; G4 tries T5 up to 2×, then any of T5, T6 and T7; G8 does T9, T10, T11 and… | generated (no reference for this notation) |
| `freeform/freeform_027` | G0 tries G1 up to 3×, then any of G1 and G4; G1 tries T2 up to 3×, then any of T2 and T3; G4 does T5 and T6 in parallel | ❌ 41 problem(s) |
| `freeform/freeform_028` | G0 needs G1 (AND, no notation); G1 tries G2 up to 3×, then any of G2, T6 and G7; G2 does T3, T4 and T5 in any order; G7 does T8 and T9 in any order | generated (no reference for this notation) |
| `freeform/freeform_029` | G0 does G1, G16, G32 and G48 in parallel; G1 does G2 and G8 in parallel; G2 needs one of G3 and G5 (alternative); G3 needs one of T4 (OR, no notation); G5 needs one of T6 and T7 (OR, no notation); G8 tries G9 up to 5×, … | generated (no reference for this notation) |
| `reference/random_N10_d2_w2_000` | G0 needs one of G1 and G4 (alternative); G1 does T2 then T3; G4 needs one of T5 and T6 (choice, fixed once picked) | ❌ 40 problem(s) |
| `reference/random_N10_d2_w2_001` | G0 needs one of G1 and G4 (alternative); G1 does T2 and T3 in parallel; G4 needs one of T5 and T6 (alternative) | ❌ 37 problem(s) |
| `reference/random_N10_d2_w2_002` | G0 tries G1 up to 3×, then any of G1 and G4; G1 does T2 then T3; G4 does T5 and T6 in any order | ❌ 43 problem(s) |
| `reference/random_N10_d2_w2_003` | G0 needs one of G1 and G4 (choice, fixed once picked); G1 does T2 and T3 in parallel; G4 tries T5 up to 3×, then any of T5 and T6 | ❌ 39 problem(s) |
| `reference/random_N10_d2_w2_004` | G0 does G1 and G4 in any order; G1 does T2 then T3; G4 needs one of T5 and T6 (alternative) | ❌ 40 problem(s) |
| `reference/random_N10_d2_w2_005` | G0 does G1 and G4 in any order; G1 tries T2 up to 3×, then any of T2 and T3; G4 needs one of T5 and T6 (alternative) | ❌ 40 problem(s) |
| `reference/random_N10_d2_w2_006` | G0 does G1 and G4 in any order; G1 does T2 and T3 in parallel; G4 does T5 then T6 | ❌ 42 problem(s) |
| `reference/random_N10_d2_w2_007` | G0 needs one of G1 and G4 (choice, fixed once picked); G1 needs one of T2 and T3 (alternative); G4 does T5 then T6 | ❌ 38 problem(s) |
| `reference/random_N10_d2_w2_008` | G0 tries G1 up to 3×, then any of G1 and G4; G1 needs one of T2 and T3 (alternative); G4 does T5 and T6 in any order | ❌ 41 problem(s) |
| `reference/random_N10_d2_w2_009` | G0 tries G1 up to 3×, then any of G1 and G4; G1 does T2 and T3 in parallel; G4 does T5 and T6 in any order | ❌ 43 problem(s) |
| `reference/random_N10_d3_w2_000` | G0 needs one of G1 and G8 (choice, fixed once picked); G1 needs one of G2 and G5 (alternative); G2 does T3 and T4 in parallel; G5 does T6 then T7; G8 needs one of G9 and G12 (alternative); G9 does T10 then T11; G12 does… | ❌ 80 problem(s) |
| `reference/random_N10_d3_w2_001` | G0 does G1 and G8 in parallel; G1 does G2 and G5 in any order; G2 tries T3 up to 3×, then any of T3 and T4; G5 needs one of T6 and T7 (alternative); G8 does G9 then G12; G9 needs one of T10 and T11 (choice, fixed once p… | ❌ 82 problem(s) |
| `reference/random_N10_d3_w2_002` | G0 does G1 and G8 in parallel; G1 tries G2 up to 3×, then any of G2 and G5; G2 needs one of T3 and T4 (choice, fixed once picked); G5 does T6 and T7 in any order; G8 does G9 then G12; G9 does T10 then T11; G12 does T13 … | ❌ 85 problem(s) |
| `reference/random_N10_d3_w2_003` | G0 does G1 then G8; G1 needs one of G2 and G5 (alternative); G2 needs one of T3 and T4 (choice, fixed once picked); G5 needs one of T6 and T7 (alternative); G8 needs one of G9 and G12 (alternative); G9 tries T10 up to 3… | ❌ 79 problem(s) |
| `reference/random_N10_d3_w2_004` | G0 needs one of G1 and G8 (alternative); G1 tries G2 up to 3×, then any of G2 and G5; G2 does T3 and T4 in any order; G5 does T6 and T7 in any order; G8 does G9 then G12; G9 tries T10 up to 3×, then any of T10 and T11; … | ❌ 84 problem(s) |
| `reference/random_N10_d3_w2_005` | G0 does G1 then G8; G1 does G2 and G5 in parallel; G2 does T3 and T4 in parallel; G5 does T6 then T7; G8 needs one of G9 and G12 (choice, fixed once picked); G9 needs one of T10 and T11 (choice, fixed once picked); G12 … | ❌ 82 problem(s) |
| `reference/random_N10_d3_w2_006` | G0 needs one of G1 and G8 (alternative); G1 needs one of G2 and G5 (alternative); G2 needs one of T3 and T4 (choice, fixed once picked); G5 does T6 and T7 in any order; G8 tries G9 up to 3×, then any of G9 and G12; G9 t… | ❌ 86 problem(s) |
| `reference/random_N10_d3_w2_007` | G0 does G1 and G8 in any order; G1 does G2 and G5 in parallel; G2 does T3 and T4 in any order; G5 does T6 then T7; G8 does G9 and G12 in any order; G9 does T10 and T11 in parallel; G12 does T13 and T14 in any order | ❌ 89 problem(s) |
| `reference/random_N10_d3_w2_008` | G0 does G1 and G8 in any order; G1 needs one of G2 and G5 (alternative); G2 does T3 and T4 in any order; G5 tries T6 up to 3×, then any of T6 and T7; G8 does G9 and G12 in any order; G9 does T10 and T11 in any order; G1… | ❌ 87 problem(s) |
| `reference/random_N10_d3_w2_009` | G0 does G1 and G8 in parallel; G1 needs one of G2 and G5 (alternative); G2 does T3 then T4; G5 needs one of T6 and T7 (alternative); G8 does G9 and G12 in any order; G9 does T10 then T11; G12 tries T13 up to 3×, then an… | ❌ 80 problem(s) |
| `reference/random_N10_d4_w2_000` | G0 tries G1 up to 3×, then any of G1 and G16; G1 does G2 and G9 in any order; G2 does G3 and G6 in parallel; G3 tries T4 up to 3×, then any of T4 and T5; G6 does T7 and T8 in any order; G9 tries G10 up to 3×, then any o… | ❌ 169 problem(s) |
| `reference/random_N10_d4_w2_001` | G0 tries G1 up to 3×, then any of G1 and G16; G1 does G2 and G9 in any order; G2 does G3 and G6 in parallel; G3 needs one of T4 and T5 (alternative); G6 needs one of T7 and T8 (choice, fixed once picked); G9 does G10 an… | ❌ 169 problem(s) |
| `reference/random_N10_d4_w2_002` | G0 does G1 and G16 in any order; G1 does G2 and G9 in any order; G2 does G3 then G6; G3 does T4 and T5 in any order; G6 tries T7 up to 3×, then any of T7 and T8; G9 does G10 and G13 in any order; G10 does T11 then T12; … | ❌ 176 problem(s) |
| `reference/random_N10_d4_w2_003` | G0 needs one of G1 and G16 (choice, fixed once picked); G1 needs one of G2 and G9 (choice, fixed once picked); G2 needs one of G3 and G6 (choice, fixed once picked); G3 does T4 and T5 in parallel; G6 needs one of T7 and… | ❌ 167 problem(s) |
| `reference/random_N10_d4_w2_004` | G0 does G1 and G16 in parallel; G1 does G2 and G9 in parallel; G2 does G3 and G6 in any order; G3 does T4 and T5 in any order; G6 does T7 then T8; G9 tries G10 up to 3×, then any of G10 and G13; G10 does T11 then T12; G… | ❌ 170 problem(s) |
| `reference/random_N10_d4_w2_005` | G0 does G1 then G16; G1 does G2 and G9 in parallel; G2 does G3 then G6; G3 does T4 then T5; G6 does T7 and T8 in parallel; G9 does G10 then G13; G10 does T11 then T12; G13 does T14 and T15 in parallel; G16 does G17 then… | ❌ 172 problem(s) |
| `reference/random_N10_d4_w2_006` | G0 tries G1 up to 3×, then any of G1 and G16; G1 does G2 then G9; G2 needs one of G3 and G6 (choice, fixed once picked); G3 tries T4 up to 3×, then any of T4 and T5; G6 needs one of T7 and T8 (choice, fixed once picked)… | ❌ 166 problem(s) |
| `reference/random_N10_d4_w2_007` | G0 needs one of G1 and G16 (choice, fixed once picked); G1 does G2 then G9; G2 needs one of G3 and G6 (choice, fixed once picked); G3 needs one of T4 and T5 (choice, fixed once picked); G6 does T7 and T8 in parallel; G9… | ❌ 167 problem(s) |
| `reference/random_N10_d4_w2_008` | G0 needs one of G1 and G16 (choice, fixed once picked); G1 needs one of G2 and G9 (choice, fixed once picked); G2 does G3 and G6 in any order; G3 tries T4 up to 3×, then any of T4 and T5; G6 does T7 and T8 in any order;… | ❌ 171 problem(s) |
| `reference/random_N10_d4_w2_009` | G0 tries G1 up to 3×, then any of G1 and G16; G1 needs one of G2 and G9 (choice, fixed once picked); G2 does G3 then G6; G3 does T4 and T5 in parallel; G6 tries T7 up to 3×, then any of T7 and T8; G9 needs one of G10 an… | ❌ 161 problem(s) |
