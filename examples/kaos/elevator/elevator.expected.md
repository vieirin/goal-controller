# Requirements document: elevator

Generated from its KAOS goal model.

## Goals

| Goal | Kind | Type | Category | Priority | Fit criterion |
| --- | --- | --- | --- | --- | --- |
| Passengers informed of elevator direction | Behavioral goal |  |  |  |  |
| Elevator direction updated few seconds before next stop | Behavioral goal |  |  |  |  |
| LEDs at least 2in high | Behavioral goal |  |  |  |  |
| Elevator direction announced by voice | Behavioral goal |  |  |  |  |
| Robust and reliable elevator system | Behavioral goal |  |  |  |  |
| Self-reconfigurable system in case of partial failure | Behavioral goal |  |  |  |  |
| Maximum permitted time delay for repairing failure enforced | Behavioral goal |  |  |  |  |
| Worn-out components replaced in time | Behavioral goal |  |  |  |  |
| Maintenance program provided | Behavioral goal |  |  |  |  |
| MTBF requirements specified | Behavioral goal |  |  |  |  |
| Maintenance program defined | Behavioral goal |  |  |  |  |
| Maintenance program executed | Behavioral goal |  |  |  |  |
| Worn-out components replaced | Behavioral goal |  |  |  |  |
| Elevator system monitored | Behavioral goal |  |  |  |  |
| Component wear detected | Behavioral goal |  |  |  |  |
| Component wear reported | Behavioral goal |  |  |  |  |
| System protected against fire | Behavioral goal |  |  |  |  |
| Doors locked open when fire alarm is set | Behavioral goal |  |  |  |  |
| All moving elevators stopped as soon as they reach any floor, when a fire alarm is set | Behavioral goal |  |  |  |  |
| Fireproof cage provided | Behavioral goal |  |  |  |  |
| Fireproof equipment provided | Behavioral goal |  |  |  |  |
| Efficient elevator system | Behavioral goal |  |  |  |  |
| Moving elevator stopped next floor in case of fire signal | Behavioral goal |  |  |  |  |
| Elevator stopped | Behavioral goal |  |  |  |  |
| Minimize elevator moves | Behavioral goal |  |  |  |  |
| Minimize average waiting time | Behavioral goal |  |  |  |  |
| Elevator stopped on calling floor | Behavioral goal |  |  |  |  |
| Stop button used | Behavioral goal |  |  |  |  |

## Goal details

None.

## Refinements

| Goal | Refined into | Alternative | Tactic | Status | System |
| --- | --- | --- | --- | --- | --- |
| Passengers informed of elevator direction | Elevator direction updated few seconds before next stop |  |  |  |  |
| Worn-out components replaced in time | Maintenance program provided, Worn-out components replaced | 1 of 2 |  |  |  |
| Worn-out components replaced in time | Worn-out components replaced, Elevator system monitored | 2 of 2 |  |  |  |
| Maintenance program provided | MTBF requirements specified, Maintenance program defined, Maintenance program executed |  |  |  |  |
| Elevator system monitored | Component wear detected, Component wear reported |  |  |  |  |
| Efficient elevator system | Moving elevator stopped next floor in case of fire signal, Elevator stopped, Minimize elevator moves, Minimize average waiting time |  |  |  |  |

## Domain properties

None.

## Requirements and expectations

| Goal | Assigned to | As |
| --- | --- | --- |
| Elevator direction updated few seconds before next stop |  | unassigned |
| LEDs at least 2in high |  | unassigned |
| Elevator direction announced by voice |  | unassigned |
| Robust and reliable elevator system |  | unassigned |
| Self-reconfigurable system in case of partial failure |  | unassigned |
| Maximum permitted time delay for repairing failure enforced |  | unassigned |
| MTBF requirements specified |  | unassigned |
| Maintenance program defined |  | unassigned |
| Maintenance program executed |  | unassigned |
| Worn-out components replaced |  | unassigned |
| Component wear detected |  | unassigned |
| Component wear reported |  | unassigned |
| System protected against fire |  | unassigned |
| Doors locked open when fire alarm is set | Elevator Controller | requirement |
| All moving elevators stopped as soon as they reach any floor, when a fire alarm is set | Elevator Controller | requirement |
| Fireproof cage provided | Elevator company | expectation |
| Fireproof equipment provided | Elevator company | expectation |
| Moving elevator stopped next floor in case of fire signal |  | unassigned |
| Elevator stopped |  | unassigned |
| Minimize elevator moves |  | unassigned |
| Minimize average waiting time |  | unassigned |
| Elevator stopped on calling floor | Elevator Controller | requirement |
| Stop button used |  | unassigned |

## Agents

| Agent | Kind | Responsible for |
| --- | --- | --- |
| Elevator Controller | Agent | Doors locked open when fire alarm is set, All moving elevators stopped as soon as they reach any floor, when a fire alarm is set, Elevator stopped on calling floor |
| Elevator company | Environment agent | Fireproof cage provided, Fireproof equipment provided |
| Passenger | Environment agent |  |

## Conflicts

None.

## Obstacles

| Obstacle | Category | Obstructs | Resolved by | Resolution |
| --- | --- | --- | --- | --- |
| Elevator direction unreadable |  | Elevator direction updated few seconds before next stop |  |  |
| Inadequate LED size |  |  | LEDs at least 2in high | obstacle prevention |
| Elevator direction unreadable by blind people |  |  | Elevator direction announced by voice | obstacle prevention |
| Insufficient display contrast |  |  |  |  |
| Service interrupted |  | Robust and reliable elevator system | Self-reconfigurable system in case of partial failure, Maximum permitted time delay for repairing failure enforced, Worn-out components replaced in time | obstacle mitigation; goal restoration; obstacle prevention |
