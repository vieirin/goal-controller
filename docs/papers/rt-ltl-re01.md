# RT-LTL oracle: van Lamsweerde RE'01 + KAOSTools grammar

Source (paper): Axel van Lamsweerde, "Goal-Oriented Requirements Engineering: A Guided
Tour", Proc. 5th IEEE Intl. Symposium on Requirements Engineering (RE'01), Toronto, Canada,
Aug. 2001, pp. 249–262.
Downloaded from the author's own page: https://webperso.info.ucl.ac.be/~avl/files/RE01.pdf
(mirror seen but not used: https://homepages.uc.edu/~niunn/courses/RE-refs/GuidedTour01.pdf)
No DOI printed on the PDF itself; © IEEE, author's self-archived copy, transcribed here for
reference (fair-use excerpts only — formulas, goal-type definitions, and named examples).

Source (grammar): github.com/ancailliau/KAOSTools (MIT licence), cloned at
`.cache/kaos/KAOSTools` (not committed), commit present when cloned 2026-10-21. The grammar
lives in one PEG file: `Parsing/Parsers/GoalModelParser.peg` (289 lines) — referenced below as
`GoalModelParser.peg:<line>`.

This file is the oracle for KAOS stress-test step 7/8 (issues #194, #209, #210, #211, #212).
Local page numbers below are PDF page numbers (10-page PDF; running head omits page 1).

## 1. What the paper actually says about the formal layer (p.4, Section 4 "Specifying goals")

> "Formal specifications assert the goal formulation in a fully formal system amenable to
> analysis. In KAOS, such assertions are written in a real-time linear temporal logic heavily
> inspired from [Man92, Koy92] with the usual operators over past and future states, bound by
> time variables; semantically, they capture maximal sets of desired behaviors [Dar93, Let01].
> The KAOS language is "2-button" in that the formal assertion layer is optional; it is used
> typically for critical aspects of the system only."

**UNREADABLE / not present**: this paper does *not* print an operator table. It never
spells out ○ (next), ● (previously), ♦/◇ (eventually), □ (always), ■ (historically), the
bounded forms ◇≤d / □≤d / ■≤d, the `@P` state-label operator, or a strong ⇒/⇔. Those belong to
the KAOS formal papers it cites — [Dar93] (Dardenne, van Lamsweerde & Fickas, TSE'93) and
[Let01] (Letier's PhD) — not to this guided tour. Only the operators actually used in this
paper's own example formulas are attested here (Section 2 below); do not infer the rest of the
standard KAOS RT-LTL operator set from this paper.

## 2. Operators actually used in this paper's formulas, with their stated meaning

| Operator (as printed) | Paper's gloss | Where (page, example) |
| --- | --- | --- |
| `◊` | "sometime in the future" | p.4, refinement pattern `P⇒◊R, R⇒◊Q` |
| `W` | "always in the future unless" | p.4, pattern `P∧R⇒◊Q, P⇒◊R, P⇒PWQ` |
| `o` (lowercase, next-state) | "in the next state" | p.6, `DoorsClosedWhileMoving` example: `⇒ tr.Doors='closed' ∧ o(tr.Doors='closed')` |
| `■≤0.5 sec ¬∃...` | bounded "historically" — "no command has been sent in every past state up to one half-second" | p.9, `ReqTrig for CmdMsgSentInTime` |
| `⇒` | plain (non-strong) implication, used throughout goal FormalDefs | throughout §4–§6 |

No `●`, `♦` (distinct from `◊`), `□`, bare `■` (unbounded), `≤d` on `◊`/`□`, or `@P` appear
anywhere in the PDF text as extracted. Any use of those in the dialect/engine oracle must come
from [Dar93]/[Let01], not from this transcription.

## 3. Goal-type semantics (p.3, Section 3 "Modeling goals", classification by temporal behaviour)

> "Achieve (resp. cease) goals generate system behaviours, in that they require some target
> property to be eventually satisfied in some future state (resp. denied); maintain (resp.
> avoid) goals restrict behaviours, in that they require some target property to be permanently
> satisfied in every future state (resp. denied) unless some other property holds. Optimize
> goals compare behaviours to favor those which better ensure some soft target property."

So informally: Achieve ~ `◊ target`, Cease ~ `◊ ¬target`, Maintain ~ `□ target` (or `target W
other`), Avoid ~ `□ ¬target` (or `¬target W other`). The paper states this only in prose, never
as a formula table.

## 4. Typed first-order layer: every quantified/typed example formula in the paper

All formulas below are transcribed verbatim (Unicode operators preserved), with page and
context.

p.5–6, train control case study (HOW-refinement example):
```
Goal Achieve [TrainProgress]
 FormalDef (∀ tr: Train, b: Block) [On (tr, b) ⇒ ◊ On (tr, b+1)]

Goal Achieve [ProgressWhenGoSignal]
 FormalDef ∀ tr: Train, b: Block
              On (tr, b) ∧ Go[b+1] ⇒ ◊ On (tr, b+1)

Goal Achieve [SignalSetToGo]
 FormalDef ∀ tr: Train, b: Block
              On (tr, b) ⇒ ◊ Go[b+1]

Goal Maintain [TrainWaiting]
 FormalDef ∀ tr: Train, b: Block
              On (tr, b) ⇒ On (tr, b) W On (tr, b+1)
```
(Note: the PDF's text layer garbles the first FormalDef's quantifier as "∀ t:r Train, b: Block"
— almost certainly an extraction artefact of "∀ tr: Train, b: Block"; flagged, not silently
fixed.)

p.6, door-closing example and its derivation rule:
```
Goal Maintain [DoorsClosedWhileMoving]
 FormalDef ∀ tr: Train, loc, loc': Location
             At (tr, loc) ∧ o At (tr, loc') ∧ loc <> loc'
             ⇒ tr.Doors = 'closed' ∧ o (tr.Doors = 'closed')
```
Derivation (operationalization) rule, schematic (not typed):
```
G: P ∧ (P1 ∧ o P2 ⇒ Q1 ∧ o Q2) , DomPre: P1, DomPost: P2
---------------------------------------------------------------------
           ReqPre for G: Q1 , ReqPost for G: Q2
```
Resulting operation:
```
Operation Move
 Input tr: Train; loc, loc': Location ; Output At
 DomPre At (tr, loc) ∧ loc <> loc'
 DomPost At (tr, loc')
 RequiredPre for DoorsClosedWhileMoving: tr.Doors = 'closed'
 RequiredPost for DoorsClosedWhileMoving: tr.Doors = 'closed'
```

p.8–9, BART speed/acceleration case study:
```
Goal Maintain[SafeCmdMsg]
 FormalDef ∀ cm: CommandMessage, ti1, ti2: TrainInfo
             cm.Sent ∧ cm.TrainID = ti1.TrainID ∧ FollowingInfo (ti1, ti2)
             ⇒ cm.Accel ≤ F (ti1, ti2) ∧ cm.Speed > G (ti1)
```
Operation + requirements strengthening it:
```
Operation SendCommandMessage
 Input Train {arg tr}
 Output ComandMessage {res cm}
 DomPre ¬ cm.Sent
 DomPost cm.Sent ∧ cm.TrainID = tr.ID

Operation SendCommandMessage
 Input Train {arg tr}, TrainInfo; Output ComandMsg {res cm}
 DomPre ... ; DomPost ...
 ReqPost for SafeCmdMsg:
   Tracking (ti1, tr) ∧ Following (ti1, ti2)
       → cm.Acc ≤ F (ti1, ti2) ∧ cm.Speed > G (ti1)
  ReqTrig for CmdMsgSentInTime:
   ■≤0.5 sec ¬ ∃ cm2: CommandMessage:
                 cm2.Sent ∧ cm2.TrainID = tr.ID
```

p.9, divergent goal pair and its generated boundary condition:
```
Goal Maintain [CmdedSpeedCloseToPhysicalSpeed]
 FormalDef ∀ tr: Train
             tr.AccCM ≥ 0
               ⇒ tr.SpeedCM ≤ tr.Speed + f (dist-to-obstacle)

Goal Maintain [CmdedSpeedAbove7mphOfPhysicalSpeed]
 FormalDef ∀ tr: Train
             tr.AccCM ≥ 0 ⇒ tr.SpeedCM > tr.Speed + 7
```
Generated boundary condition making them inconsistent:
```
◊ (∃ tr: Train) (tr.AccCM ≥ 0 ∧ f (dist-to-obstacle) ≤ 7)
```
Resolved (weakened) goal:
```
Goal Maintain [CmdedSpeedAbove7mphOfPhysicalSpeed]
 FormalDef ∀ tr: Train
             tr.AccCM ≥ 0 ⇒ tr.SpeedCM > tr.Speed + 7
                            ∨ f (dist-to-obstacle) ≤ 7
```

## 5. Obstacle form (p.7, Section 5.4 "Goal-based conflict management" — obstacle definition)

The paper gives the obstruction definition as a satisfaction/consistency pair, not as the
TSE'00 `◇(C ∧ ¬T)` pattern (that pattern is **not quoted in this paper** — it is not present in
the extracted text; do not attribute it here):
```
An obstacle O is said to obstruct a goal G in a domain Dom iff
      {O, Dom} |= ¬ G           obstruction
      Dom |=/= ¬ O              domain consistency
```
Companion verification-relation formula (p.5, Section 5.1):
```
R, As, D |== g   with   R, As, D |=/= false
```
(R = requirements, As = environmental assumptions, D = domain properties, g ranges over goals
G.)

## 6. Figure 4 as text (p.9, "Conflict in speed/acceleration control")

AND-tree, root at bottom, read top-down as printed:
```
ServeMorePsgers
├── Min [DistBetwTrains]
│     └── Maintain [CmdedSpeedCloseToPhysicalSpeed]
│           └── DistanceBetweenTrainsIncreasedWithCmdedSpeed
│                 └── SafeTransport
└── Max [TrainSpeed]
      └── Maintain [CmdedSpeedAbove7mphOfPhysicalSpeed]
            └── LimitedAccelerWhenCmdedSpeedAbove7mphOfPhysicalSpeed
                  └── SmoothMove
```
(Two leaf labels — `SafeTransport`, `SmoothMove` — are the named conflicting top goals the
prose discusses; the figure's box layout in the PDF puts `SafeTransport` and `SmoothMove` side
by side at the bottom, each under its own branch.)

Figure 3 (p.9, "Goal refinement"), AND-tree:
```
Maintain [WCS-DistBetweenTrains]
├── Maintain [SafeSpeed/AccelerationCommanded]
├── Maintain [SafeTrainResponseToCommand]
└── Maintain [NoSuddenStopOfPrecedingTrain]
```

Figure 2 (p.9, "Enriching the goal graph by WHY elicitation") — only a two-leaf fragment is
legible in the extracted text:
```
[TrainEnteringClosedGate]   [SwitchInWrongPosition]
```
Parent/full tree above these two leaves is **UNREADABLE** in the `-layout` text extraction
(the surrounding box-and-arrow art did not survive to text); would need the figure image to
recover, which step 2 of this task forbids rendering.

## 7. KAOSTools sugar — `Parsing/Parsers/GoalModelParser.peg`, every formula construct

The grammar has two independent expression families: `Formula` (full real-time LTL, used in
goal `FormalDef`) and `LogicFormula` (plain propositional logic, no temporal operators — used
elsewhere, e.g. obstacle/domain-property bodies). Line numbers from the 289-line file.

| Construct (KAOSTools surface syntax) | Grammar rule : line | RT-LTL equivalent |
| --- | --- | --- |
| `forall x: T, y: U . φ` | `Formula:123-125` | `∀x:T, y:U · φ` (first-order universal) |
| `exists x: T . φ` | `Formula:123,125` | `∃x:T · φ` |
| `when ψ then φ` | `StrongBinary:130-134` | strong implication `ψ ⇒ φ` |
| `if ψ then φ` | `Binary:136-141` | plain `ψ ⇒ φ` |
| `ψ iff φ` | `Binary:138` | `ψ ⇔ φ` |
| `ψ until φ` | `TemporalBinary:143-144` | `ψ U φ` |
| `ψ until , <bound>, φ` (bound via `EventuallyTimeBoundEmphasis`) | `TemporalBinary:144`, `EventuallyTimeBound:224-229` | bounded `ψ U≤d φ` |
| `ψ release φ` | `TemporalBinary:145` | `ψ R φ` (dual of `until`) |
| `ψ unless φ` (optionally with a `GloballyTimeBoundEmphasis` bound) | `TemporalBinary:146` | `ψ W φ` (weak-until); bounded form ~ `ψ W≤d φ` |
| `ψ and φ` | `And:151-154` | `ψ ∧ φ` |
| `ψ or φ` | `Or:157-160` | `ψ ∨ φ` |
| `not φ` | `Unary:163-164` | `¬φ` |
| `next φ` | `Unary:165` | `○ φ` |
| `sooner-or-later φ` / `eventually φ` (optional bound via `EventuallyTimeBoundEmphasis`) | `Unary:166` | `◊ φ`, bounded `◊≤d φ` |
| `always φ` / `globally φ` (optional bound via `GloballyTimeBoundEmphasis`) | `Unary:167` | `□ φ`, bounded `□≤d φ` |
| `(φ)` parenthesized | `Atom:177` | grouping |
| `a.attr` (attribute access) | `AttributeReference:196-199` | `a.attr` |
| `(x, y, ...) in R` (relation membership) | `RelationReference:201-204` | `R(x, y, …)` |
| `p(x, y, ...)` (predicate application) | `PredicateReference:206-209` | `p(x, y, …)` |
| `x` bare variable reference | `VariableReference:211-212` | `x` |
| comparisons `==`, `!=`, `>=`, `<=`, `>`, `<` | `Comparator:186-189`, `Comparison:181-184` | same, infix |
| bound clause `, <time-bound>, ` wrapping `before|after|in <N unit>` | `EventuallyTimeBoundEmphasis:214-217`, `EventuallyTimeBound:224-229` | the subscript `≤d` on `◊`/`U` |
| bound clause `for (strictly) more|less than <N unit>` / `for <N unit>` | `GloballyTimeBoundEmphasis:219-222`, `GloballyTimeBound:231-236` | the subscript `≤d`/`≥d` on `□`/`W` |
| time constraints `<int> <unit> <int> <unit> ...` | `TimeConstraint:238-241`, `TimeUnit:243-249` | numeric duration, units day/hour/minute/second/milisecond (and `d/h/min/s/ms` abbreviations) |
| plain propositional sugar (no temporal ops): `if...then`, `...iff...`, `...and...`, `...or...`, `not...`, `true`/`false`, attribute/relation/predicate refs | `LogicFormula*:251-289` | ordinary first-order logic, used where `Formula`'s temporal layer is not wanted (e.g. domain properties) |

Typed first-order layer in the grammar itself: `Variable := [a-z]+ [a-zA-Z0-9]*` (line 119-121,
untyped at the lexical level) is given a type only at `Formula`'s `forall`/`exists` binder
(`Variable S ':' S Identifier`, line 124/125) and reused by `AttributeReference` (`Variable '.'
Identifier`, line 196-199), `RelationReference` (line 201-204), and `PredicateReference`
(`Identifier '(' Variable,... ')'`, line 206-209) — i.e. KAOSTools' "objects, attributes,
predicates" are: typed quantified variables, dotted attribute access, and n-ary predicate/
relation application, with no separate entity/attribute-declaration syntax inside formulas
(entity/attribute declarations live in `DeclareItem`, line 23-25, outside the formula grammar).

## 8. Open items for #194/#209/#210/#211/#212

- The paper gives **no operator table and no bounded-■/□/◇ example with the `≤d` subscript
  notation** (only the ad-hoc `■≤0.5 sec` on p.9) and **no `@P`, `●`, bare `□`, or strong
  `⇒`/`⇔` symbol** anywhere. If the stress-test oracle needs those, source them from [Dar93]
  (TSE'93) or [Let01], not this paper — flagged rather than guessed.
  - TSE'00 obstacle pattern `◇(C ∧ ¬T)`: **not quoted in this paper**; the paper's own
    obstruction definition (Section 5 above) is a `|=` pair, not an LTL formula.
- Figure 2's full tree above the two legible leaves is unreadable in `-layout` text extraction.
