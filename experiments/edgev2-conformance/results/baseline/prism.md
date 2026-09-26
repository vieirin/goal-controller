# edgeV2 vs EDGE reference — BEFORE the fixes (PRISM)

_Outputs generated 2026-09-26 by the edgeV2 engine at 19660b7 (before the edgeV2 fixes) · report rendered 2026-09-26 · 6 models (3 from the EDGE reference suite, 3 free-form)_

## Verdict

❌ **edgeV2 matches the EDGE reference in 0 of 4 models.**

Where the differences are (number of goals or tasks affected): Task (16), Whole model (4), Alternative (4), Sequence (3), Choice (2), Interleaved (1), Any order (1), Degradation (1).

2 further models use notation the reference cannot express (goals with one child or no operator, custom retry counts); edgeV2 generated 2 of them without errors.

❌ **PRISM 4.9:** none of the 6 edgeV2 models load, so no property could be checked.

## What was checked

- **Reference models** come from the EDGE fuzzer (`EDGE-XT/code/evaluation/goal_fuzzer.py`). Their goal trees are rebuilt, written as goal models in edgeV2 notation, and converted by edgeV2.
- **Structure:** every PRISM rule and formula in the edgeV2 output is compared with the reference. Names are translated first (edgeV2 writes `g0_state` where the reference writes `gG0`). Two rules count as the same when they fire in exactly the same situations (checked on 400 random states) and have the same effect.
- **Free-form models** exercise the notation beyond the reference: tasks at any depth, 1–4 children, every operator, custom retry counts and goals without notation.
- **Model checking (PRISM 4.9):** each model is built and checked: the reference's own properties (translated to edgeV2 names) must hold, and the probability of eventually achieving the root goal is compared with the reference model under the same decision thresholds (the values the EDGE fuzzer uses: decision_X = 0.2·N, _decision_X = (N−1)/#children).

## Results by goal type

| Goal type | Notation | What it does | Compared with reference | Same as reference | Main problem |
|---|---|---|---|---|---|
| Sequence | `[A;B]` | does every child, one after another, in the written order | 3 | 0/3 ❌ | rule for starting a child differs |
| Any order | `[A+B]` | does every child, one at a time, in any order | 1 | 0/1 ❌ | relative share used to pick the next child is in the reference but missing from the edgeV2 output |
| Interleaved | `[A#B]` | does every child, possibly at the same time | 1 | 0/1 ❌ | achievability estimate (drives the pursue/skip decisions) is computed differently |
| Alternative | `[A|B]` | needs one child; picks again after every failed attempt | 4 | 0/4 ❌ | rule for starting a child differs |
| Choice | `[A?B]` | needs one child; picks once and sticks with it | 2 | 0/2 ❌ | achievability estimate (drives the pursue/skip decisions) is computed differently |
| Degradation | `[A@3->B]` | retries the first child up to n times, then falls back to any child | 1 | 0/1 ❌ | "achieved" condition is computed differently |
| AND without notation | `` | no operator written; edgeV2 treats it as interleaved | 0 | not in reference (generated 4) | — |
| OR without notation | `` | no operator written; edgeV2 treats it as alternative | 0 | not in reference (generated 1) | — |
| Task | `` | a leaf that succeeds with its achievability probability | 16 | 0/16 ❌ | a state variable of the reference is missing from the edgeV2 output |

## Problems found

One section per goal type; each problem comes with one example (edgeV2 names on both sides).

### Sequence — 3 of 3 goals differ

**Rule for starting a child differs** — 6× in 3 model(s). Example: `G1` in `freeform/freeform_000`

```
reference: [pursue_T2] !g1_achieved & g1_state=1 & G1_achievable*N>decision_G1 & t3_state=0 -> true
edgeV2:    [pursue_T2] !g1_achieved & g1_state=1 & G1_achievable*10.0 > decision_G1 -> true
```

**Achievability estimate (drives the pursue/skip decisions) is computed differently** — 3× in 3 model(s). Example: `G1` in `freeform/freeform_000`

```
reference: formula G1_achievable = g1_achieved ? 0 : 1* (!t2_achieved ? T2_achievable : 1)* (!t3_achieved ? T3_achievable : 1)
edgeV2:    formula G1_achievable = T2_achievable * T3_achievable
```

**"achieved" condition is computed differently** — 3× in 3 model(s). Example: `G1` in `freeform/freeform_000`

