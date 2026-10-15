# Patient monitoring (iStar 2011, Fig. 1)

Morandini, Perini, Marchetto, *Empirical Evaluation of Tropos4AS
Modelling*, iStar 2011, CEUR-WS vol. 766, p. 14
([PDF](https://ceur-ws.org/Vol-766/paper03.pdf)): Fig. 1, "Fragment of the
Tropos4AS model for a patient monitoring system". It is the only figure of
Tropos4AS's failure model, conditions and artifacts we can read
(goal-controller#134 D2). Transcribed element for element, its layout scaled
from it (0.6 piStar units per pixel of the figure at 500 dpi, shown at
2000 px wide); colours as drawn.

**The paper cuts the figure off** at its legend and at the bottom of the
page. Elements on that edge are marked ✂ below; what lies beyond it is not
in the model.

## What is transcribed

| In the figure | In the model (piStar id) | Notes |
| --- | --- | --- |
| actors Care Assistant, Patient, PMA (red) | `CareAssistant`, `Patient`, `PMA` | PMA's dashed ellipse is istar-ts's boundary rectangle |
| dependum follow medical instructins (goal) | `followInstructionsDependum` | Care Assistant → … → PMA; the figure's spelling |
| dependum reduce need for assistance (softgoal) | `reduceNeed` | Care Assistant → … → PMA |
| dependum don't bring annoyances (softgoal) | `noAnnoyances` | Patient → … → PMA |
| (M) follow medical instructins | goal `followInstructions`, maintain | its maintain condition `instructionsFollowed` is ours |
| (A) eat meals | goal `eatMeals` | AND child of follow medical instructins; achievement `mealSensor.meals >= 2`, the **achieve-c: 2 meals** note |
| (A) take medicine before 8PM | goal `takeMedicine` | AND child; creation `hour >= 6`, the **creation-c: 6 AM** note (on a subgoal: warned, AAMAS 2009 fn. 1); achievement `medicineSensor.taken` and failure `hour >= 20` ours |
| «seq» | sequence link `eatMeals` → `takeMedicine` | ✂ its source is cut off: read as eat meals, before taking the medicine (one of eat meals' cut-off OR subgoals is equally possible) |
| failures meals not eaten, medicine not taken (stars) | `mealsNotEaten`, `medicineNotTaken` | dashed to eat meals, take medicine: failure links |
| ERROR: patient did not eat autonomously | error `errorNotEat` | → meals not eaten; condition `!ateAutonomously` ours |
| ERROR: medicine not taken autonomously | error `errorMedicine` | → medicine not taken: the figure draws this line dashed (the other error links solid); the model has an error link like the others; condition `!medicineTakenAutonomously` ours |
| ERROR: no dinner until 8PM | error `errorNoDinner` | → medicine not taken; condition `hour >= 20 & mealSensor.meals < 2` ours |
| take medicine without dinner (goal) | goal `takeMedicineNoDinner` | means-end to ERROR: no dinner until 8PM (its recovery; iStar 2.0 has no means-end link, so a means-end is written as an OR-refinement of its end); precondition `mealSensor.meals >= 2`, the **precond: 2 meals** note (not read: no rule for it) |
| plan call assistant | task `callAssistant` | ✂ half hidden by the legend; means-end to ERROR: patient did not eat |
| plan remember through speakers | task `rememberSpeakers` | ✂ at the bottom edge; means-end to take medicine before 8PM |
| artifacts medicine sensor, meal sensor (yellow) | `medicineSensor` (`taken:bool`), `mealSensor` (`meals:int`) | attributes ours |
| a condition note's dashed lines to its goal and to an artifact | `tropos4as.ReadsLink` artifact → goal or error | medicine sensor → take medicine, ERROR: medicine not taken; meal sensor → eat meals, ERROR: no dinner, take medicine without dinner (#134 D8) |

The conditions read the artifacts the figure draws as members
(goal-controller#137): `medicineSensor.taken`, `mealSensor.meals`; the
scenario's beliefs name them so. `hour` is a variable: the figure draws no
artifact it would belong to (a clock).

Not in the model, beyond the cut (✂): eat meals' three OR subgoals (their
links rise from below the edge), the plans under the two ERRORs on the right
(their means-end arrows rise from below), and whatever the dashed line from
ERROR: patient did not eat leads to below the legend.

## Scenario and reference

`scenarios/a-day.json`, **ours**: 6 AM, two meals by noon, at 8 PM the
reminder fails and the medicine isn't taken. `reference/trace-a-day.txt` is
**derived by hand from AAMAS 2009's rules**: take medicine fails and is
dropped (its failure condition holds), medicine not taken occurs, follow
medical instructins fails its AND decomposition and restarts, and the error
"medicine not taken autonomously" is adopted.
