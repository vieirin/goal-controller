# Requirements document: cairis-acme-water-night

Generated from its KAOS goal model.

## Goals

| Goal | Kind | Type | Category | Priority | Fit criterion |
| --- | --- | --- | --- | --- | --- |
| DetectWar-dialing attack | Behavioral goal |  |  |  | None |
| DetectUnknown applications | Behavioral goal |  |  |  | None |
| DetectWar-dialing | Behavioral goal |  |  |  | None |
| Anomalous credentials reset | Behavioral goal | Maintain |  |  | Login attempt logs available to service desk, together with a procedure for contacting the Information Security Manager in the event of anomalies. |
| Pay number sharing | Behavioral goal |  |  |  | None |
| Third party requests | Behavioral goal |  |  |  | None |
| Application program backup | Behavioral goal |  |  |  | Create new PC image. Download app |

## Goal details

| Goal | Source | Stability | Formal specification | Issue |
| --- | --- | --- | --- | --- |
| DetectWar-dialing attack | Anon |  |  | None |
| DetectUnknown applications | Anon |  |  | None |
| DetectWar-dialing | Anon |  |  | None |
| Anomalous credentials reset | Anon |  |  |  |
| Pay number sharing | Anon |  |  |  |
| Third party requests | Standard 7.6(rr) |  |  |  |
| Application program backup | Standard 7.14(kkkk) |  |  |  |

## Refinements

| Goal | Refined into | Alternative | Tactic | Status | System |
| --- | --- | --- | --- | --- | --- |
| DetectWar-dialing attack | DetectUnknown applications | 1 of 2 |  |  |  |
| DetectWar-dialing attack | DetectWar-dialing | 2 of 2 |  |  |  |
| DetectWar-dialing | Anomalous credentials reset |  |  |  |  |

## Domain properties

| Domain property | Description | In the refinement of |
| --- | --- | --- |
| PC infrastructure | Works diary GT concept |  |

## Requirements and expectations

| Goal | Assigned to | As |
| --- | --- | --- |
| DetectUnknown applications |  | unassigned |
| Anomalous credentials reset | Service Desk | requirement |
| Pay number sharing |  | unassigned |
| Third party requests |  | unassigned |
| Application program backup |  | unassigned |

## Agents

| Agent | Kind | Responsible for |
| --- | --- | --- |
| Vendor | Agent |  |
| Cracker | Agent |  |
| Petty Criminal | Agent |  |
| Integrator | Agent |  |
| Service Desk | Agent | Anomalous credentials reset |
| Machine | Agent |  |

## Conflicts

None.