```
reference: formula g1_achieved = (true & t2_achieved & t3_achieved)
edgeV2:    formula g1_achieved = (T2_achieved & T3_achieved)
```

**Completion rule (when it is marked done) differs** — 3× in 3 model(s). Example: `G1` in `freeform/freeform_000`

```
reference: [achieved_G1] g1_state=1 & g1_achieved & t2_state=0 & t3_state=0 -> (g1_state'=0)
edgeV2:    [achieved_G1] g1_state=1 & g1_achieved & T2_pursued=0 & T3_pursued=0 -> (g1_state'=0)
```

**Give-up rule (when it stops without being achieved) differs** — 3× in 3 model(s). Example: `G1` in `freeform/freeform_000`

```
reference: [skip_G1] !g1_achieved & g1_state=1 & t2_state=0 & t3_state=0 & G1_achievable * N <= decision_G1 -> (g1_state'=0)
edgeV2:    [skip_G1] !g1_achieved & g1_state=1 & T2_pursued=0 & T3_pursued=0 & G1_achievable*10.0 <= decision_G1 -> (g1_state'=0)
```

### Any order — 1 of 1 goals differ

**Relative share used to pick the next child is in the reference but missing from the edgeV2 output** — 2× in 1 model(s). Example: `G4` in `reference/random_N10_d2_w2_002`

```
reference: formula T5_relative = t5_achieved ? 0 : T5_achievable/(T5_achievable + (t6_achieved ? 0 : T6_achievable))
edgeV2:    (not declared)
```

**Rule for starting a child differs** — 2× in 1 model(s). Example: `G4` in `reference/random_N10_d2_w2_002`

```
reference: [pursue_T5] !g4_achieved & g4_state=1 & G4_achievable*N>decision_G4 & t6_state=0 & T5_relative*N>_decision_G4 -> true
edgeV2:    [pursue_T5] !g4_achieved & g4_state=1 & G4_achievable*10.0 > decision_G4 & t6_state!=1 & (t6_state=1 | (T5_achievable/(T5_achievable+T6_achievable))*10.0 > _decision_G4) -> true
```

**Achievability estimate (drives the pursue/skip decisions) is computed differently** — 1× in 1 model(s). Example: `G4` in `reference/random_N10_d2_w2_002`

```
reference: formula G4_achievable = g4_achieved ? 0 : 1* (!t5_achieved ? T5_achievable : 1)* (!t6_achieved ? T6_achievable : 1)
edgeV2:    formula G4_achievable = T5_achievable * T6_achievable
```

**"achieved" condition is computed differently** — 1× in 1 model(s). Example: `G4` in `reference/random_N10_d2_w2_002`

```
reference: formula g4_achieved = (true & t5_achieved & t6_achieved)
edgeV2:    formula g4_achieved = (T5_achieved & T6_achieved)
```

**Completion rule (when it is marked done) differs** — 1× in 1 model(s). Example: `G4` in `reference/random_N10_d2_w2_002`

```
reference: [achieved_G4] g4_state=1 & g4_achieved & t5_state=0 & t6_state=0 -> (g4_state'=0)
edgeV2:    [achieved_G4] g4_state=1 & g4_achieved & T5_pursued=0 & T6_pursued=0 -> (g4_state'=0)
```

**Give-up rule (when it stops without being achieved) differs** — 1× in 1 model(s). Example: `G4` in `reference/random_N10_d2_w2_002`

```
reference: [skip_G4] !g4_achieved & g4_state=1 & t5_state=0 & t6_state=0 & G4_achievable * N <= decision_G4 -> (g4_state'=0)
edgeV2:    [skip_G4] !g4_achieved & g4_state=1 & T5_pursued=0 & T6_pursued=0 & G4_achievable*10.0 <= decision_G4 -> (g4_state'=0)
```

### Interleaved — 1 of 1 goals differ

**Achievability estimate (drives the pursue/skip decisions) is computed differently** — 1× in 1 model(s). Example: `G1` in `reference/random_N10_d2_w2_001`

```
reference: formula G1_achievable = g1_achieved ? 0 : 1* (!t2_achieved ? T2_achievable : 1)* (!t3_achieved ? T3_achievable : 1)
edgeV2:    formula G1_achievable = T2_achievable * T3_achievable
```

