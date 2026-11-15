# Requirements document: carpooling

Generated from its KAOS goal model.

## Goals

| Goal | Kind | Type | Category | Priority | Fit criterion |
| --- | --- | --- | --- | --- | --- |
| Achieve [RideRequestServed] | Behavioral goal |  |  |  |  |
| Achieve [RidePlannedWhenRequestEncoded] | Behavioral goal |  |  |  |  |
| Achieve [PassengerAtDestinationWhenRidePlanned] | Behavioral goal |  |  |  |  |
| Achieve [RideInstructionsKnownByRidersWhenRidePlanned] | Behavioral goal |  |  |  |  |
| Achieve [PassengerAtDestinationWhenInstructionsKnown] | Behavioral goal |  |  |  |  |
| Achieve [PassengerInDriver'sCarWhenInstructionsKnown] | Behavioral goal |  |  |  |  |
| Achieve [PassengerAtDestinationWhenInCar] | Behavioral goal |  |  |  |  |
| Achieve [DropPointReachedWhenPassengerInCar] | Behavioral goal |  |  |  |  |
| Achieve [DropPointFromInstructionsReachedWhenPassengerInCar] | Behavioral goal |  |  |  |  |
| Maintain [InstructionsKnownWhenPassengerInCar] | Behavioral goal |  |  |  |  |
| Achieve [PassengerAtDestinationWhenDropPointReached] | Behavioral goal |  |  |  |  |

## Goal details

None.

## Refinements

| Goal | Refined into | Alternative | Tactic | Status | System |
| --- | --- | --- | --- | --- | --- |
| Achieve [RideRequestServed] | Achieve [RidePlannedWhenRequestEncoded], Achieve [PassengerAtDestinationWhenRidePlanned] |  | milestone-driven |  |  |
| Achieve [PassengerAtDestinationWhenRidePlanned] | Achieve [RideInstructionsKnownByRidersWhenRidePlanned], Achieve [PassengerAtDestinationWhenInstructionsKnown] |  | milestone-driven |  |  |
| Achieve [PassengerAtDestinationWhenInstructionsKnown] | Achieve [PassengerInDriver'sCarWhenInstructionsKnown], Achieve [PassengerAtDestinationWhenInCar] |  | milestone-driven |  |  |
| Achieve [PassengerAtDestinationWhenInCar] | Achieve [DropPointReachedWhenPassengerInCar], Achieve [PassengerAtDestinationWhenDropPointReached] |  | milestone-driven |  |  |
| Achieve [DropPointReachedWhenPassengerInCar] | Achieve [DropPointFromInstructionsReachedWhenPassengerInCar], Maintain [InstructionsKnownWhenPassengerInCar] |  | unmonitorability |  |  |

## Domain properties

None.

## Requirements and expectations

| Goal | Assigned to | As |
| --- | --- | --- |
| Achieve [RidePlannedWhenRequestEncoded] |  | unassigned |
| Achieve [RideInstructionsKnownByRidersWhenRidePlanned] |  | unassigned |
| Achieve [PassengerInDriver'sCarWhenInstructionsKnown] |  | unassigned |
| Achieve [DropPointFromInstructionsReachedWhenPassengerInCar] |  | unassigned |
| Maintain [InstructionsKnownWhenPassengerInCar] |  | unassigned |
| Achieve [PassengerAtDestinationWhenDropPointReached] |  | unassigned |

## Agents

None.

## Conflicts

None.

## Obstacles

| Obstacle | Category | Obstructs | Resolved by | Resolution |
| --- | --- | --- | --- | --- |
| Drop Point Not Reached When Passenger In Car |  | Achieve [DropPointFromInstructionsReachedWhenPassengerInCar] |  |  |
| Drop Point Never Reached |  |  |  |  |
| Driver Got Lost |  |  |  |  |
| Car Broken Down |  |  |  |  |
| Wrong Instructions Sent |  |  |  |  |
| Driver At Other Drop Point |  |  |  |  |
| Drop Point Confused |  |  |  |  |
| Unclear Instructions |  |  |  |  |
| Drop Point Inaccessible |  |  |  |  |
| Drop Point Not Reached In Time |  |  |  |  |
| Stuck In Traffic Jam |  |  |  |  |
| Detour On Planned Road |  |  |  |  |
| Other Passenger Late |  |  |  |  |
