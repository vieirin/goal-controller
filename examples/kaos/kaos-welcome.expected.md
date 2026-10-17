# Requirements document: kaos-welcome

Generated from its KAOS goal model.

## Goals

| Goal | Kind | Type | Category | Priority | Fit criterion |
| --- | --- | --- | --- | --- | --- |
| Reliability | Softgoal | softgoal |  |  |  |
| Achieve [Problem Notified if Problem] | Behavioral goal |  |  |  |  |
| Backup | Softgoal | softgoal |  |  |  |
| Maintain [Minimal Interval Between Automatic Backups] | Behavioral goal |  |  |  |  |
| Achieve [Manual Backup] | Behavioral goal |  |  |  |  |
| Save Bandwidth | Softgoal | softgoal |  |  |  |

## Goal details

None.

## Refinements

| Goal | Refined into | Alternative | Tactic | Status | System |
| --- | --- | --- | --- | --- | --- |
| Reliability | Achieve [Problem Notified if Problem], Backup |  |  |  |  |
| Backup | Maintain [Minimal Interval Between Automatic Backups] | 1 of 2 |  |  |  |
| Backup | Achieve [Manual Backup] | 2 of 2 |  |  |  |
| Maintain [Minimal Interval Between Automatic Backups] | Internet connection available |  |  |  |  |

## Domain properties

| Domain property | Description | In the refinement of |
| --- | --- | --- |
| Internet connection available |  | Maintain [Minimal Interval Between Automatic Backups] |

## Requirements and expectations

| Goal | Assigned to | As |
| --- | --- | --- |
| Achieve [Problem Notified if Problem] |  | unassigned |
| Achieve [Manual Backup] | User | expectation |

## Agents

| Agent | Kind | Responsible for |
| --- | --- | --- |
| User | Environment agent | Achieve [Manual Backup] |

## Conflicts

| Between | And | Boundary condition |
| --- | --- | --- |
| Internet connection available | Save Bandwidth |  |
