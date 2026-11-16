# Requirements document: las

Generated from its KAOS goal model.

## Goals

| Goal | Kind | Type | Category | Priority | Fit criterion |
| --- | --- | --- | --- | --- | --- |
| Achieve [Ambulance On Scene When Incident Reported] | Behavioral goal |  |  |  |  |
| Achieve [Ambulance Allocated When Incident Reported] | Behavioral goal |  |  |  |  |
| Achieve [Ambulance On Scene When Ambulance Allocated] | Behavioral goal |  |  |  |  |
| Achieve [Ambulance Mobilized When Ambulance Allocated] | Behavioral goal |  |  |  |  |
| Achieve [Ambulance Mobilized When Ambulance Allocated On Road] | Behavioral goal |  |  |  |  |
| Achieve [Ambulance Mobilized When Ambulance Allocated At Station] | Behavioral goal |  |  |  |  |
| Achieve [Ambulance Mobilized By Fax When Ambulance Allocated At Station] | Behavioral goal |  |  |  |  |
| Achieve [Ambulance Mobilized By Phone When Ambulance Allocated At Station] | Behavioral goal |  |  |  |  |
| Achieve [Ambulance On Scene When Ambulance Mobilized] | Behavioral goal |  |  |  |  |
| Avoid [Ambulance Not In Familiar Area] | Behavioral goal |  |  |  |  |

## Goal details

| Goal | Source | Stability | Formal specification | Issue |
| --- | --- | --- | --- | --- |
| Achieve [Ambulance On Scene When Incident Reported] |  |  | when incidentReported() then sooner-or-later ambulanceOnScene() |  |
| Achieve [Ambulance Allocated When Incident Reported] |  |  | when incidentReported() then sooner-or-later ambulanceAllocated() |  |
| Achieve [Ambulance On Scene When Ambulance Allocated] |  |  | when ambulanceAllocated() then sooner-or-later ambulanceOnScene() |  |
| Achieve [Ambulance Mobilized When Ambulance Allocated] |  |  | when ambulanceAllocated() then sooner-or-later ambulanceMobilized() |  |
| Achieve [Ambulance Mobilized When Ambulance Allocated On Road] |  |  | when ambulanceAllocated() and onRoad() then sooner-or-later ambulanceMobilized() |  |
| Achieve [Ambulance Mobilized When Ambulance Allocated At Station] |  |  | when ambulanceAllocated() and not onRoad() then sooner-or-later ambulanceMobilized() |  |
| Achieve [Ambulance Mobilized By Fax When Ambulance Allocated At Station] |  |  | when ambulanceAllocated() and not onRoad() then sooner-or-later ambulanceMobilizedByFax() |  |
| Achieve [Ambulance Mobilized By Phone When Ambulance Allocated At Station] |  |  | when ambulanceAllocated() and not onRoad() then sooner-or-later ambulanceMobilizedByPhone() |  |
| Achieve [Ambulance On Scene When Ambulance Mobilized] |  |  | when ambulanceMobilized() then sooner-or-later ambulanceOnScene() |  |
| Avoid [Ambulance Not In Familiar Area] |  |  | when ambulanceMobilized() then ambulanceInFamiliarArea() |  |

## Refinements

| Goal | Refined into | Alternative | Tactic | Status | System |
| --- | --- | --- | --- | --- | --- |
| Achieve [Ambulance On Scene When Incident Reported] | Achieve [Ambulance Allocated When Incident Reported], Achieve [Ambulance On Scene When Ambulance Allocated] |  | milestone-driven |  |  |
| Achieve [Ambulance On Scene When Ambulance Allocated] | Achieve [Ambulance Mobilized When Ambulance Allocated], Achieve [Ambulance On Scene When Ambulance Mobilized] |  | milestone-driven |  |  |
| Achieve [Ambulance Mobilized When Ambulance Allocated] | Achieve [Ambulance Mobilized When Ambulance Allocated On Road], Achieve [Ambulance Mobilized When Ambulance Allocated At Station] |  | case-driven |  |  |
| Achieve [Ambulance Mobilized When Ambulance Allocated At Station] | Achieve [Ambulance Mobilized By Fax When Ambulance Allocated At Station], Achieve [Ambulance Mobilized By Phone When Ambulance Allocated At Station], Ambulance Mobilized By Fax or Phone |  |  |  |  |

## Domain properties

| Domain property | Description | In the refinement of |
| --- | --- | --- |
| Ambulance Mobilized By Fax or Phone | An ambulance mobilized by fax or by phone is considered as mobilized. | Achieve [Ambulance Mobilized When Ambulance Allocated At Station] |
| Ambulance On Scene Not In Traffic Jam | Ambulance cannot reach incident scene if stuck in traffic jams. |  |
| Ambulance Lost Iff GPS Not Working And Not In Familiar Area | Ambulance cannot reach incident scene if in unfamiliar area and if the GPS is not working. |  |
| Ambulance On Scene Not Lost | Ambulance cannot reach incident scene if lost. |  |
| Ambulance On Scene Broken Down | Ambulance cannot reach incident scene if broken down. |  |

## Requirements and expectations

| Goal | Assigned to | As |
| --- | --- | --- |
| Achieve [Ambulance Allocated When Incident Reported] | ADS | requirement |
| Achieve [Ambulance Mobilized When Ambulance Allocated On Road] | Despatcher | requirement |
| Achieve [Ambulance Mobilized By Fax When Ambulance Allocated At Station] | ADS | requirement |
| Achieve [Ambulance Mobilized By Phone When Ambulance Allocated At Station] | Despatcher | requirement |
| Achieve [Ambulance On Scene When Ambulance Mobilized] | Ambulance Staff | requirement |
| Avoid [Ambulance Not In Familiar Area] |  | unassigned |

## Agents

| Agent | Kind | Responsible for |
| --- | --- | --- |
| Despatcher | Agent | Achieve [Ambulance Mobilized When Ambulance Allocated On Road], Achieve [Ambulance Mobilized By Phone When Ambulance Allocated At Station] |
| Ambulance Staff | Agent | Achieve [Ambulance On Scene When Ambulance Mobilized] |
| ADS | Agent | Achieve [Ambulance Allocated When Incident Reported], Achieve [Ambulance Mobilized By Fax When Ambulance Allocated At Station] |

## Conflicts

None.

## Obstacles

| Obstacle | Category | Obstructs | Resolved by | Resolution |
| --- | --- | --- | --- | --- |
| Mobilized Ambulance Not On Scene in Time |  | Achieve [Ambulance On Scene When Ambulance Mobilized] |  |  |
| Ambulance Stuck In Traffic Jam |  |  |  |  |
| Ambulance Lost |  |  |  |  |
| Ambulance Not In Familiar Area |  |  | Avoid [Ambulance Not In Familiar Area] |  |
| GPS Not Working |  |  |  |  |
| Ambulance Broken Down |  |  |  |  |
