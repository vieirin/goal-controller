# Requirements document: mine-pump

Generated from its KAOS goal model.

## Goals

| Goal | Kind | Type | Category | Priority | Fit criterion |
| --- | --- | --- | --- | --- | --- |
| Avoid [MinerInOverflowedMine] | Behavioral goal |  |  |  |  |
| Avoid [WorkingShiftLost] | Behavioral goal |  |  |  |  |
| Achieve [WaterAlarmIffCriticalWaterLevel] | Behavioral goal |  |  |  |  |
| PumpOnWhenHighWater | Behavioral goal |  |  |  |  |
| AlarmWhenMineOverflowed | Behavioral goal |  |  |  |  |
| Maintain [PumpOnWhenHighWaterAndNoMethane] | Behavioral goal |  |  |  |  |
| Maintain [PumpOffWhenMethane] | Behavioral goal |  |  |  |  |
| Maintain [PumpOffWhenLowWater] | Behavioral goal |  |  |  |  |

## Goal details

| Goal | Source | Stability | Formal specification | Issue |
| --- | --- | --- | --- | --- |
| Maintain [PumpOnWhenHighWaterAndNoMethane] |  |  | when sump.highWater and not mine.methane then next pump.pumpOn |  |
| Maintain [PumpOffWhenMethane] |  |  | when mine.methane then next not pump.pumpOn |  |
| Maintain [PumpOffWhenLowWater] |  |  | when sump.lowWater then next not pump.pumpOn |  |

## Refinements

None.

## Domain properties

None.

## Requirements and expectations

| Goal | Assigned to | As |
| --- | --- | --- |
| Avoid [MinerInOverflowedMine] |  | unassigned |
| Avoid [WorkingShiftLost] |  | unassigned |
| Achieve [WaterAlarmIffCriticalWaterLevel] |  | unassigned |
| PumpOnWhenHighWater |  | unassigned |
| AlarmWhenMineOverflowed |  | unassigned |
| Maintain [PumpOnWhenHighWaterAndNoMethane] | PumpController | requirement |
| Maintain [PumpOffWhenMethane] | PumpController | requirement |
| Maintain [PumpOffWhenLowWater] | PumpController | requirement |

## Agents

| Agent | Kind | Responsible for |
| --- | --- | --- |
| PumpController | Agent | Maintain [PumpOnWhenHighWaterAndNoMethane], Maintain [PumpOffWhenMethane], Maintain [PumpOffWhenLowWater] |
| Environment | Environment agent |  |

## Conflicts

None.
