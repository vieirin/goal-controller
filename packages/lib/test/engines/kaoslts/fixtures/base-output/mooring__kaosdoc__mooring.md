# Requirements document: mooring

Generated from its KAOS goal model.

## Goals

| Goal | Kind | Type | Category | Priority | Fit criterion |
| --- | --- | --- | --- | --- | --- |
| Rope is safe during service life | Behavioral goal |  |  |  |  |
| Rope is not subject to near-strength load for a prolonged period of time | Behavioral goal |  |  |  |  |
| Avoid near-strength load | Behavioral goal |  |  |  |  |
| Design tension does not exceed 75% of characteristic rope strength | Behavioral goal |  |  |  |  |
| Assert: number of subropes in rope = n | Behavioral goal |  |  |  |  |
| Individual subrope has required proportional strength | Behavioral goal |  |  |  |  |
| Assert: in absence of abrasion, strand cross-section area = full strength | Behavioral goal |  |  |  |  |
| Rope yarns have required proportional strength | Behavioral goal |  |  |  |  |
| Assert: assembly loss factor is less than the specified value, within margins | Behavioral goal |  |  |  |  |
| Assert: operating range < design range | Behavioral goal |  |  |  |  |
| Avoid exposure time exceeding design curve | Behavioral goal |  |  |  |  |

## Goal details

None.

## Refinements

| Goal | Refined into | Alternative | Tactic | Status | System |
| --- | --- | --- | --- | --- | --- |
| Rope is not subject to near-strength load for a prolonged period of time | Avoid near-strength load, Avoid exposure time exceeding design curve |  | milestone-driven |  |  |
| Avoid near-strength load | Design tension does not exceed 75% of characteristic rope strength, Assert: operating range < design range |  |  |  |  |
| Design tension does not exceed 75% of characteristic rope strength | Assert: number of subropes in rope = n, Individual subrope has required proportional strength |  |  |  |  |
| Individual subrope has required proportional strength | Assert: in absence of abrasion, strand cross-section area = full strength, Rope yarns have required proportional strength, Assert: assembly loss factor is less than the specified value, within margins |  |  |  |  |

## Domain properties

| Domain property | Description | In the refinement of |
| --- | --- | --- |
| AP1 | Usage type = mobile; Yarn type = <sanitised>; Vessel type = <sanitised>; Operating area = <sanitised> (Figure 2, printed sanitised) |  |

## Requirements and expectations

| Goal | Assigned to | As |
| --- | --- | --- |
| Rope is safe during service life |  | unassigned |
| Assert: number of subropes in rope = n |  | unassigned |
| Assert: in absence of abrasion, strand cross-section area = full strength |  | unassigned |
| Rope yarns have required proportional strength |  | unassigned |
| Assert: assembly loss factor is less than the specified value, within margins |  | unassigned |
| Assert: operating range < design range |  | unassigned |
| Avoid exposure time exceeding design curve |  | unassigned |

## Agents

None.

## Conflicts

None.

## Obstacles

| Obstacle | Category | Obstructs | Resolved by | Resolution |
| --- | --- | --- | --- | --- |
| Rope loses structural integrity during service life |  | Rope is safe during service life |  |  |
| Failure due to abrasion |  |  |  |  |
| Failure due to tension |  |  |  |  |
| Failure due to global tension |  |  |  |  |
| Failure due to local tension |  |  |  |  |
| Sustained tensile load at levels close to short-term rupture load |  |  | Rope is not subject to near-strength load for a prolonged period of time |  |
| Failure due to fatigue |  |  |  |  |
