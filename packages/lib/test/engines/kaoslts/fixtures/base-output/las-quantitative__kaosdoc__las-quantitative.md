# Requirements document: las-quantitative

Generated from its KAOS goal model.

## Goals

| Goal | Kind | Type | Category | Priority | Fit criterion |
| --- | --- | --- | --- | --- | --- |
| Achieve [AmbulanceIntervention] | Behavioral goal |  |  |  |  |
| Achieve [AmbulanceMobilized] | Behavioral goal |  |  |  |  |
| IncidentFormEncoded | Behavioral goal |  |  |  |  |
| AmbulanceMobilizedBasedOnIncForm | Behavioral goal |  |  |  |  |
| AmbulanceAllocatedBasedOnIncForm | Behavioral goal |  |  |  |  |
| AllocatedAmbulanceMobilized | Behavioral goal |  |  |  |  |
| AmbulanceMobilizationCommunicatedOnRadio | Behavioral goal |  |  |  |  |
| AmbulanceMobilizedFromRadioMobilization | Behavioral goal |  |  |  |  |
| AmbulanceMobilizationCommunicatedOnMDT | Behavioral goal |  |  |  |  |
| AmbulanceMobilizedFromMDTMobilization | Behavioral goal |  |  |  |  |
| Achieve [MobilizedAmbulanceIntervention] | Behavioral goal |  |  |  |  |
| Achieve [AmbIntervFailureRecovered] | Behavioral goal |  |  |  |  |
| AccurateAmbulanceInfo | Behavioral goal |  |  |  |  |

## Goal details

| Goal | Source | Stability | Formal specification | Issue |
| --- | --- | --- | --- | --- |
| Achieve [AmbulanceIntervention] |  |  | ∀inc: Incident Reported (inc) ⇒ ◊≤14min (∃ amb:Ambulance) Intervention (amb, inc) |  |

## Refinements

| Goal | Refined into | Alternative | Tactic | Status | System |
| --- | --- | --- | --- | --- | --- |
| Achieve [AmbulanceIntervention] | Achieve [AmbulanceMobilized], Achieve [MobilizedAmbulanceIntervention], Achieve [AmbIntervFailureRecovered] |  | milestone-driven |  |  |
| Achieve [AmbulanceMobilized] | IncidentFormEncoded, AmbulanceMobilizedBasedOnIncForm |  | milestone-driven |  |  |
| AmbulanceMobilizedBasedOnIncForm | AmbulanceAllocatedBasedOnIncForm, AllocatedAmbulanceMobilized |  | milestone-driven |  |  |
| AllocatedAmbulanceMobilized | AmbulanceMobilizationCommunicatedOnRadio, AmbulanceMobilizedFromRadioMobilization | 1 of 2 |  |  | radio mobilization |
| AllocatedAmbulanceMobilized | AmbulanceMobilizationCommunicatedOnMDT, AmbulanceMobilizedFromMDTMobilization | 2 of 2 |  |  | MDT mobilization |

## Domain properties

None.

## Requirements and expectations

| Goal | Assigned to | As |
| --- | --- | --- |
| IncidentFormEncoded | Call taker (paper-based), On-screen call-taking software | shared |
| AmbulanceAllocatedBasedOnIncForm | Human allocator, Allocation software | shared |
| AmbulanceMobilizationCommunicatedOnRadio |  | unassigned |
| AmbulanceMobilizedFromRadioMobilization |  | unassigned |
| AmbulanceMobilizationCommunicatedOnMDT |  | unassigned |
| AmbulanceMobilizedFromMDTMobilization |  | unassigned |
| Achieve [MobilizedAmbulanceIntervention] |  | unassigned |
| Achieve [AmbIntervFailureRecovered] |  | unassigned |
| AccurateAmbulanceInfo |  | unassigned |

## Agents

| Agent | Kind | Responsible for |
| --- | --- | --- |
| Call taker (paper-based) | Environment agent | IncidentFormEncoded |
| On-screen call-taking software | Agent | IncidentFormEncoded |
| Human allocator | Environment agent | AmbulanceAllocatedBasedOnIncForm |
| Allocation software | Agent | AmbulanceAllocatedBasedOnIncForm |

## Conflicts

None.

## Obstacles

| Obstacle | Category | Obstructs | Resolved by | Resolution |
| --- | --- | --- | --- | --- |
| MobilizedAmbFailure |  | Achieve [MobilizedAmbulanceIntervention] | Achieve [AmbIntervFailureRecovered] | obstacle mitigation |
