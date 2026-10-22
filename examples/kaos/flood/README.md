# Flood detection system (SEAMS'17's running example)

The running example of Cailliau and van Lamsweerde, *Runtime monitoring and
resolution of probabilistic obstacles to system goals* (SEAMS'17, DOI
10.1109/SEAMS.2017.5, Figs. 1–2, Table I), and of Cailliau's thesis (2017,
ch. 7): a river's depth and speed are monitored, and locals warned when the
levels are critical. Countermeasures to its obstacles (a camera for the
ultrasound speed sensor, SMS or e-mail for the phone warning) are selected
by kaosres, SEAMS'17's countermeasure selection (goal-controller#191, #200).

## Where it comes from

- **The model and its estimates:** `running-example-fds/model2.kaos` in
  [ancailliau/phd-thesis](https://github.com/ancailliau/phd-thesis) at
  `6a9f5fd` (2017-09-22), as written. Used with the owner's approval; the
  repository states no licence.
- **The three constraints** (`declare constraint … conflict`), which the
  thesis's copy comments out: `FloodingSimulator/Model.kaos` in
  [ancailliau/FloodingSimulator](https://github.com/ancailliau/FloodingSimulator)
  at `ef6db9f` (2016-08-24; MIT, © 2016 Antoine Cailliau), where they are
  declared, appended as written.

Nothing else is added. The Email goal's name is blank (`"  "`), as the file
has it. `SpeedAcquiredEvery10SecondsByUltrasound` is a goal that resolves
nothing, and the emergency countermeasure of Table I is commented out in
both files.

## Files

- `flood.kaos`: the project's native file. It opens in kaosres's mode (it
  has resolutions).
- `flood.txt`: the model, as the `.kaos` importer reads it. The two
  two-goal constraints are Conflict links; the three-goal one (SMS, e-mail,
  phone) is kept as written, as no link joins three goals.
- `flood.expected.csv`: kaosres's selection on the seed, every number
  derived by hand, checked by `pnpm stress:kaos`. **No published oracle**:
  SEAMS'17's Table I (ESR .52/.68/.72/.81/.77 at cost 0/2/2/2/4) can't be
  reproduced from any published file. Its leaf rates were monitored at an
  unstated moment, two of its countermeasures resolve nothing in the files,
  and its figures fit no one set of leaf rates. The arithmetic is in
  `packages/dialect/docs/frameworks.md`, "Step 4 part B". The rows with
  `semantics=kaostools` are KAOSTools 05a5125's CMSelector's output on the
  thesis's file, reproduced.

## What it gives

Achieve [LocalsWarnedWhenRiskImminent] (RSR 65 %) is at 40.8 % with no
countermeasure. The cheapest safe and consistent selection costs 3: the
camera (its conflicts take Maintain [CameraSpeedAccurate] with it) and SMS
or e-mail, 76 %. Under KAOSTools' rules, which read no conflict, it costs
2: the camera and SMS or e-mail.
