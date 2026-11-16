# Requirements document: fire-alarm

Generated from its KAOS goal model.

## Goals

| Goal | Kind | Type | Category | Priority | Fit criterion |
| --- | --- | --- | --- | --- | --- |
| Achieve [BuildingEvacuatedWhenFire] | Behavioral goal |  |  |  |  |
| Achieve [FireDetectedInTime] | Behavioral goal |  |  |  |  |
| Achieve [FireNoticedInTimeWhenSmoke] | Behavioral goal |  |  |  |  |
| Achieve [FireNoticedInTimeWhenHeat] | Behavioral goal |  |  |  |  |
| Maintain [FireDetectedWhenNoticedInTime] | Behavioral goal |  |  |  |  |
| Achieve [BuildingEvacuatedWhenFireDetected] | Behavioral goal |  |  |  |  |
| Achieve [AlarmRaisedWhenFireDetected] | Behavioral goal |  |  |  |  |
| Achieve [AlarmRaisedAfter30SecondsWhenFireDetectedUnlessDisabled] | Behavioral goal |  |  |  |  |
| Achieve [AlarmSignalAfter30SecondsWhenFireDetectedUnlessDisabled] | Behavioral goal |  |  |  |  |
| Achieve [AlarmActivatedWhenSignal] | Behavioral goal |  |  |  |  |
| Achieve [FireCentralNotifiedWhenSignal] | Behavioral goal |  |  |  |  |
| Achieve [AlarmBeep30SecondsUnlessDisabled] | Behavioral goal |  |  |  |  |
| Achieve [BuildingEvacuatedWhenAlarmRaised] | Behavioral goal |  |  |  |  |

## Goal details

None.

## Refinements

| Goal | Refined into | Alternative | Tactic | Status | System |
| --- | --- | --- | --- | --- | --- |
| Achieve [BuildingEvacuatedWhenFire] | Achieve [FireDetectedInTime], Achieve [BuildingEvacuatedWhenFireDetected] |  | milestone-driven |  |  |
| Achieve [FireDetectedInTime] | Achieve [FireNoticedInTimeWhenSmoke], Achieve [FireNoticedInTimeWhenHeat], Maintain [FireDetectedWhenNoticedInTime] |  |  |  |  |
| Achieve [BuildingEvacuatedWhenFireDetected] | Achieve [AlarmRaisedWhenFireDetected], Achieve [BuildingEvacuatedWhenAlarmRaised] |  |  |  |  |
| Achieve [AlarmRaisedWhenFireDetected] | Achieve [AlarmRaisedAfter30SecondsWhenFireDetectedUnlessDisabled], Achieve [AlarmBeep30SecondsUnlessDisabled] |  |  |  |  |
| Achieve [AlarmRaisedAfter30SecondsWhenFireDetectedUnlessDisabled] | Achieve [AlarmSignalAfter30SecondsWhenFireDetectedUnlessDisabled], Achieve [AlarmActivatedWhenSignal], Achieve [FireCentralNotifiedWhenSignal] |  |  |  |  |

## Domain properties

| Domain property | Description | In the refinement of |
| --- | --- | --- |
| NoDetectionWhenHeatDetectorBroken |  |  |
| NoDetectionWhenSmokeDetectorBroken |  |  |

## Requirements and expectations

| Goal | Assigned to | As |
| --- | --- | --- |
| Achieve [FireNoticedInTimeWhenSmoke] | SmokeSensor | requirement |
| Achieve [FireNoticedInTimeWhenHeat] | HeatSensor | requirement |
| Maintain [FireDetectedWhenNoticedInTime] | DetectionSystem | requirement |
| Achieve [AlarmSignalAfter30SecondsWhenFireDetectedUnlessDisabled] | FireControlUnit | requirement |
| Achieve [AlarmActivatedWhenSignal] | FireControlUnit | requirement |
| Achieve [FireCentralNotifiedWhenSignal] | NotificationSystem | requirement |
| Achieve [AlarmBeep30SecondsUnlessDisabled] | FireControlUnit | requirement |
| Achieve [BuildingEvacuatedWhenAlarmRaised] | Occupants | expectation |

## Agents

| Agent | Kind | Responsible for |
| --- | --- | --- |
| SmokeSensor | Agent | Achieve [FireNoticedInTimeWhenSmoke] |
| HeatSensor | Agent | Achieve [FireNoticedInTimeWhenHeat] |
| DetectionSystem | Agent | Maintain [FireDetectedWhenNoticedInTime] |
| Occupants | Environment agent | Achieve [BuildingEvacuatedWhenAlarmRaised] |
| FireControlUnit | Agent | Achieve [AlarmBeep30SecondsUnlessDisabled], Achieve [AlarmSignalAfter30SecondsWhenFireDetectedUnlessDisabled], Achieve [AlarmActivatedWhenSignal] |
| NotificationSystem | Agent | Achieve [FireCentralNotifiedWhenSignal] |

## Conflicts

None.

## Obstacles

| Obstacle | Category | Obstructs | Resolved by | Resolution |
| --- | --- | --- | --- | --- |
| NoHeatDetection |  | Achieve [FireNoticedInTimeWhenHeat] |  |  |
| FireNoticedTooLateByHeat |  |  |  |  |
| FireTooDistantFromDetector |  |  |  |  |
| HeatDetectorBroken |  |  |  |  |
| NoSmokeDetection |  | Achieve [FireNoticedInTimeWhenSmoke] |  |  |
| FireNoticedTooLateBySmoke |  |  |  |  |
| SmokeDetectorBroken |  |  |  |  |
| FireNoticedInTimeAndNotDetected |  | Maintain [FireDetectedWhenNoticedInTime] |  |  |
| WrongHeatNotification |  |  |  |  |
| WrongSmokeNotification |  |  |  |  |
| FireDetectionDelayed |  |  |  |  |
| NoAlarmSignalAndFireDetected |  | Achieve [AlarmSignalAfter30SecondsWhenFireDetectedUnlessDisabled] |  |  |
| BatteryOutofService |  |  |  |  |
| AlarmNotActivatedAndSignal |  | Achieve [AlarmActivatedWhenSignal] |  |  |
| LightStrobeBroken |  |  |  |  |
| BellBroken |  |  |  |  |
| FireCentralNotNotifiedAndSignal |  | Achieve [FireCentralNotifiedWhenSignal] |  |  |
| NetworkDown |  |  |  |  |
| FireCentralNotificationDelayed |  |  |  |  |