**"achieved" condition is computed differently** — 1× in 1 model(s). Example: `G1` in `reference/random_N10_d2_w2_001`

```
reference: formula g1_achieved = (true & t2_achieved & t3_achieved)
edgeV2:    formula g1_achieved = (T2_achieved & T3_achieved)
```

**Completion rule (when it is marked done) differs** — 1× in 1 model(s). Example: `G1` in `reference/random_N10_d2_w2_001`

```
reference: [achieved_G1] g1_state=1 & g1_achieved & t2_state=0 & t3_state=0 -> (g1_state'=0)
edgeV2:    [achieved_G1] g1_state=1 & g1_achieved & T2_pursued=0 & T3_pursued=0 -> (g1_state'=0)
```

**Give-up rule (when it stops without being achieved) differs** — 1× in 1 model(s). Example: `G1` in `reference/random_N10_d2_w2_001`

```
reference: [skip_G1] !g1_achieved & g1_state=1 & t2_state=0 & t3_state=0 & !(T2_achievable*N>decision_T2 | T3_achievable*N>decision_T3 | false) -> (g1_state'=0)
edgeV2:    [skip_G1] !g1_achieved & g1_state=1 & T2_pursued=0 & T3_pursued=0 -> (g1_state'=0)
```

### Alternative — 4 of 4 goals differ

**Rule for starting a child differs** — 4× in 3 model(s). Example: `G0` in `freeform/freeform_000`

```
reference: [pursue_G4] !g0_achieved & g0_state=1 & G0_achievable*N>decision_G0 & g1_state=0 & (G4_achievable/(G1_achievable+G4_achievable+0))*N > _decision_G0 & !(G1_achievable/(G1_achievable+G4_achievable+0))*N > _decision_G0 -> true
edgeV2:    [pursue_G4] !g0_achieved & g0_state=1 & G0_achievable*10.0 > decision_G0 & g1_state=0 & (G1_achievable/(G1_achievable+G4_achievable))*10.0 <= _decision_G0 -> true
```

**Give-up rule (when it stops without being achieved) differs** — 4× in 3 model(s). Example: `G0` in `freeform/freeform_000`

```
reference: [skip_G0] !g0_achieved & g0_state=1 & g1_state=0 & g4_state=0 & G0_achievable * N <= decision_G0 -> (g0_state'=0)
edgeV2:    [skip_G0] !g0_achieved & g0_state=1 & g1_state=0 & g4_state=0 -> (g0_state'=0)
```

**"achieved" condition is computed differently** — 1× in 1 model(s). Example: `G4` in `reference/random_N10_d2_w2_001`

```
reference: formula g4_achieved = (false | t5_achieved | t6_achieved)
edgeV2:    formula g4_achieved = (T5_achieved | T6_achieved)
```

**Completion rule (when it is marked done) differs** — 1× in 1 model(s). Example: `G4` in `reference/random_N10_d2_w2_001`

```
reference: [achieved_G4] g4_state=1 & g4_achieved & t5_state=0 & t6_state=0 -> (g4_state'=0)
edgeV2:    [achieved_G4] g4_state=1 & g4_achieved & T5_pursued=0 & T6_pursued=0 -> (g4_state'=0)
```

### Choice — 2 of 2 goals differ

**Achievability estimate (drives the pursue/skip decisions) is computed differently** — 2× in 2 model(s). Example: `G4` in `freeform/freeform_000`

```
reference: formula G4_achievable = g4_chosen=1 ? T5_achievable:g4_chosen=2 ? T6_achievable:(0 + T5_achievable + T6_achievable - 1 * T5_achievable * T6_achievable )
edgeV2:    formula G4_achievable = T5_achievable + T6_achievable - (T5_achievable * T6_achievable)
```

**"achieved" condition is computed differently** — 2× in 2 model(s). Example: `G4` in `freeform/freeform_000`

```
reference: formula g4_achieved = (false | t5_achieved | t6_achieved)
edgeV2:    formula g4_achieved = (T5_achieved | T6_achieved)
```

**Completion rule (when it is marked done) differs** — 2× in 2 model(s). Example: `G4` in `freeform/freeform_000`

```
reference: [achieved_G4] g4_state=1 & g4_achieved & t5_state=0 & t6_state=0 -> (g4_state'=0)
edgeV2:    [achieved_G4] g4_state=1 & g4_achieved & T5_pursued=0 & T6_pursued=0 -> (g4_state'=0)
```

