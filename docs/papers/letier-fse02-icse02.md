# Letier & van Lamsweerde — KAOS agent/operationalisation papers (transcription)

Transcribed for reference as an oracle for the KAOS stress test (issues #194, #209, #210, #211, #212 in `vieirin/goal-controller`). Three sources, each fetched from the authors' UCL page and converted to text with `pdftotext -layout` in a `minidocks/poppler` Docker container (never rendered to images, no local toolchain installed). PDFs live in `.cache/kaos/` (not committed).

1. **E. Letier, A. van Lamsweerde, "Agent-Based Tactics for Goal-Oriented Requirements Elaboration."** Proc. ICSE'2002, 24th International Conference on Software Engineering, Orlando, ACM Press, May 2002.
   Source: http://www0.cs.ucl.ac.uk/staff/e.letier/publications/icse02.pdf
   © ACM, transcribed for reference. (DOI 10.1145/581339.581353 per ACM DL / ResearchGate record.)

2. **E. Letier, A. van Lamsweerde, "Deriving Operational Software Specifications from System Goals."** SIGSOFT 2002/FSE-10, 10th ACM SIGSOFT Symposium on the Foundations of Software Engineering, Charleston, SC, Nov. 18–22, 2002, ACM, pp. 119–128.
   Source: http://www0.cs.ucl.ac.uk/staff/e.letier/publications/OperationalizationFSE02.pdf
   © 2002 ACM 1-58113-514-9/02/0011, transcribed for reference. (DOI 10.1145/587068.587070.)

3. **E. Letier, J. Kramer, J. Magee, S. Uchitel, "Deriving Event-Based Transition Systems from Goal-Oriented Requirements Models."** Automated Software Engineering (ASE Journal), Vol. 15, No. 2, pp. 175–206, 2008 (the "KAOS2LTSA" paper).
   Source: bundled inside `KAOS2LTSA-ASEJ-Models.zip` at `KAOS2LTSA - ASEJ 2008/KAOS2LTSA-ASEJ.pdf` (28 pp., `file`/`pdfinfo` disagree — `pdfinfo` confirms 28 pages, PDF 1.3, easyPDF SDK 4.3 producer); zip fetched from http://www0.cs.ucl.ac.uk/staff/e.letier/publications/KAOS2LTSA-ASEJ-Models.zip.
   DOI http://dx.doi.org/10.1007/s10515-008-0027-7. © Springer, transcribed for reference.
   Note: an attempted direct download of `http://www.cs.ucl.ac.uk/staff/e.letier/publications/KAOS2LTSA-ASEJ.pdf` (http, no `www0`) timed out — `www.cs.ucl.ac.uk` port 80 is unreachable from this host; the copy bundled in the models zip was used instead and verified as the correct 28-page paper.

Unicode operators kept exactly as printed where legible: `○` (next), `●`/`•` (previous), `◇`/`◊` (eventually), `♦` (some time in the past), `□`/`q`/`o`/`[]` (always — poppler rendered the "always" box operator as `o` or `q` depending on font encoding; this is noted inline), `■` not used by these papers, `W` (unless/awaits), `U` (until), `⇒`/`->` (implies), `≤`/`~d` (deadline bound).

---

## 1. ICSE'02 — Agent-Based Tactics for Goal-Oriented Requirements Elaboration

### 1.1 Agent model (Section 2)

An agent is characterized by:
- an **interface**: two disjoint sets of state variables — `Mon(ag)` (monitored) and `Ctrl(ag)` (controlled);
- a **transition system** `<Init_ag, Next_ag>` where `Init_ag ⊆ State(Ctrl(ag))` and `Next_ag ⊆ Path(Mon(ag) ∪ Ctrl(ag)) × State(Ctrl(ag))`, mapping every temporal sequence of monitored/controlled states to a next controlled state;
- a **responsibility relation** mapping the agent to the goals it is responsible for.

Each state variable is controlled by **at most one** agent (split a variable needing multiple controllers); a variable may be monitored by several agents.

**Responsibility consistency rule:** `if Responsible(ag, G) then RUN(ag) ⊆ HIST(G)`, where `RUN(ag)` is the set of possible runs of `ag` and `HIST(G)` is the set of histories prescribed by goal `G`.

Temporal operators used (ICSE'02 notation): `○` next, `●` previous, `◇` eventually, `q` always (box), `W` unless, `U` until, `A ⇒ C` ("in every future state A implies C", i.e. `□(A→C)`), `@P` ≡ `●¬P ∧ P` (P holds now, didn't hold just before), `◇≤ku P` (P within k time units u), `q≤d P` (P holds in every state up to deadline d).

### 1.2 Realizability — formal definition (Section 3)

Notation: `Mon(ag)`, `Ctrl(ag)`, `State(V)` (all states of variables in V), `Path(V)` (all state sequences over V).

**Definition (Realizability).** A goal `G` is realizable by agent `ag` iff there exists a transition system `Δ_ag = <Init_ag, Next_ag>` with `Init_ag ⊆ State(Ctrl(ag))` and `Next_ag ⊆ Path(Mon(ag) ∪ Ctrl(ag)) × State(Ctrl(ag))` such that `RUN(ag) = HIST(G)` (**equality**, not mere inclusion — this is what rules out an agent that could "cheat" by being more restrictive than the goal requires, e.g. always holding `PumpSwitch = 'On'` to trivially satisfy `WaterLevel ≥ 'High' ⇒ ○PumpSwitch = 'On'`).

Worked mine-pump example (Section 3): three agents — `PumpController` (monitors `HighWaterSignal`, `LowWaterSignal`; controls `PumpSwitch`), `HighSensor` (monitors `WaterLevel`; controls `HighWaterSignal`), `LowSensor`. Goal `Maintain[PumpSwitchOnWhenHighWaterDetected]`:
```
HighWaterSignal = 'On' ⇒ ○ PumpSwitch = 'On'
```
is realizable by `PumpController` via `<Init, Next>` with `s ∈ Init` for all `s ∈ State(Ctrl(PumpController))`, and `(p,s) ∈ Next` iff `if p_n(HighWaterSignal) = On then s(PumpSwitch) = On` (`p_n` = last state of path `p`).

Contrast: `Maintain[PumpMotorOnWhenHighWater]` = `WaterLevel ≥ 'High' ⇒ ○PumpMotor = 'On'` is **not** realizable by `PumpController` — `WaterLevel` is not in `Mon(PumpController)`, `PumpMotor` is not in `Ctrl(PumpController)`.

### 1.3 Pragmatic (syntactic) unrealizability conditions — Theorem (Section 4)

Partition goal variables into `C` (constrained by the goal) and `M` (all others). View goal `G` as a relation `G_{M,C} ⊆ Hist(M) × Hist(C)`.

**Theorem (Pragmatic conditions for unrealizability).** A goal `G` is not realizable by agent `ag` iff at least one of:

1. **Lack of monitorability**: goal refers to a variable in `M` not in `Mon(ag) ∪ Ctrl(ag)`: `M ⊄ Mon(ag) ∪ Ctrl(ag)`.
2. **Lack of controllability**: goal requires a variable not in `Ctrl(ag)` to be controlled: `C ⊄ Ctrl(ag)`.
3. **Reference to future**: the goal constrains values of some variable in `C` in terms of *future* values of variables in `M`.
4. **External unachievability**: some external condition `B` on unconstrained `M` variables makes the goal impossible: `B ⊨ ¬G` with `B ⊭ false`.
5. **Unbounded achievement**: the goal does not constrain the finite behaviors of `ag`.

The taxonomy is proved complete (full proof in Letier's PhD thesis [Let01], not reproduced in ICSE'02).

Illustrative example — Achieve[AmbulanceMobilized] for LAS (London Ambulance Service): unrealizable by the CAD agent for all three reasons at once (lack of monitorability of incident/ambulance location and availability, lack of controllability of mobilization/destination, external unachievability when no ambulance is near).
Railroad-crossing example: `Maintain[GateOpenWhenNoTrain]` — `∀cr: Crossing. q≤d ¬(∃tr:Train) InCrossing(tr,cr) ⇒ cr.Gate='open'` is unrealizable by `GateController` (reference to future + lack of monitorability/controllability). The `TrainController` "doors closed while moving" case is specifically called a **synchronization problem** (current value of a monitored variable constraining a controlled variable in the same state).

### 1.4 Catalog of agent-based refinement tactics (Section 5)

Each tactics has: motivation, precondition, heuristics, postcondition (effect on goal/agent/object models), variants/specializations, example of use. Patterns are proved correct once and for all.

**Tactics catalog structure (Figures 1–5, text form):**

- **Figure 1 — Resolve lack of monitorability**: `Add monitorability` → `Introduce accuracy goal`; `Split lack of monitorability` → `Replace unmonitorable state by monitorable events`, and under "Split with milestone" → `Split by chaining`, `Split by cases`.
- **Figure 2 — Resolve lack of controllability**: `Add controllability` → `Introduce actuation goal`; `Split lack of controllability` → `Replace uncontrollable state by controllable events`, and under "Split with milestone" → `Split by chaining`, `Split by cases`.
- **Figure 3 — Resolve reference to future**: `Resolve reference to strict future` → `Temporally weaken goal`, `Apply anticipation pattern`; `Resolve synchronization problem` → `Replace current by previous`, `Apply mutual exclusion pattern`.
- **Figure 4 — Resolve external unachievability**: `Weaken goal with unachievability condition`; `Prevent unachievability`.
- **Figure 5 — Resolve unbounded achievement**: `Add real-time bound`; `Replace "eventually" by "next"`.

**Tactics Introduce Accuracy Goal** — precondition: agent `ag` cannot monitor variable `m` in goal `G`. Heuristics: an intermediate "image" variable `im` can be related to `m` via an accuracy goal/domain property. Postcondition: new attribute/relationship `im`; `G` refined into (i) subgoal referring to `im` instead of `m`, (ii) companion accuracy goal relating `im` to `m`. Two AND-refinement variants:
```
   accuracy goal on variable:  G[m/im]  ∧  q(im = m)   ⟸  G
   accuracy goal on predicate: G[p(m)/q(im)] ∧ q(im) ⇔ p(m)  ⟸  G
```
Example of use (flight control): `WheelsTurning ⇒ ○ReverseThrustEnabled` refined into `WheelsPulseOn ⇒ ○ReverseThrustEnabled` + accuracy goal `WheelsPulseOn ⇔ WheelsTurning`.

**Tactics Introduce Tracking Object** (specializes Introduce Accuracy Goal) — heuristics: lack of monitorability for object `Ob` resolved by maintaining an internal image. Postcondition: object model gets `Ob --Tracking--> ObInfo` (1:1 relationship) with `m` on `Ob` mirrored by `m'` on `ObInfo`; goal model: `G` refined into `Maintain[ObjectTracked]`, `Maintain[AccurateObjectInfo]`, `G[Object/ObjectInfo]`. Worked with patient-monitoring example (`Patient`→`PatientInfo` Tracking relationship; `Maintain[PatientTracked]`, `Maintain[AccuratePatientInfo]`, `Achieve[AlarmForCriticalPulseRateInfo]`).

**Tactics Split Lack of Controllability With Milestone** — precondition: unrealizable `Achieve` goal `P ⇒ ◇T`, agent cannot control a variable in `T`. Heuristics: an intermediate milestone `M` reachable from `P` towards `T` can be identified. Postcondition — object model enriched with milestone's new objects/attrs; goal model refined per milestone-driven pattern:
```
        P ⇒ ◇T
       /        \
  P ⇒ ◇M      M ⇒ ◇T
```
Example: patient monitoring `Achieve[NurseInterventionForCriticalPulseRate]` split via milestone `M: (∃n:Nurse) Intervention(n,p)` into `Achieve[AlarmForCriticalPulseRate]` and `Achieve[NurseInterventionForAlarm]`.

**Tactics Prevent Unachievability** — motivation: resolve external unachievability. Precondition: `G` unsatisfiable when unachievability condition `B` holds. Heuristics: apply when `G` is a safety goal and `B` intolerable (else use "Weaken Goal With Unachievability Condition" instead). Postcondition — refinement pattern:
```
          G
        /    \
     ¬B*    G ∨ ¬B*       with ¬B* ⇒ ¬B
```
Example: LAS `Achieve[AmbulanceMobilizedInSector]` with unachievability condition `B` (no ambulance available in sector within 3 min) resolved into `Maintain[NearAmbulanceAvailability]` (`¬B*`) and `Achieve[AmbulanceAllocatedBasedOnIncidentFormWhenNearAmbulanceAvailable]`.

### 1.5 LAS worked example (Section 6, Figure 6)

Goal refinement graph, nodes and labelled refinement links (text form of Figure 6):

```
AmbulanceMobilized
  └─[Introduce tracking object: resolve lack of monitorability for Incident location]→
     { UrgentCallEncoded, AccurateIncidentForm, AmbulanceMobilizedBasedOnIncidentForm }
AmbulanceMobilizedBasedOnIncidentForm
  └─[Split lack of controllability with milestone: resolve lack of controllability for ambulance mobilization]→
     { AmbulanceAllocatedBasedOnIncidentForm, AllocatedAmbulanceMobilized }
AmbulanceAllocatedBasedOnIncidentForm
  └─[Prevent unachievability]→
     { NearAmbulanceAvailability, AmbulanceAllocatedBasedOnIncidentFormWhenNearAmbAvailable }
AmbulanceAllocatedBasedOnIncidentFormWhenNearAmbAvailable
  └─[Introduce tracking object: resolve lack of monitorability for ambulance status/location]→
     { AmbulanceTracked (via AmbulanceInfo), AccurateAmbulanceStatus&LocationInfo,
       AmbulanceAllocatedBasedOnIncidentFormAndAmbulanceInfoWhenNearAmbulanceAvailable }
```
This last subgoal is realizable by the CAD software agent; the accuracy subgoal is refined further into responsibility assignments for `AmbulanceStaff`, `RadioOperator`, `MobileDataTerminal`, `AmbulanceTracking`, `CAD`.

---

## 2. FSE'02 — Deriving Operational Software Specifications from System Goals

### 2.1 Four submodels and temporal logic (Section 2.1)

Model = goal model + object model + agent model + operation model, each with separate semantics, related by inter-model consistency rules.

Temporal operators used in FSE'02 (note: operator glyphs differ slightly from ICSE'02 due to font/ligature choices in the PDF — transcribed exactly as `pdftotext` rendered them):
```
○ next           ● previous
◇ eventually      ♦ some time in the past
o always-future   n always-past     (printed glyphs for □ in the future/past; poppler could not render the box operator and substituted "o"/"n" — flagged here, not guessed)
W unless          U until
◊≤d within deadline d       o≤d always up to deadline d
P B Q   "P has remained true back to the last time Q was true, if any"
P S=d Q "P has remained true since Q was true d time units ago"
∧ ∨ ¬ → ↔  standard;  ⇒ "strongly implies" P⇒Q iff o(P→Q);  ⇔ "strongly equivalent" P⇔Q iff o(P↔Q)
```
UNREADABLE: the precise glyph intended for "always" (□) renders as a lowercase "o" or "q" depending on surrounding ligatures in the extracted text of both papers; the source PDF likely uses a dedicated math-font box character not preserved by `pdftotext -layout`. Treat every bare "o" immediately preceding an open parenthesis in a temporal formula in this file as "always" (□), not the "next" operator, unless context (e.g. "○" already used nearby) says otherwise.

