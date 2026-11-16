# Requirements document: las-design-space

Generated from its KAOS goal model.

## Goals

| Goal | Kind | Type | Category | Priority | Fit criterion |
| --- | --- | --- | --- | --- | --- |
| Achieve [Ambulance Intervention] | Behavioral goal |  |  |  |  |
| Achieve [Ambulance Mobilised] | Behavioral goal |  |  |  |  |
| Achieve [Incident Form Encoded] | Behavioral goal |  |  |  |  |
| Achieve [Ambulance Mobilised Based on Incident Form] | Behavioral goal |  |  |  |  |
| Achieve [Ambulance Allocated Based on Incident Form] | Behavioral goal |  |  |  |  |
| Achieve [Ambulance Allocated Based on Incident Form and Ambulance Info] | Behavioral goal |  |  |  |  |
| Achieve [Accurate Ambulance Info] | Behavioral goal |  |  |  |  |
| Ambulances deployed (RE'11 §IV.D's fifth decision point) | Behavioral goal |  |  |  |  |
| Achieve [Allocated Ambulance Mobilised] | Behavioral goal |  |  |  |  |
| Achieve [Mobilised Ambulance Intervention] | Behavioral goal |  |  |  |  |

## Goal details

None.

## Refinements

| Goal | Refined into | Alternative | Tactic | Status | System |
| --- | --- | --- | --- | --- | --- |
| Achieve [Ambulance Intervention] | Achieve [Ambulance Mobilised], Achieve [Mobilised Ambulance Intervention] |  |  |  |  |
| Achieve [Ambulance Mobilised] | Achieve [Incident Form Encoded], Achieve [Ambulance Mobilised Based on Incident Form] |  |  |  |  |
| Achieve [Ambulance Mobilised Based on Incident Form] | Achieve [Ambulance Allocated Based on Incident Form], Achieve [Allocated Ambulance Mobilised] |  |  |  |  |
| Achieve [Ambulance Allocated Based on Incident Form] | Achieve [Ambulance Allocated Based on Incident Form and Ambulance Info], Achieve [Accurate Ambulance Info], Ambulances deployed (RE'11 §IV.D's fifth decision point) |  |  |  |  |

## Domain properties

None.

## Requirements and expectations

| Goal | Assigned to | As |
| --- | --- | --- |
| Achieve [Incident Form Encoded] | Option 1.1. Current paper-based, Option 1.2. Computer-based call taking, Option 1.3. Automated Call Location, Option 1.4. Computer-based + automated location | requirement |
| Achieve [Ambulance Allocated Based on Incident Form and Ambulance Info] | Option 4.1. Current paper-based, Option 4.2. Interactive Allocation, Option 4.3. Fully Automated Allocation | requirement |
| Achieve [Accurate Ambulance Info] | Option 3.1. Current radio and paper-based, Option 3.2. Automated Vehicle Location (A), Option 3.3. Automated Vehicle Location (B) | requirement |
| Ambulances deployed (RE'11 §IV.D's fifth decision point) | 100 ambulances, 120 ambulances, 140 ambulances, 160 ambulances, 180 ambulances, 200 ambulances | requirement |
| Achieve [Allocated Ambulance Mobilised] | Option 2.1. Current Radio-based, Option 2.2. MDT- System A, Option 2.3. MDT- System B | requirement |
| Achieve [Mobilised Ambulance Intervention] |  | unassigned |

## Agents

| Agent | Kind | Responsible for |
| --- | --- | --- |
| Option 1.1. Current paper-based | Agent | Achieve [Incident Form Encoded] |
| Option 1.2. Computer-based call taking | Agent | Achieve [Incident Form Encoded] |
| Option 1.3. Automated Call Location | Agent | Achieve [Incident Form Encoded] |
| Option 1.4. Computer-based + automated location | Agent | Achieve [Incident Form Encoded] |
| Option 2.1. Current Radio-based | Agent | Achieve [Allocated Ambulance Mobilised] |
| Option 2.2. MDT- System A | Agent | Achieve [Allocated Ambulance Mobilised] |
| Option 2.3. MDT- System B | Agent | Achieve [Allocated Ambulance Mobilised] |
| Option 3.1. Current radio and paper-based | Agent | Achieve [Accurate Ambulance Info] |
| Option 3.2. Automated Vehicle Location (A) | Agent | Achieve [Accurate Ambulance Info] |
| Option 3.3. Automated Vehicle Location (B) | Agent | Achieve [Accurate Ambulance Info] |
| Option 4.1. Current paper-based | Agent | Achieve [Ambulance Allocated Based on Incident Form and Ambulance Info] |
| Option 4.2. Interactive Allocation | Agent | Achieve [Ambulance Allocated Based on Incident Form and Ambulance Info] |
| Option 4.3. Fully Automated Allocation | Agent | Achieve [Ambulance Allocated Based on Incident Form and Ambulance Info] |
| 100 ambulances | Agent | Ambulances deployed (RE'11 §IV.D's fifth decision point) |
| 120 ambulances | Agent | Ambulances deployed (RE'11 §IV.D's fifth decision point) |
| 140 ambulances | Agent | Ambulances deployed (RE'11 §IV.D's fifth decision point) |
| 160 ambulances | Agent | Ambulances deployed (RE'11 §IV.D's fifth decision point) |
| 180 ambulances | Agent | Ambulances deployed (RE'11 §IV.D's fifth decision point) |
| 200 ambulances | Agent | Ambulances deployed (RE'11 §IV.D's fifth decision point) |

## Conflicts

None.
