# Requirements document: flood

Generated from its KAOS goal model.

## Goals

| Goal | Kind | Type | Category | Priority | Fit criterion |
| --- | --- | --- | --- | --- | --- |
| Achieve [LocalsWarnedWhenRiskImminent] | Behavioral goal |  |  |  |  |
| Achieve [DepthAcquiredEvery5SecondsByRadar] | Behavioral goal |  |  |  |  |
| Achieve [SpeedAcquiredEvery5SecondsByUltrasound] | Behavioral goal |  |  |  |  |
| Achieve [LevelsCriticalDetectedWhenDataAcquired] | Behavioral goal |  |  |  |  |
| Achieve [LocalsWarnedByPhoneWhenLevelsCritical] | Behavioral goal |  |  |  |  |
| Avoid [FalseWarning] | Behavioral goal |  |  |  |  |
| Maintain [AcquiredRadarDepthAccurate] | Behavioral goal |  |  |  |  |
| Maintain [UltrasoundSpeedAccurate] | Behavioral goal |  |  |  |  |
| Achieve [SpeedAcquiredEvery10SecondsByUltrasound] | Behavioral goal |  |  |  |  |
| Achieve [SpeedAcquiredEvery5SecondsByCamera] | Behavioral goal |  |  |  |  |
| Achieve [ImagesAcquiredEvery5Seconds] | Behavioral goal |  |  |  |  |
| Achieve [SpeedAcquiredFromImages] | Behavioral goal |  |  |  |  |
| Maintain [CameraSpeedAccurate] | Behavioral goal |  |  |  |  |
| Achieve [LocalsWarnedBySMSWhenLevelsCritical] | Behavioral goal |  |  |  |  |
|  | Behavioral goal |  |  |  |  |

## Goal details

| Goal | Source | Stability | Formal specification | Issue |
| --- | --- | --- | --- | --- |
| Achieve [DepthAcquiredEvery5SecondsByRadar] |  |  | when not radarDepthAcquired() then sooner-or-later, before 5 seconds, radarDepthAcquired() |  |
| Achieve [SpeedAcquiredEvery5SecondsByUltrasound] |  |  | when not speedAcquiredByUltrasound() then sooner-or-later, before 5 seconds, speedAcquiredByUltrasound() |  |
| Achieve [LocalsWarnedByPhoneWhenLevelsCritical] |  |  | when acquiredDepthCritical() and acquiredSpeedCritical() then sooner-or-later, before 5 seconds, localsWarnedByPhone() |  |
| Maintain [AcquiredRadarDepthAccurate] |  |  | when radarDepthAcquired() and acquiredDepthCritical() then sooner-or-later, before 3 seconds, depthAccurate() |  |
| Maintain [UltrasoundSpeedAccurate] |  |  | when speedAcquiredByUltrasound() and acquiredSpeedCritical() then sooner-or-later, before 3 seconds, speedAccurate() |  |
| Achieve [SpeedAcquiredEvery10SecondsByUltrasound] |  |  | when not speedAcquiredByUltrasound() then sooner-or-later, before 10 seconds, speedAcquiredByUltrasound() |  |
| Achieve [LocalsWarnedBySMSWhenLevelsCritical] |  |  | when acquiredDepthCritical() and acquiredSpeedCritical() then sooner-or-later, before 5 seconds, localsWarnedBySMS() |  |
|  |  |  | when acquiredDepthCritical() and acquiredSpeedCritical() then sooner-or-later, before 5 seconds, localsWarnedByEmail() |  |

## Refinements

| Goal | Refined into | Alternative | Tactic | Status | System |
| --- | --- | --- | --- | --- | --- |
| Achieve [LocalsWarnedWhenRiskImminent] | Achieve [DepthAcquiredEvery5SecondsByRadar], Achieve [SpeedAcquiredEvery5SecondsByUltrasound], Achieve [LevelsCriticalDetectedWhenDataAcquired], Achieve [LocalsWarnedByPhoneWhenLevelsCritical] |  |  |  |  |
| Avoid [FalseWarning] | Maintain [AcquiredRadarDepthAccurate], Maintain [UltrasoundSpeedAccurate] |  |  |  |  |
| Achieve [SpeedAcquiredEvery5SecondsByCamera] | Achieve [ImagesAcquiredEvery5Seconds], Achieve [SpeedAcquiredFromImages] |  |  |  |  |

## Domain properties

None.

## Requirements and expectations