**Rule for starting a child differs** — 2× in 2 model(s). Example: `G4` in `freeform/freeform_000`

```
reference: [pursue_T6] !g4_achieved & g4_state=1 & g4_chosen=0 & G4_achievable*N>decision_G4 & t5_state=0 & (T6_achievable/(T5_achievable+T6_achievable+0))*N > _decision_G4 & !(T5_achievable/(T5_achievable+T6_achievable+0))*N > _decision_G4 -> (g4_chosen'=2)
edgeV2:    [pursue_T6] !g4_achieved & g4_state=1 & g4_chosen=0 & G4_achievable*10.0 > decision_G4 & t5_state=0 & (T5_achievable/(T5_achievable+T6_achievable))*10.0 <= _decision_G4 -> (g4_chosen'=2)
```

**Give-up rule (when it stops without being achieved) differs** — 2× in 2 model(s). Example: `G4` in `freeform/freeform_000`

```
reference: [skip_G4] g4_chosen=0 & !g4_achieved & g4_state=1 & t5_state=0 & t6_state=0 & G4_achievable * N <= decision_G4 -> (g4_state'=0)
reference: [skip_G4] !g4_achieved & g4_state=1 & t5_state=0 & g4_chosen=1 & T5_achievable*N <= decision_T5 -> (g4_state'=0)
reference: [skip_G4] !g4_achieved & g4_state=1 & t6_state=0 & g4_chosen=2 & T6_achievable*N <= decision_T6 -> (g4_state'=0)
edgeV2:    [skip_G4] !g4_achieved & g4_state=1 & T5_pursued=0 & T6_pursued=0 -> (g4_state'=0)
```

### Degradation — 1 of 1 goals differ

**"achieved" condition is computed differently** — 1× in 1 model(s). Example: `G0` in `reference/random_N10_d2_w2_002`

```
reference: formula g0_achieved = (g1_achieved | (g1_failed=3 & g4_achieved))
edgeV2:    formula g0_achieved = (g1_achieved | g4_achieved)
```

**A state variable of the reference is missing from the edgeV2 output** — 1× in 1 model(s). Example: `G0` in `reference/random_N10_d2_w2_002`

```
reference: g1_failed : [0..3]
edgeV2:    (not declared)
```

**Give-up rule (when it stops without being achieved) differs** — 1× in 1 model(s). Example: `G0` in `reference/random_N10_d2_w2_002`

```
reference: [skip_G0] !g0_achieved & g0_state=1 & g1_state=0 & g1_failed<3 & G1_achievable*N <= decision_G1 -> (g0_state'=0)
reference: [skip_G0] g1_failed=3 & !g0_achieved & g0_state=1 & g1_state=0 & g4_state=0 & G0_achievable * N <= decision_G0 -> (g0_state'=0)
edgeV2:    [skip_G0] !g0_achieved & g0_state=1 & g1_state=0 & g4_state=0 -> (g0_state'=0)
```

### Task — 16 of 16 tasks differ

**A state variable of the reference is missing from the edgeV2 output** — 32× in 4 model(s). Example: `T2` in `freeform/freeform_000`

```
reference: t2_state : [0..1]
edgeV2:    (not declared)
```

**"achieved" condition is in the reference but missing from the edgeV2 output** — 16× in 4 model(s). Example: `T2` in `freeform/freeform_000`

```
reference: formula t2_achieved = (t2_achieved_=1)
edgeV2:    (not declared)
```

**Completion rule (when it is marked done) differs** — 16× in 4 model(s). Example: `T2` in `freeform/freeform_000`

```
reference: [achieved_T2] t2_state=1 & t2_achieved_=1 -> (t2_state'=0)
edgeV2:    [achieved_T2] t2_state=1 & t2_achieved -> true
```

**Start rule (when it becomes active) differs** — 16× in 4 model(s). Example: `T2` in `freeform/freeform_000`

```
reference: [pursue_T2] t2_state=0 & t2_achieved_=0 -> (t2_state'=1)
edgeV2:    [pursue_T2] t2_state=0 & !t2_achieved -> (t2_state'=1)
```

**Attempt rule (the task succeeds with its probability) differs** — 16× in 4 model(s). Example: `T2` in `freeform/freeform_000`

