# Mine pump, FSE'04's probabilistic layer

The mine pump control system as Letier and van Lamsweerde restate it with
quantitative goals in *Reasoning about Partial Goal Satisfaction for
Requirements and Design Engineering* (SIGSOFT'04/FSE-12, pp. 53–62, §3.2
and §3.3), for kaossim (goal-controller#193, #208).

## Where each part comes from

FSE'04 only, re-keyed from its text; nothing else:

- **The five goals** it names: Avoid [MinerInOverflowedMine], Avoid
  [WorkingShiftLost], Achieve [WaterAlarmIffCriticalWaterLevel] (§3.2, H1
  and H2), PumpOnWhenHighWater and AlarmWhenMineOverflowed (§4.3). Each
  definition is FSE'04's own words.
- **Achieve [WaterAlarmIffCriticalWaterLevel]'s quantities** (§3.2, H2):
  - the Boolean quality variables WaterAlarmFailure (over the time points
    at which the water level becomes critical) and FalseWaterAlarmInShift
    (over the working shifts), with their sample spaces and definitions;
  - the objective functions AlarmFailureRate, `P(WaterAlarmFailure) Min
    10⁻⁴`, and FalseAlarmRate, `P(FalseWaterAlarmInShift) Min 10⁻³`;
  - their PCTL instances (§3.3) as `ObjectiveSpec`, a `formula` tagged
    `pctl` that nothing checks yet:
    `WaterLevel ≥ 'Overflow' ⇒ Pr≥1−10⁻⁴ ○ WaterAlarm = 'On'` and
    `Pr≥1−10⁻³ □≤8h (WaterAlarm = 'On' → WaterLevel ≥ 'Overflow')`.

    The PDF draws ○ and □ in Wingdings (codes 0xA1 and 0xA8, which
    `pdftotext` shows as `¡` and `¨`). They are read as next and globally:
    §3.3 says "the CTL symbols F (finally) and G (globally) are noted ◊ and
    □". The targets are written as `0.0001` and `0.001`, the values FSE'04
    prints as `10-4` and `10-3`.

## What FSE'04 doesn't print

- **A refinement.** The goals "contribute" to the Avoid goals (§3.2 H2,
  §4.3), but no refinement is drawn, so the seed has none. §4.3 also names
  the first goal Avoid [MinerInsideOverflowedMine]; that is kept in its
  definition.
- **An estimate of any quality variable.** No objective function therefore
  has a value. kaossim reports both as unresolved and names the variable
  each lacks. `mine-pump.expected.csv` checks the targets as read, checks
  the two unresolved objectives, and lists the values as not
  reproducible. H3's dynamic alternative, `WaterAlarmFailure: Time →
  Bool`, is described, not used.
- **Objective functions on the Avoid goals.** FSE'04 describes them in words
  only, without a name or a target. The words are kept as their
  definitions.

The structural mine pump (operations, agents, interfaces, KAOS2LTSA) is
#194's (step 7). It grows this file: the same file, the operations
round's keys beside kaossim's.

## Files

- `mine-pump.kaos`: the project's native file. It opens in kaossim's mode.
- `mine-pump.txt`: the model, `mine-pump.kaos` read.
- `mine-pump.expected.csv`: the oracle (`scripts/kaos-stress`).