**Goal definition patterns** (Section 2.1.1):
```
Achieve:  C ⇒ ◇T,        C ⇒ ◇≤d T
Cease:    C ⇒ ◇¬T,       C ⇒ ◇≤d ¬T
Maintain: C ⇒ T,         C ⇒ T W N
Avoid:    C ⇒ ¬T,        C ⇒ ¬T W N
```
(C = current condition, T = target condition, N = new condition.)

### 2.2 Mine pump goal, object, agent models (Section 2.1.1–2.1.3)

```
Goal Maintain[PumpOnWhenHighWater]
  InformalDef The pump shall be on when the water level is too high
  FormalDef  ∀m: Mine, p: Pump
             m.WaterLevel ≥ 'High' ∧ HasPump(m,p) ⇒ □ p.Motor = 'On'
  Refines Avoid[MineOverflowed]
  RefinedTo HighWaterDetected, PumpSwitchOnWhenHighWaterDetected, PumpOnWhenPumpSwitchOn
```
(The conjunction of the three RefinedTo subgoals must entail the parent's formal assertion — every formal goal refinement generates a proof obligation.)

Subgoal example:
```
∀c: PumpController.  c.HighWaterFlag = 'On' ⇒ □ c.PumpSwitch = 'On'
```
assigned to `PumpController`, with agent-model interface:
```
Agent PumpController
  Monitors PumpController.HighWaterFlag, ...
  Controls PumpController.PumpSwitch, ...
  ResponsibleFor PumpSwitchOnWhenHighWaterDetected, ...
  Has PumpSwitch, HighWaterFlag: {On, Off}
```
Object model:
```
Entity Mine
  Has WaterLevel: WaterLevelUnit
Relationship HasPump
  Links Mine {card 0:1}, Pump {card 0:1}
```

### 2.3 Operation model (Section 2.1.4) — mine pump OPERATION/DOMPRE/DOMPOST/REQPRE/REQTRIG/REQPOST

```
Operation SwitchPumpOn
  Input c: PumpController; Output c: PumpController/PumpSwitch
  DomPre  c.PumpSwitch ≠ 'On'
  DomPost c.PumpSwitch = 'On'
  ReqTrig for PumpSwitchOnWhenHighWaterDetected:
    c.HighWaterFlag = 'On'

Operation SwitchPumpOff
  Input c: PumpController; Output c: PumpController/PumpSwitch
  DomPre  c.PumpSwitch ≠ 'Off'
  DomPost c.PumpSwitch = 'Off'
  ReqPre for PumpSwitchOnWhenHighWaterDetected:
    c.HighWaterFlag ≠ 'On'
```
Semantics of required conditions (as prose, Section 2.1.4):
- **required precondition**: permission to perform the operation when true;
- **required trigger condition**: obligation to perform the operation when the condition becomes true provided the domain precondition is true;
- **required postcondition**: additional condition that must hold after any application.

Consistency meta-rule: `ReqTrig ∧ DomPre ⇒ ReqPre` — violations trace back to goal-level conflicts (resolved at the goal level, not the operation level).

### 2.4 Formal semantics of operationalization (Section 3)

Two possible semantics for an operation language:
- **Generative**: every behavioral change forbidden except explicitly required ones.
- **Pruning**: every behavioral change allowed except explicitly forbidden ones.

FSE'02 adopts **pruning semantics** with two built-in frame axioms (avoiding the frame problem while keeping incremental/partial-model reasoning possible):

> **Frame axiom 1.** Any attribute/relationship variable not declared in the output clause of an operation's specification is left unchanged by any application of that operation.

> **Frame axiom 2.** Every state transition that satisfies the domain pre- and postconditions of an operation corresponds to an application of this operation. Meta-rule form: for any operation `op`: `DomPre(op) ∧ ○DomPost(op) ⇒ Performed(op)`.

**Definition 1 (Semantics of operations).** For every operation `op` with args `arg1..argn`, results `res1..resn`:
```
[|op|](arg1,...,argn,res1,...,resn) ⇔ DomPre(op) ∧ ○DomPost(op)
```
Example: `[|SwitchPumpOn|](c) ⇔ c.PumpSwitch ≠ 'On' ∧ ○c.PumpSwitch = 'On'`.

**Definition 2 (Semantics of required pre-, trigger-, postconditions).** For required condition `R` on operation `op`:
```
R ∈ ReqPre(op)  ⇒  [|R|] =def (∀*) [|op|] ⇒ R
R ∈ ReqTrig(op) ⇒  [|R|] =def (∀*) R ∧ DomPre(op) ⇒ [|op|]
R ∈ ReqPost(op) ⇒  [|R|] =def (∀*) [|op|] ⇒ ○R
```
(`(∀*)` = universal closure.)

**Definition 3 (Correctness of goal operationalization).** `{R1,...,Rn}` correctly operationalizes goal `G` iff:
1. `[|R1|],...,[|Rn|] ⊨ G`            (completeness)
2. `[|R1|],...,[|Rn|] ⊭ false`        (consistency)
3. `G ⊨ [|R1|],...,[|Rn|]`            (minimality)

Minimality differs from goal-refinement minimality: the operationalizing requirements must not be stronger than required by the goal, because the responsible agent must not be more restrictive than the goal requires [Let02a/ICSE'02 realizability].

Worked completeness proof obligation for `Maintain[PumpSwitchOnWhenHighWaterDetected]`:
```
  c.HighWaterFlag = 'On' ∧ c.PumpSwitch ≠ 'On' ⇒ [|SwitchPumpOn|](c)      {ReqTrig of SwitchPumpOn}
∧ [|SwitchPumpOff|](c) ⇒ ¬c.HighWaterFlag = 'On'                          {ReqPre of SwitchPumpOff}
⊨ c.HighWaterFlag = 'On' ⇒ ○c.PumpSwitch = 'On'                           {Goal PumpSwitchOnWhenHighWaterDetected}
```

### 2.5 Operationalization patterns (Section 4)

**Figure 1 — Immediate Achieve pattern.** Root: `C ⇒ ○T`.
```
Operation Op1                 Operation Op2
 DomPre  ¬T                     DomPre  T
 DomPost T                      DomPost ¬T
 ReqTrig for RootGoal: C        ReqPre for RootGoal: ¬C
```
Correctness (completeness) proof obligation: `(C ∧ ¬T) ⇒ ○T  ∧  (T ∧ ○¬T) ⇒ ¬C  ⊨  C ⇒ ○T`.
Example of use: `WheelsPulseOn ⇒ ○ReverseThrustEnabled` instantiates to `EnableReverseThrust` (DomPre `¬ReverseThrustEnabled`, DomPost `ReverseThrustEnabled`, ReqTrig `WheelsPulseOn`) and `DisableReverseThrust` (DomPre `ReverseThrustEnabled`, DomPost `¬ReverseThrustEnabled`, ReqPre `¬WheelsPulseOn`). Also instantiated for the mine pump: `SwitchPumpOn`/`SwitchPumpOff` from `HighWaterFlag='On' ⇒ ○PumpSwitch='On'`.

**Figure 2 — Bounded Achieve pattern.** Root: `C ⇒ ◇≤d T`.
```
Operation Op
 DomPre  ¬T
 DomPost T
 ReqTrig for RootGoal: ¬T S=d-1 (C ∧ ¬T)
```
Applicability: goal of form `C ⇒ ◇≤d T`. Example of use (mine pump methane alarm): `c.MethaneMeasure ≥ 'Critical' ⇒ ◇≤d c.Alarm='On'` ⟹
```
Operation RaiseAlarm
 DomPre c.Alarm ≠ 'On'; DomPost c.Alarm = 'On'
 ReqTrig for AlarmForCriticalMethaneMeasure:
   c.Alarm ≠ 'On' S=d-1 (c.MethaneMeasure ≥ 'Critical' ∧ c.Alarm ≠ 'On')
```

**Figure 3 — "InBetween" Invariance pattern.** Root: `C ⇒ ○(T W (N ∧ T))`.
```
Operation Op1                   Operation Op2
 DomPre  ¬T                       DomPre  T
 DomPost T                        DomPost ¬T
 ReqTrig for RootGoal: C          ReqPre for RootGoal: ¬C B (N ∧ ¬C)
```
Applicability: `C ⇒ T W N` (T to be maintained under C unless N becomes true while T holds); for synchrony-hypothesis languages (e.g. SCR) this simplifies to `C ⇒ T W N` without the `○`. Example of use — light control: `Maintain[LightOnWhenRoomOccupied]`: `r.FirstEntry ⇒ ○(r.Light='On' W (r.LastExit ∧ r.Light='On'))` ⟹
```
Operation TurnLightOn
 DomPre r.Light≠'On'; DomPost r.Light='On'
 ReqTrig for LightOnWhenRoomOccupied: r.FirstEntry
Operation TurnLightOff
 DomPre r.Light≠'Off'; DomPost r.Light='Off'
 ReqPre for LightOnWhenRoomOccupied: ¬r.FirstEntry B (r.LastExit ∧ r.Light='On')
```

**Figure 4 — Taxonomy of goal patterns** (text form of the tree):
```
Goal Patterns
├─ Achieve
│   ├─ Unbounded Achieve   C ⇒ ◇T
│   ├─ Bounded Achieve     C ⇒ ◇≤d T
│   └─ Immediate Achieve   C ⇒ ○T
└─ Maintain/Avoid
    ├─ State Invariance
    │   ├─ Global Invariance    C ⇒ T
    │   ├─ "After" Invariance   C ⇒ ○T
    │   └─ "InBetween" Invariance  C ⇒ T W N
    └─ Transition Invariance    T ⇒ ●C
```
Coverage note: Dwyer et al. report 92% of 555 literature property specs matched their patterns; FSE'02's taxonomy is adapted from that catalog plus the KAOS Achieve/Maintain patterns.

### 2.6 Autopilot bottom-up mining example (Section 4.1)

Informal spec: "If the pilot dials an altitude >1200ft above current and presses alt_eng, the mode does not directly engage; instead it goes to 'armed' and FPA select mode engages." Partial operation:
```
Operation EngageFPAmode
 Input a: AutoPilot, altEng: ALTengagedEvent; Output a: AutoPilot/FPAmode
 DomPre a.FPAmode ≠ 'on'
 DomPost a.FPAmode = 'on'
 ReqTrig For <unknown goal>:
   Occurs(altEng) ∧ ALTtarget - ALTactual > 1200
```
Matches Immediate Achieve pattern; inferred root goal:
```
Goal Achieve[FPAModeEngagedWhenHighTargetAltitude]
  FormalDef ∀a: AutoPilot, altEng: ALTengagedEvent
    Occurs(altEng) ∧ ALTtarget - ALTactual > 1200 ∧ a.FPAmode ≠ 'on' ⇒ ○a.FPAmode = 'on'
```

---

## 3. ASE Journal (2008) — KAOS2LTSA: Deriving Event-Based Transition Systems from Goal-Oriented Requirements Models

Authors: Emmanuel Letier (UCL), Jeff Kramer & Jeff Magee (Imperial), Sebastian Uchitel (U. Buenos Aires/Imperial). Case studies: mine pump (§2, running example) and safety injection system of a nuclear power plant (§6, full validation case study — not transcribed here beyond its mention, since the mine pump is the oracle target).

### 3.1 LTL/FLTL semantics recap (Section 2.1.1, 2.2.2)

Qualitative operators: `X` next, `[]` always, `<>` eventually, `U` until, `W` Awaits; real-time: `[]~d P`, `<>~d P`, `P U~d Q` with `~ ∈ {<,≤,=,≥}` [printed as `, , , `  in the extracted text — poppler dropped the comparison glyphs; UNREADABLE for the exact symbol set, but context and the FSE'02/ICSE'02 papers confirm `{<,≤,=,≥}` is the intended set]. Semantics given in terms of a history `h: Nat → State`:
```
(h,i)⊨X P   iff (h,i+1)⊨P
(h,i)⊨[]P   iff (h,j)⊨P for all j≥i
(h,i)⊨<>P   iff (h,j)⊨P for some j≥i
(h,i)⊨P U Q iff (h,j)⊨Q for some j≥i and (h,k)⊨P for all i≤k<j
(h,i)⊨P W Q iff (h,i)⊨P U Q or (h,i)⊨[]P
(h,i)⊨[]~d P iff (h,j)⊨P for all j≥i with |j-i|~d
(h,i)⊨<>~d P iff (h,j)⊨P for some j≥i with |j-i|~d
(h,i)⊨P U~d Q iff (h,j)⊨Q for some j≥i with |j-i|~d, and (h,k)⊨P for all i≤k<j
```

**Fluent** `Fl = <InitFl, TermFl> initially InitiallyFl` — a state predicate defined by disjoint initiating/terminating event sets and an initial boolean value (default false). FLTL = LTL over fluents; concrete syntax uses `!`, `&&`, `||`. Every event `e` has an implicit fluent `e = <e, A-{e}> initially false`.

### 3.2 Synchronous vs. asynchronous temporal logic (Section 2.2.3) — the key gotcha

KAOS goals are **synchronous** (interpreted over fixed-rate time ticks; zero/one/more events may occur between ticks); FLTL/LTSA traces are **asynchronous** (interpreted after each event). `X P` means "next tick" in KAOS but "after the next event" in FLTL — conflating them is flagged as a frequent and serious specification error. Example: `[](HighWater -> X PumpOn)` in synchronous KAOS means "pump on by next time unit"; the *same string* interpreted asynchronously in FLTL imposes no time bound at all. Immediate-response properties (`[](HighWater -> PumpOn)`) are likewise subtly wrong when read asynchronously because the triggering and responding events cannot occur concurrently in an interleaving/asynchronous trace.

**Synchronous→asynchronous encoding** `Tr: FLTL_Sync → FLTL_Async` (recursive):
```
Tr([] P)   = [] (tick -> Tr(P))
Tr(<> P)   = <> (tick && Tr(P))
Tr(P U Q)  = (tick -> Tr(P)) U (tick && Tr(Q))
Tr(X P)    = X ( !tick W (tick && Tr(P)) )
```
(Boolean operators pass through unchanged.) Example: `[](HighWater -> X PumpOn)` encodes to
```
[](tick -> (HighWater -> X(!tick W (tick && PumpOn))))
```

### 3.3 FLTL assertion → LTS (Section 3) and the `constraint` keyword

For a safety FLTL assertion φ, LTSA's extended `constraint` keyword generates an LTS that is a "property LTS with ERROR states removed" — i.e. accepts exactly the traces (on φ's alphabet) satisfying φ. Non-safety assertions cannot be compiled this way (error reported).

**Proposition.** For safety properties `P, Q` closed under stuttering: for all traces `tr`, `tr ⊨ P ∧ Q` iff `tr` accepted by `(constraint P || constraint Q)`. (Full proof given via alphabet projection — reproduced in the PDF, omitted here as routine.)

### 3.4 Five-step KAOS→LTS derivation procedure (Section 4) — the FSP/LTS mapping rules

**Step 1 — Bounding + fluent identification.** Give every infinite-range KAOS variable a finite discrete range (e.g. `WaterLevel` restricted to `[0..14]`); bound object-model cardinalities (`range User = 0..MaxUser`). Boolean state variables map to plain fluents (`PumpOn` state var → `fluent PumpOn`). Finite-range integer/enum variables map to parameterized fluents: `fluent WaterLevel[i: 0..14]`; KAOS expressions `Var = x` rewrite to `Val[x]`; `Var ~ x` (`~ ∈ {<,≤,>,≥}`) rewrites to `exists[i:R] Val[i] && (i ~ n)`, which LTSA expands to a disjunction, e.g. `WaterLevel≤2` → `WaterLevel[0] || WaterLevel[1] || WaterLevel[2]`.

**Step 2 — Fluent definitions from domain postconditions.** Each KAOS operation maps to an LTS event of the same name/parameters.
> **Rule for deriving fluent definitions:** an operation is an initiating (resp. terminating) event of a fluent iff there is a positive (resp. negative) occurrence of the fluent in the operation's domain postcondition.

Assumptions: domain postconditions must be conjunctions of positive/negative fluent occurrences (no disjunction); a fluent must not appear both positively and negatively in one operation's postcondition (else replace that postcondition by `false`). Environment-caused fluent changes (e.g. water level) need explicit environment operations, e.g.:
```
Operation aboveHigh
  DomPre  ¬HighWater ∧ ¬LowWater
  DomPost HighWater
```
(`belowHigh`, `aboveLow`, `belowLow` analogous.)

**Step 3 — Domain precondition template:**
```
constraint DomPre_<Operation> = [] ( (tick && !<DomPre>) -> X( !<Operation> W tick ) )
```
Safety property, closed under stuttering despite the `X`. An auxiliary FSP process constrains each fluent to change at most once between ticks (encodes that KAOS traces separate ticks by an unordered event set, each event occurring at most once per inter-tick interval).

**Step 4 — Required pre/trigger/post templates:**
```
constraint ReqPre_<Operation>_For_<Goal>  = [] ((tick && !<ReqPre>) -> X(!<Operation> W tick))
constraint ReqTrig_<Operation>_For_<Goal> = [] ((tick && <ReqTrig> && <DomPre>) -> X(!tick W <Operation>))
constraint ReqPost_<Operation>_For_<Goal> = [] (<Operation> -> (!tick W (tick && <ReqPost>)))
```
All three are safety, closed under stuttering, hence freely composable via `||` per the Section 3 proposition.

**Step 5 — Model composition.** Compose all LTSs from domain + required conditions for the agent's operations. For the mine pump controller: 2 LTSs from domain preconditions (`startPump`, `stopPump`) `||` 6 LTSs from the 6 required pre/trigger conditions (2 goals × ReqTrig+ReqPre, one more for the third goal) → composed, minimized model with **65 states**, computed in <1s on a 3GHz/512MB machine.

### 3.5 Mine pump worked model (Section 2, 4 — goals/requirements/operations/LTS, verbatim)

**Goal** (Section 2.1.1):
```
Goal Avoid[SumpOverflow]
  Def. The sump should not overflow
  FormalDef []( WaterLevel ≥ 'Overflow' )
```
AND-refinement (Figure 1, text form):
```
Avoid[SumpOverflow]
 ├─ Maintain[PumpOnWhenHighWater]          (responsibility: PumpController)
 ├─ Maintain[WaterExtractedWhenPumpOn]      (responsibility: Pump)
 └─ Maintain[LimitedWaterInFlow]            (domain property, trapezoid)
```
Other requirements mentioned: `Maintain[PumpOffWhenLowWater]` (subgoal of `Avoid[PumpDamaged]`), `Maintain[PumpOffWhenMethane]` (subgoal of `Avoid[Explosion]`). **Conflict**: `Maintain[PumpOnWhenHighWater]` vs. `Maintain[PumpOffWhenMethane]`, resolved by weakening the first to `Maintain[PumpOnWhenHighWaterAndNoMethane]` and propagating the weakening up to `Avoid[SumpOverflow]`.

**Requirements for PumpController** (Figure 2, verbatim):
```
Requirement Maintain[PumpOnWhenHighWaterAndNoMethane]
  Responsibility Pump Controller
  Def. If the water level is above high and there is no methane, then at the next time unit the pump must be on.
  FormalDef [] (HighWater ∧ ¬Methane -> X PumpOn)

Requirement Maintain[PumpOffWhenMethane]
  Responsibility Pump Controller
  Def. If there is methane in the mine, the pump must be off within the next time unit.
  FormalDef [] (Methane -> X ¬PumpOn)

Requirement Maintain[PumpOffWhenLowWater]
  Responsibility Pump Controller
  Def. If the water is below the low level, the pump must be off within the next time unit.
  FormalDef [] (LowWater -> X ¬PumpOn)
```

**Operation model for PumpController derived from these requirements** (Figure 3, verbatim):
```
Operation startPump                              Operation stopPump
  PerfBy PumpController                            PerfBy PumpController
  DomPre  ¬PumpOn                                  DomPre  PumpOn
  DomPost PumpOn                                   DomPost ¬PumpOn
  ReqTrig For {PumpOnWhenHighWaterAndNotMethane}   ReqTrig For {PumpOffWhenMethane}
    HighWater ∧ ¬Methane                             Methane
  ReqPre For {PumpOffWhenMethane}                  ReqTrig For {PumpOffWhenLowWater}
    ¬Methane                                          LowWater
  ReqPre For {PumpOffWhenLowWater}                 ReqPre For {PumpOnWhenHighWaterAndNotMethane}
    ¬LowWater                                         ¬(HighWater ∧ ¬Methane)
```
Note the paper's own prose: "goal does not match... the ReqTrig captures the requirement that this operation must be applied when the water level is high and there is no methane" — the published Figure 3 has a naming inconsistency between "PumpOnWhenHighWaterAndNotMethane" (goal name as used on operations) vs. "PumpOnWhenHighWaterAndNoMethane" (goal name as defined in Figure 2) — transcribed exactly as printed in both places; this is a **paper-internal naming inconsistency**, not a transcription error, and is exactly the kind of discrepancy issue #194/#209 ff. should treat as a known defect in the oracle rather than something to "fix" when matching engine output. The accompanying `.cache/kaos/zipextract/.../Mine Pump KAOS model.txt` from the models zip uses yet a third informal dialect (`REQTRIG FOR PumpOnWhenHighWaterANDNoMethane`), confirming the name was never fully stabilized across the author's own artifacts. See `docs/reference-defects.md` for how this project records such oracle defects.

**FSP/LTS derivation walk-through for the mine pump (Section 4, Figures 4–6, verbatim prose + assertions):**

Fluent definitions (Step 2):
```
fluent PumpOn = <startPump, stopPump>
fluent HighWater = <aboveHigh, belowHigh>
```
(`LowWater`, `Methane` fluents analogous, from `belowLow`/`aboveLow` and `methaneAppears`/`methaneLeaves` — confirmed in the models-zip `.lts` file, §3.6 below.)

Domain precondition constraints (Step 3) for `startPump`/`stopPump`, composed into a timed LTS (Figure 4, described in prose: "a system in which the events startPump and stopPump alternate and no more than one startPump or stopPump event can occur during a single time unit").

Required precondition example (Step 4) — ReqPre on `startPump` for goal `PumpOffWhenMethane`, i.e. `¬Methane`:
```
constraint ReqPRE_On_startPump_For_PumpOffWhenMethane = [] ((tick && !!Methane) -> X(!startPump W tick))
```
(Figure 6 shows the derived 4-state LTS; prose: "this LTS prevents `startPump` to occur in states 2 and 3, because in these states `Methane` was true at the last occurrence of a tick.")

**Final composed LTS (Step 5):** "composing the 2 LTSs derived from its operations' domain preconditions with the 6 LTSs derived from its required pre and trigger conditions... The resulting LTS model has **65 states**."

### 3.6 FSP structure of the mine pump model, as shipped in `KAOS2LTSA-ASEJ-Models.zip`

The zip (585,201 bytes, store-compressed, fetched from the UCL staff page — licence not stated, so only identifiers/structure are listed here, no file content copied beyond the identifiers below) contains, under `KAOS2LTSA - ASEJ 2008/Case Studies/`:

- `Mine Pump LTS from goal operationalization.lts` (2004-06-01, 12533 bytes)
- `Mine Pump Constraints - Corrected.lts` (2005-03-07, 19508 bytes)
- `Mine Pump LTS from goal operationalization - ASEJ vesrion.lts` (2007-07-02, 5836 bytes — the file used for this section)
- `Abstract Mine Pump/Mine Pump LTS from goal operationalization (July 2005).lts` (11378 bytes)
- `Mine Pump/` subfolder: `Mine Pump KAOS model.txt` (informal GOAL/OPERATION dialect, see §3.5 note above), `Mine Pump for Animation (July 2005).lts`, `minepump - Magee.lts`, `minepump - Magee WITH FLUENTS.lts` (Magee's original hand-written FSP model, predating the goal-derived one — used as the Figure 7 animation scene, reused unmodified per the paper's §5.3), `pump.xml`/`pump_new.xml`/`rotor.xml`/`explosion.xml` (graphical-animation scene descriptors) and an `image/` folder of explosion-animation GIF frames (`explosion1.gif`..`explosion16.gif`) plus a `Thumbs.db`.
- `Safety Injection/` subfolder (the §6 case study — not the mine pump; listed for completeness: `Clock.lts`, `Clock.xml`, `Reactor.lts`, `Reactor-with tick.lts`, `Reactor.xml`, `safety injection5- August 2005.lts`, `SafetyInjection.cmd`, `SafetyInjection5.cmd`, `safety-injection.pdf`, `SafetyInjectionBackground.ppt`, `KAOS model.doc`, `README.txt`, `explosion.xml`, `explosion.cmd`, an `Images/` folder of GIFs/JPGs).
- `KAOS2LTSA-ASEJ.pdf` (the paper itself, 256,324 bytes, 28 pages — the source for all of Section 3 above).

**FSP processes, actions and state counts** in `Mine Pump LTS from goal operationalization - ASEJ vesrion.lts` (the canonical goal-derived model, matching the paper's Section 4 exactly):

Fluents: `PumpOn = <startPump, stopPump>`, `HighWater = <aboveHigh, belowHigh>`, `LowWater = <belowLow, aboveLow> initially 1`, `Methane = <methaneAppears, methaneLeaves>`.

Actions (9 total): `tick`, `startPump`, `stopPump`, `aboveHigh`, `belowHigh`, `aboveLow`, `belowLow`, `methaneAppears`, `methaneLeaves`.

Composed FSP processes (all defined via `constraint`/`set`/`||`):
- `PumpOn_DomainModel = DomPre_startPump || DomPre_stopPump || InterleavingCstr_for_PumpOn`
- `EnvironementModel = InterleavingCstr_for_Water || InterleavingCstr_for_Methane || DomPre_aboveHigh || DomPre_belowHigh || DomPre_belowLow || DomPre_aboveLow || DomPre_methaneAppears || DomPre_methaneLeaves` — **32 states** (file comment).
- `Operationalized_GOALS_simple = PumpOn_DomainModel || ReqTRIG_On_startPump_For_PumpOnWhenHighWaterANDNoMethane || ReqPRE_On_stopPump_For_PumpOnWhenHighWaterANDNoMethane || ReqTRIG_On_stopPump_For_PumpOffWhenLowWater || ReqPRE_On_startPump_For_PumpOffWhenLowWater || ReqTRIG_On_stopPump_For_PumpOffWhenMethane || ReqPRE_On_startPump_For_PumpOffWhenMethane`
- `SimpleGOALS_Operationalized_DOM = Operationalized_GOALS_simple || EnvironementModel` — this is the model the paper reports as **65 states** after minimization.
- Three `assert` properties (`PumpOnWhenHighWaterANDNoMethane_Satisfation`, `PumpOffWhenLowWater_Satisfation`, `PumpOffWhenMethane_Satisfation`) combined into `assert ALL_GOALS_SATISFIED`, plus a `progress NON_ZENO = {tick}` liveness check and a `constraint PumpOnWhenHighWater_Fig3` (the unweakened, pre-conflict-resolution goal, kept for comparison — composed alone as process `Fig3`).
- A separate, hand-simplified 3-process model at the bottom of the file (marked "trying to reduce the state space"): `WaterProcess` (3 states: `Medium`, `Low`, `High`), `MethaneProcess` (2 states: `NoMethane`, `Methane`), `PumpSwitch` (2 states: `Off`, `On`), composed as `DOM2 = WaterProcess || MethaneProcess || PumpSwitch`.

`Mine Pump Constraints - Corrected.lts` (468 lines, 2005 revision) and `Mine Pump LTS from goal operationalization.lts` (2004 revision) are earlier/variant versions of the same model; not transcribed line-by-line here since the ASEJ version above is both the final published one and the smaller, directly citable artifact. Flagged as UNREADABLE-in-depth: a byte-for-byte diff of the three `.lts` revisions was not performed — if a future oracle check needs to know exactly what changed between the 2004, 2005-corrected, and 2007-ASEJ versions, re-open the zip and diff them.

---

## Coverage summary / what is missing

- ICSE'02: full coverage of Sections 1–7 (agent model, realizability definition and theorem, full tactics catalog with all 5 tactics figures, 2 worked tactics in full, LAS case study graph). References list transcribed by title only where relevant to cross-checking (not reproduced verbatim here).
- FSE'02: full coverage of Sections 1–5 (goal/object/agent/operation models, mine pump spec, frame axioms, Definitions 1–3, all 3 named operationalization patterns with figures, goal-pattern taxonomy, autopilot mining example, benefits/discussion). Section 6 references list not reproduced.
- ASE'08 (KAOS2LTSA): full coverage of Sections 1–5 (background, FLTL/LTS semantics, synchronous→asynchronous encoding, the 5-step derivation procedure with all templates, LTSA analysis capabilities — goal-operationalization checking, consistency/implicit-requirement checking via deadlocks, goal-based animation). Section 6 (Safety Injection case study), Section 7 (scalability/limitations discussion) and Section 8 (related work) were fetched but **not transcribed** here since they concern a different case study than the mine pump oracle this file exists for; re-open `.cache/kaos/KAOS2LTSA-ASEJ.txt` (lines 906–1370) if that material is ever needed.
- Models zip: file list and mine pump FSP structure (processes/actions/state counts) given in §3.6; no `.lts`/`.xml` file content copied beyond identifiers, per the task's licence caution.
- Nothing was UNREADABLE outright (no blank/garbled pages); the two genuine uncertainties are flagged inline: (a) the "always" box operator `□` rendering as bare `o`/`q`/`n` glyphs in `pdftotext` output across all three papers, and (b) the exact comparison-operator glyph set `{<,≤,=,≥}` on ASEJ p.3 which `pdftotext` dropped entirely.

**Surprising finding:** the goal name for the "pump on when high water and no methane" requirement is spelled three different ways across the author's own artifacts for the *same* model — `PumpOnWhenHighWaterAndNoMethane` (ASE journal prose and Figure 2), `PumpOnWhenHighWaterAndNotMethane` (ASE journal Figure 3, operation model), and `PumpOnWhenHighWaterANDNoMethane` (the informal `.txt` dialect in the models zip, and the canonical `.lts` file). This is a genuine, never-corrected inconsistency in the oracle itself (see `docs/reference-defects.md`), not something for the KAOS stress test to silently "fix" when comparing names.