```
reference: [try_T2] t2_state=1 & t2_achieved_=0 -> T2_achievable: (t2_achieved_'=1) + 1-T2_achievable: (t2_state'=0)
edgeV2:    [try_T2] t2_state=1 & !t2_achieved -> T2_achievable: (t2_achieved'=1) + 1-T2_achievable: (t2_state'=0)
```

**A decision constant of the reference is missing from the edgeV2 output** — 6× in 3 model(s). Example: `T5` in `freeform/freeform_000`

```
reference: const int decision_T5;
edgeV2:    (not declared)
```

### Whole model

**The discretisation constant N is missing from the edgeV2 output (achievabilities are scaled by a literal instead)** — 4× in 4 model(s). Example: `model` in `freeform/freeform_000`

```
reference: const int N;
edgeV2:    (not declared)
```

## Defects in the reference that edgeV2 does not copy

These are corrected in the reference before comparing, so they do not count as differences.

- **Choice goals could never give up on their chosen child** (4 occurrences). In the reference, the rule that lets a choice goal give up once its chosen child is no longer worth pursuing requires the goal to be active and inactive at the same time (`g<id>=1 & g<id>=0`), so it can never fire and the goal gets stuck. The intent is clearly "the chosen child is idle" (`g<child>=0`); edgeV2 implements that.
- **Choice-goal properties are glued together in the .pctl file** (2 occurrences). The reference writes the "only the chosen child runs" properties without a line break between them, so PRISM cannot parse them. A newline is inserted.

## Model checking results (PRISM 4.9)

| Model | edgeV2 model | Properties holding | P(root goal achieved) edgeV2 | reference | Same |
|---|---|---|---|---|---|
| `freeform/freeform_000` | ❌ does not load: Error: Unknown variable "t2_state" in update ("t2_state", line 90, column 45). | | | | |
| `freeform/freeform_001` | ❌ does not load: Error: Unknown variable "t10_state" in update ("t10_state", line 196, column 48). | | | | |
| `freeform/freeform_002` | ❌ does not load: Error: Unknown variable "t10_state" in update ("t10_state", line 207, column 48). | | | | |
| `reference/random_N10_d2_w2_000` | ❌ does not load: Error: Unknown variable "t2_state" in update ("t2_state", line 90, column 45). | | | | |
| `reference/random_N10_d2_w2_001` | ❌ does not load: Error: Unknown variable "t2_state" in update ("t2_state", line 87, column 45). | | | | |
| `reference/random_N10_d2_w2_002` | ❌ does not load: Error: Unknown variable "g1_failed" in update ("g1_failed", line 19, column 94). | | | | |

## Models

Each model folder holds `goal.txt` (edgeV2 input), `edgev2.prism` (output), `reference.prism` when the reference can express it, and `findings.json` with the raw differences.

| Model | Structure | Result |
|---|---|---|
| `freeform/freeform_000` | G0 needs one of G1 and G4 (alternative); G1 does T2 then T3; G4 needs one of T5 and T6 (choice, fixed once picked) | ❌ 40 problem(s) |
| `freeform/freeform_001` | G0 needs G1 and G11 (AND, no notation); G1 needs one of G2, T6 and G7 (OR, no notation); G2 does T3 then T4 then T5; G7 does T8 then T9 then T10; G11 does G12 and G14 in any order; G12 needs T13 (AND, no notation); G14 … | generated (no reference for this notation) |
| `freeform/freeform_002` | G0 does G1 then G4; G1 needs T2 and T3 (AND, no notation); G4 needs G5, T18 and T19 (AND, no notation); G5 needs one of G6, G9 and G13 (choice, fixed once picked); G6 does T7 and T8 in parallel; G9 does T10, T11 and T12… | generated (no reference for this notation) |
| `reference/random_N10_d2_w2_000` | G0 needs one of G1 and G4 (alternative); G1 does T2 then T3; G4 needs one of T5 and T6 (choice, fixed once picked) | ❌ 40 problem(s) |
| `reference/random_N10_d2_w2_001` | G0 needs one of G1 and G4 (alternative); G1 does T2 and T3 in parallel; G4 needs one of T5 and T6 (alternative) | ❌ 37 problem(s) |
| `reference/random_N10_d2_w2_002` | G0 tries G1 up to 3×, then any of G1 and G4; G1 does T2 then T3; G4 does T5 and T6 in any order | ❌ 42 problem(s) |
