# Elevator (Respect-IT's "A KAOS Tutorial"), the operations side

Respect-IT sa, *A KAOS Tutorial*, Version 1.0, 18 October 2007 (© Respect-IT,
no licence stated; re-keyed by hand, never copied). The tutorial's Elevator
case study: §3.3's responsibility model, §3.4's object model and §3.5's
operation model, with the responsibility–operationalisation–performance
triangle (§3.5, Fig. 30), beside §3.6's obstacle analysis, which
goal-controller#202 already re-keyed (Figures 33–35) and
`packages/lib/test/dialect/kaosres.test.ts` reads from this seed, the
declarations' one copy. goal-controller#210 (refs #194, #195, #202, #189).

The tutorial's figures are raster/vector images with no text layer: every
figure's internal content (node labels, `Multiplicity`, `Role`, `DomPre`,
`DomPost`, `Delay`, `Frequency`, `Load`, …) is **not extractable text**
(verified: zero hits for any of those strings over the PDF's full extracted
text; `docs/papers/respectit-kaos-tutorial.md` has the detail). Only the
tutorial's *prose*, which narrates most figures, is re-keyed here; nothing
a figure alone would give is invented.

## Where each part comes from

Prose only, §3.3–3.5 (page and figure numbers as the tutorial has them):

- **The responsibility model (§3.3, p.23–25, Figs. 20–22):** "System
  protected against fire" (Fig. 18), its two requirements ("doors locked
  open when a fire alarm is set", "stop all moving elevators as soon as they
  reach any floor") assigned to the Elevator Controller, and its two
  expectations ("fireproof cage provided", "fireproof equipment provided")
  assigned to the Elevator company — the prose's own example of a
  responsibility diagram. The prose only states the four responsibilities;
  it never says they refine "System protected against fire" by name, so
  the 4-way AND-refinement (read off Fig. 18, unreadable) isn't modelled
  (rv400's review) — see "left out" below.
- **The object model (§3.4, p.26–29, Figs. 23–27):** the three kinds of
  object (entities, agents, associations) and their examples — elevator
  doors, buttons, Cage, Floor, Door (with a `status` attribute: `Open` →
  `Close` on `CloseDoor`, told in words, not a figure, and kept as that
  operation's `DomPre`/`DomPost`), Schedule (identified while describing the
  operation model, §3.5); the Elevator company, Passenger and Elevator
  Controller agents; the At association (a Cage to a Floor, with the state
  transition `At(c,f) → ¬At(c,f)` on `LeaveFloor`, also told in words and
  kept the same way); the Elevator System's composition, with the
  cardinalities the prose gives for Fig. 24 (one or several Cage, at least
  two Floors, one Alarm bell — specialising Alarm device — one Elevator
  Controller "located in a control room", one Power supply). "Elevator
  equipped with floor doors" operationalised by a "Floor door" object is the
  prose's generic illustration of object-operationalisation, which the `kaos`
  dialect has no link kind for (an `OperationalisationLink` is an operation's
  only); not modelled, for the same reason the Button entity's own share of
  "Stop button used" below isn't.
- **The operation model (§3.5, p.30–33, Figs. 28–32):** the "Elevator
  control" process (Fig. 28, read from its prose, not its unreadable
  layout): the Reschedule operation (caused by "Floor call button pushed",
  outputs "Refresh"), Execute schedule (inputs "Schedule", caused by
  "Refresh", "Elevator state change" and "Arrival on floor", outputs "Button
  light on command" and "Stop cage command"); the triangle (Fig. 30): Execute
  schedule is performed by the Elevator Controller, which is responsible for
  "Elevator stopped on calling floor" (Fig. 13), and operationalises it —
  the tutorial's own worked example of the pattern; CloseDoor and LeaveFloor
  (p.26-28), the object model's two worked state transitions, each with its
  `DomPre`/`DomPost` as the prose states it (a `formula` tagged `ltl`,
  #211's parser). "Stop button used"
  operationalised by "Push button" (the Button entity's own share has no
  link kind, as above). "Efficient elevator system" (Fig. 5, refined in
  Fig. 31) by the two requirements of Fig. 16 that justify Reschedule
  ("Moving elevator stopped next floor in case of fire signal", "Elevator
  stopped", which the prose says itself contributes to "Emergency stop
  available inside the cage" — not otherwise modelled here) and the two new
  subgoals Fig. 31 adds ("minimize elevator moves", "minimize average
  waiting time"). Execute schedule is caused by "Refresh" and "Elevator
  state change" only (p.30-31: "Refresh" *starts* it, "Elevator state
  change" *feeds* it); the walkthrough's "[the controller] will then wait
  to receive the event 'Arrival on floor' … before issuing a 'Stop cage
  command'" (p.31) is the already-executing controller waiting mid-process
  for one more event before an output, not a third thing that starts or
  re-starts Execute schedule — a third `causedby` there stretched the
  narrative (rv400's review); "Arrival on floor" stays declared as an
  event, unused as a cause.

## What the figures alone would give, left out

- `DomPre`/`DomPost` on every operation but CloseDoor and LeaveFloor, the
  two the prose states in words (rv400's review: these two were missing
  from the seed and the formulas unset; both now set, as the grammar's
  formula rules, not free text); `ReqPre`/`ReqTrig`/`ReqPost` on the
  operationalisation links; `Multiplicity`/`Role` beyond the Elevator System's composition
  cardinalities (the prose's own numbers); `Frequency` on every event;
  `Delay` on every cause link; `Load` on every agent. None of these has a
  value in the tutorial's text (§189's D1 for the full KAOS stress test);
  they are left unset here, not invented.
- Fig. 31 nests "Passengers informed of elevator direction" under "Efficient
  elevator system"; that goal already refines from "Elevator direction
  updated few seconds before next stop" in the obstacle model above (§3.6),
  and goal-tree's refinement is one parent per goal, so it stays where the
  obstacle model has it rather than gain a second parent the figure alone
  would place.
- Figures 23–27's own sub-components of Cage and Floor: the prose names
  only that they exist ("A cage is equipped as shown on Figure 26"), with no
  further description — left out.
- The 4-way AND-refinement of "System protected against fire" into its two
  requirements and two expectations: read off Figs. 18 and 20 (unreadable).
  The prose (§3.3) states the four responsibilities and their assignments
  but never that they refine the parent goal; the goals and their
  `assignedto` links stay, the refinement doesn't (rv400's review of #400).

## Files

- `elevator.kaos`: the project's native file, the §3.6 obstacle analysis
  (#202) and §3.3–3.5's responsibility, object and operation models (#210)
  in one copy. `packages/lib/test/dialect/kaosres.test.ts` reads it
  directly for #202's kaosres oracle (not a separate fixture, rv400's
  review of #400); its results are unchanged by the operations and object
  kinds the seed adds beside the §3.6 obstacle analysis.
- `elevator.txt`: the model, `elevator.kaos` read.
- `elevator.expected.md`: kaosdoc's requirements document for it, byte for
  byte as committed (`packages/lib/test/engines/kaosdoc/kaosdoc.test.ts`).
  It has the same sections as every other KAOS seed's (kaosdoc's mapper
  ignores the operation and object models' kinds, goal-controller#194): no
  Operations, Entities, Associations or Events section exists to gain one.

- `elevator.expected.csv`: `scripts/kaos-stress`'s structural oracle
  (`structure,id,expected,derivation`, goal-controller#210): a count of
  every element and link kind the model has (the goal and obstacle models'
  counted beside the operation and object models'), and the triangle's
  open closures, zero for a consistent model (the responsibility-
  operationalisation-performance triangle, §3.5 Fig. 30). Nothing here is
  quantitative, so this is the seed's whole oracle: no probabilities, no
  selections, no simulated designs.