| Goal | Assigned to | As |
| --- | --- | --- |
| Achieve [DepthAcquiredEvery5SecondsByRadar] | Depth Sensor | requirement |
| Achieve [SpeedAcquiredEvery5SecondsByUltrasound] | Ultrasound Sensor | requirement |
| Achieve [LevelsCriticalDetectedWhenDataAcquired] | Flooding Detection System | requirement |
| Achieve [LocalsWarnedByPhoneWhenLevelsCritical] | VoiceWarner | requirement |
| Maintain [AcquiredRadarDepthAccurate] | Depth Sensor | requirement |
| Maintain [UltrasoundSpeedAccurate] | Ultrasound Sensor | requirement |
| Achieve [SpeedAcquiredEvery10SecondsByUltrasound] | Ultrasound Sensor | requirement |
| Achieve [ImagesAcquiredEvery5Seconds] | camera | requirement |
| Achieve [SpeedAcquiredFromImages] | cameraSpeedModule | requirement |
| Maintain [CameraSpeedAccurate] | cameraSpeedModule | requirement |
| Achieve [LocalsWarnedBySMSWhenLevelsCritical] | SMSWarner | requirement |
|  | EmailWarner | requirement |

## Agents

| Agent | Kind | Responsible for |
| --- | --- | --- |
| Depth Sensor | Agent | Achieve [DepthAcquiredEvery5SecondsByRadar], Maintain [AcquiredRadarDepthAccurate] |
| Ultrasound Sensor | Agent | Achieve [SpeedAcquiredEvery5SecondsByUltrasound], Maintain [UltrasoundSpeedAccurate], Achieve [SpeedAcquiredEvery10SecondsByUltrasound] |
| VoiceWarner | Agent | Achieve [LocalsWarnedByPhoneWhenLevelsCritical] |
| Flooding Detection System | Agent | Achieve [LevelsCriticalDetectedWhenDataAcquired] |
| camera | Agent | Achieve [ImagesAcquiredEvery5Seconds] |
| cameraSpeedModule | Agent | Achieve [SpeedAcquiredFromImages], Maintain [CameraSpeedAccurate] |
| SMSWarner | Agent | Achieve [LocalsWarnedBySMSWhenLevelsCritical] |
| EmailWarner | Agent |  |

## Conflicts

| Between | And | Boundary condition |
| --- | --- | --- |
| Achieve [SpeedAcquiredEvery5SecondsByCamera] | Maintain [UltrasoundSpeedAccurate] |  |
| Achieve [SpeedAcquiredEvery5SecondsByUltrasound] | Maintain [CameraSpeedAccurate] |  |

## Obstacles

| Obstacle | Category | Obstructs | Resolved by | Resolution |
| --- | --- | --- | --- | --- |
| Depth Not Acquired |  | Achieve [DepthAcquiredEvery5SecondsByRadar] |  |  |
| Radar Sensor Broken |  |  |  |  |
| Acquired Depth Not Accurate |  | Maintain [AcquiredRadarDepthAccurate] |  |  |
| Dusty Environment |  |  |  |  |
| False Echo |  |  |  |  |
| Speed Not Acquired |  | Achieve [SpeedAcquiredEvery5SecondsByUltrasound] |  |  |
| Ultrasound Sensor Broken |  |  | Achieve [SpeedAcquiredEvery5SecondsByCamera] | goal substitution, anchored on Achieve [LocalsWarnedWhenRiskImminent] |
| Acquired Speed Not Accurate |  | Maintain [UltrasoundSpeedAccurate] |  |  |
| Distortion in Ultrasound Measure |  |  | Maintain [CameraSpeedAccurate] | goal substitution, anchored on Avoid [FalseWarning] |
| Locals Not Warned In Time |  | Achieve [LocalsWarnedByPhoneWhenLevelsCritical] |  |  |
| Voice Network Overloaded |  |  | Achieve [LocalsWarnedBySMSWhenLevelsCritical], | goal substitution, anchored on Achieve [LocalsWarnedWhenRiskImminent]; goal substitution, anchored on Achieve [LocalsWarnedWhenRiskImminent] |
| GSM Network Down |  | Achieve [LocalsWarnedBySMSWhenLevelsCritical] |  | goal substitution, anchored on Achieve [LocalsWarnedWhenRiskImminent] |
| Noisy Image |  | Achieve [SpeedAcquiredFromImages], Maintain [CameraSpeedAccurate] |  |  |
