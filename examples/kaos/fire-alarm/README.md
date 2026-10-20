# Fire alarm (RE'15)

A. Cailliau, A. van Lamsweerde. *Handling knowledge uncertainty in
risk-based requirements engineering*. RE 2015
([doi:10.1109/RE.2015.7320413](https://doi.org/10.1109/RE.2015.7320413)), the
running example: a fire alarm system whose 13 leaf obstacles two experts
estimate, weighed by Cooke's model on calibration variables. It is the unit
oracle of kaosexpert (goal-controller#190, #197).

## Where each part comes from

The paper prints only part of the model:
- Fig. 1's goals;
- Fig. 2's obstacle trees for three leaf goals;
- Table I's estimates for two of the three calibration variables;
- Table II's for three of the 13 leaf obstacles;
- Table III's results for seven of them.

The rest is Antoine Cailliau's own model of the example, `firesystem.kaos` in
[ancailliau/phd-thesis](https://github.com/ancailliau/phd-thesis/blob/6a9f5fd81ac0be560d30803f04702d23d5622893/running-examples-others/firesystem.kaos)
(`running-examples-others`, last changed at `6a9f5fd`, 2017-09-22). It is
used with the owner's approval; the repository states no licence.

- **Goals and agents:** Fig. 1's.
- **Obstacle trees:** Fig. 2's for the three detection goals. The thesis
  model swaps the heat and smoke "noticed too late" obstacles; Fig. 2 puts
  FireNoticedTooLateByHeat under NoHeatDetection. The tree of each alarm
  goal is the thesis model's.
- **Domain hypotheses:** Fig. 2's two NoDetectionWhen…DetectorBroken.
  Neither source estimates them, so they hold (probability 1).
- **Estimates:**
  - the thesis model's, for 13 leaf obstacles, 2 experts and 3 calibration
    variables, at the quantiles (.1, .5, .9);
  - where Tables I and II print the same values truncated (2.594 % as
    2.5 %, the known 4.37 % as 4.4 %), the thesis's are kept;
  - where the tables print other values, the paper's are kept:
    - FireSprinklerBroken, both experts (Table I): (0 %, 0.1 %, 0.3 %) and
      (0 %, 0.1 %, 0.2 %), against the thesis's 0.023–0.029 % and
      0.019–0.024 %;
    - BatteryOutofService, Expert2 (Table II): (0 %, 0.1 %, 0.2 %), against
      the thesis's 0.16–0.19 %. Fig. 5(b) plots this estimate over 0–0.2 %.

## Files

- **`fire-alarm.kaos`:** the project's native file. It opens in
  kaosexpert's mode.
- **`fire-alarm.txt`:** the model as the `.kaos` importer reads it.
- **`experts.json`** and **`calibrations.json`:** its experts and
  calibration variables, which the importer reads from the file's
  `declare expert` and `declare calibration`.
- **`fire-alarm.expected.csv`:** every oracle row with its derivation.
  `stress:kaos` checks it.

## What is reproduced

- **Exactly, from the paper's own inputs:**
  - both calibration scores, 0.9305 and 1, which depend only on Table I's
    bins and the 16 estimated variables;
  - the weights from §V's printed scores;
  - §VI.B's BDD chain: 98.22 %, printed 98.21 %.
- **From the seed, which is the thesis's data, not the paper's:**
  - **Top goal:** VU 1, as the paper.
  - **US:** 0.1586. The paper prints 0.1645 in §III and 0.1529 in §VII.
  - **Information scores:** 0.4348 / 0.5552, printed 0.4216 / 0.4740. The
    residual is unexplained: the paper's inputs still differ somewhere
    unpublished.
  - **SU(0.84):** 0.85, printed 0.78.
  - **Table III:** the same seven obstacles, the two certain ones first.
    BatteryOutofService's VU is 0.41, where the paper prints 1.
