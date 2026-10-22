# London Ambulance, quantitative (FSE'04)

The quantitative London Ambulance goal model of Letier and van Lamsweerde,
*Reasoning about Partial Goal Satisfaction for Requirements and Design
Engineering* (SIGSOFT'04/FSE-12, pp. 53–62, DOI 10.1145/1029894.1029905).
It carries quality variables, objective functions, refinement equations,
leaf estimates, and Table 3's three systems as designs, for kaossim
(goal-controller#193, #206).

## Where each part comes from

FSE'04's text only, re-keyed; every value is the paper's:

- **The structure:**
  - Fig. 1's eleven goals, with its OR refinement of
    AllocatedAmbulanceMobilized (radio or mobile data terminal);
  - Fig. 3's mitigation: the obstacle MobilizedAmbFailure, resolved by
    Achieve [AmbIntervFailureRecovered], the root's third sub-goal;
  - AccurateAmbulanceInfo, the goal §4.1 puts FalseUnavailability on.
- **The quality variables and objective functions** of §3.1–3.2:
  - ResponseTime and IncidentDropped on the root, with 8MinRespRate (Max,
    target 50 %, current 35 %) and 14MinRespRate (Max, 95 %, 80 %);
  - 14MinRespRate's PCTL definition (§3.3), as `ObjectiveSpec`;
  - Achieve [AmbulanceMobilized]'s four variables;
  - AmbDelay and AmbIntervFailure;
  - Fig. 3's AmbFailureRecovDelay and AmbFailureNotRecovered.
- **The refinement equations:** the root's are §4.3's final form,
  `ResponseTime = if(AmbIntervFailure, 2 (MobilizationTime +
  DistMobilizedAmbulance + AmbDelay) + AmbFailureDetectionTime, MobilizationTime +
  DistMobilizedAmbulance + AmbDelay)`, and §4.1's `IncidentDropped =
  NoAmbMobilized ∨ WrongMobDest ∨ (AmbIntervFailure ∧ AmbFailureNotRecovered)`.
  §4.1's first forms and its CDF of DistAllocatedAmbInfo are comments.
- **The estimates §5.1 prints:**
  - CallTakingTime on paper, exponential with mean 60 s;
  - AmbDelay for the paper-based system, normal with mean 10 s and σ 30 s.
- **Table 3's probabilities** P(FalseAvailability) 1 % and
  P(FalseUnavailability) 2 %, the same in all three systems.
- **The designs** (`designs.json`, `declare design` in the `.kaos`):
  - the paper-based system;
  - S1, "call taking and ambulance allocation are automated";
  - S2, "ambulance mobilization is automated as well";
  - S2 with §5.1's sensitivity, "if the probabilities of these three
    variables increase to 5%, 10%, and 10%".

### Choices this seed makes

- S1's automation is two OR responsibility assignments, a human or a
  software agent (§2.1: "assigned to a human allocator agent, to a software
  agent"). S2's is Fig. 1's OR refinement. The agents' names are the roles
  §2.1 and §5.1 describe.
- Fig. 3's refinement of the root, not Fig. 1's: Table 3's parameters
  include the failure detection time, which only §4.3's equation reads.
- Table 3's "Mean MobilizationTime" (80, 80, 50 s) is not §3.2's
  MobilizationTime, which includes call taking and allocation (Table 3's
  other rows). It is a variable of AllocatedAmbulanceMobilized that the
  paper doesn't name, left as a comment.

## What FSE'04 doesn't print

Table 3's values come from "plausible (but fictitious) estimations for
*some* of the important parameters", integrated with Mathematica. What is
missing:

- Table 3 gives means only. Its parameters' distribution families are not
  printed, except CallTakingTime's and AmbDelay's for the paper-based
  system.
- §4.1's `P(DistAllocatedAmbInfo ≤ x) = 1 − (1 − x²/L²)^NbAvAmb · (1 −
  P(FalseUnavailability))` needs the city size L and the number of truly
  available ambulances. Table 3 gives NbAmbulances = 300 only.
- No equation is printed for MobilizationTime, DistMobilizedAmbulance or
  AmbIntervFailure. Nor is there one for how AllocationDistError,
  P(FalseAvailability) and P(MobFailureForAvAmb) enter them.

So kaossim reports both objectives **unresolved** in every design, naming
what each lacks: AmbIntervFailure, MobilizationTime, DistMobilizedAmbulance,
AmbFailureDetectionTime, and AmbDelay outside the paper-based system.
`las-quantitative.expected.csv` checks the targets and those lists. It lists
Table 3 (8-minute rate 30 / 47 / 52 %, 14-minute rate 84 / 93 / 95 %) and
§5.1's sensitivity (45 / 90 %) as **not reproducible: inputs not printed**,
each with the inputs it lacks (the owner's decision, #189). The engine's
numerical oracle is lib's synthetic tests (`test/engines/kaossim`), against
closed forms.

## Files

- `las-quantitative.kaos`: the project's native file, the designs as
  `declare design`. It opens in kaossim's mode.
- `las-quantitative.txt`: the model, `las-quantitative.kaos` read.
- `designs.json`: Table 3's systems, also read from the `.kaos`.
- `las-quantitative.expected.csv`: the oracle (`scripts/kaos-stress`).
