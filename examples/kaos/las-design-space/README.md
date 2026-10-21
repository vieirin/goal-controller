# London Ambulance design space (RE'11)

The London Ambulance design space of Heaven and Letier, *Simulating and
optimising design decisions in quantitative goal models* (RE'11, DOI
10.1109/RE.2011.6051653), for kaossim (goal-controller#193, #207): five
decision points and 648 designs.

## Where each part comes from

RE'11's text only, re-keyed:

- **The structure:** Fig. 1's goals and its four decision points, and
  §IV.D's fifth: "the possibility to increase the number of ambulances from
  a current value of 100 to a maximum of 200 … by 20 units". That is
  4 × 3 × 3 × 3 × 6 = 648 designs.
- **The quality variables:** Fig. 2's.
- **The objectives:** §II.B's 14MinResponseRate and 8MinResponseRate (Max,
  targets 95 % and 50 %).
- **The equations:** §II.B's `ResponseTime = MobilisationTime +
  MobilisationDistance + AmbulanceDelay` and its `IncidentDropped` equation.
  That equation's ∨ glyphs are lost in the PDF's text, so it is read as
  FSE'04 writes it.
- **The estimates RE'11 prints:**
  - CallTakingTime per option, Exp(60), Exp(40), Exp(45), Exp(30) (§II.B);
  - the current system's AmbulanceDelay Normal(0, 120), AllocationTime
    Exp(60) and MobilisationCommunicationTime Exp(60) (§III.B);
  - the fifth decision point's 100 to 200 ambulances.

  `Exp(m)` is RE'11's mean m ("mean varies from 60 seconds to 30 seconds").
- **The designs** (`designs.json`, `declare design` in the `.kaos`):
  - the current system (§III.B);
  - the current system with automated allocation (§III.B's 73 %);
  - §IV.D's two printed designs, [1.1, 2.2, 3.1, 4.1, 5.1] (98 %, 500k) and
    [1.1, 2.3, 3.2, 4.3, 5.3] (over 99 %, 3418k).

### Choices this seed makes

- RE'11 shows "the options without showing the alternative goal refinements
  or responsibility assignments that define them" (§II.A). Here each option
  is an OR responsibility assignment, its agent named as Fig. 1 names the
  option, its SysRef the option's number.
- The fifth decision point "impacts on the quality variable
  DistanceAllocatedAmbulance". It is a goal, Ambulances deployed, under
  Ambulance Allocated Based on Incident Form.
- Fig. 2's variables are placed on the goals as its layout reads; its text
  extraction is garbled.
- The 73 % design is "the second option for Achieve [Ambulance Allocated
  Based On Incident Form], which allocates responsibility for the goal to a
  software agent … mean Allocation Decision Time of only 5 seconds". Fig. 1
  hangs the allocation options (4.x) on Ambulance Allocated Based on
  Incident Form and Ambulance Info, and a software agent is option 4.3,
  Fully Automated Allocation. RADAR's LAS.rdr gives exponential(5) to the
  same option. The design picks 4.3.

## What RE'11 doesn't print

- **DistanceAllocatedAmbulance's model.** It "depends on the quality
  variables denoting the number of ambulances, the frequency of incidents,
  the city size, the error in ambulance location and availability
  information, and error in the allocation decision process attached to
  lower-level goals and domain properties not shown in Figure 1" (§III.B).
- **MobilisationTime's and MobilisationDistance's equations.** Fig. 2 draws
  the variables, not the equations.
- **The other options' estimates and every option's cost.** §IV.D quotes two
  designs' totals, 500k and 3418k.

So kaossim reports both objectives **unresolved** in every design (they lack
MobilisationTime and MobilisationDistance). `las-design-space.expected.csv`
checks the 648 designs, the targets and those lists. It lists RE'11's 61 /
97 % (as-is), 73 % (automated allocation), 98 % and over 99 % as **not
reproducible: inputs not printed** (the owner's decision, #189).

The search is checked on this structure with synthetic values: in lib's
tests, the exhaustive search over the 648 designs and seeded NSGA-II reach
the same Pareto set. RADAR's complete model of the same design space is
`examples/kaos/las-radar`, with RADAR as its oracle.

## Files

- `las-design-space.kaos`: the project's native file. It opens in
  kaossim's mode.
- `las-design-space.txt`: the model, the `.kaos` read.
- `designs.json`: the designs above, also read from the `.kaos`.
- `las-design-space.expected.csv`: the oracle.
