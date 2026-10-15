# Cleaner Agent (AAMAS 2009, Fig. 1)

Morandini, Penserini, Perini, *Operational Semantics of Goal Models in
Adaptive Agents*, AAMAS 2009, pp. 129–136
([PDF](https://www.ifaamas.org/Proceedings/aamas09/pdf/01_Full%20Papers/02_11_FP_0633.pdf)):
Fig. 1, "Fragment of a goal model for the Cleaner Agent example", with
§3.1 and §5's text. No machine-readable model exists (goal-controller#134):
this one is transcribed from the figure, element for element, its layout
scaled from it (0.6 piStar units per pixel of the figure at 400 dpi).

## What is transcribed

| In the figure | In the model (piStar id) | Notes |
| --- | --- | --- |
| actor Stake hoder | actor `Stakeholder`, text `Stakehoder` | the figure's spelling, wrapped over two lines |
| actor Cleaner Agent (orange) | actor `CleanerAgent` | its dashed ellipse is istar-ts's boundary rectangle, fitted to its elements |
| dependum RoomClean (hard goal) | goal `RoomCleanDependum` | Stakehoder → RoomClean → Cleaner Agent |
| dependum efficiency (softgoal) | quality `efficiencyDependum` | Stakehoder → efficiency → Cleaner Agent |
| (A) RoomClean | goal `RC`, achieve | §5: achievement condition `room.clean`, written `roomClean` until member references land (goal-controller#137); no failure condition (f = false) |
| (P) WetCleaning, (P) DryCleaning | goals `WC`, `DC`, `type: perform` | OR decomposition of RoomClean, WC's link first (drawn left to right) |
| (M) MaintainBattLoaded | goal `MBL`, `type: maintain` | its maintain condition `batteryLoaded` is ours: the paper gives none |
| plans mop, sweep, load battery | tasks `mop`, `sweep`, `loadBattery` | means-end to WC, DC, MBL: iStar 2.0 has no means-end link, so a plan's means-end is written as an OR-refinement of its goal |
| mop −→ efficiency, sweep +→ efficiency | contributions `hurt`, `help` | |
| softgoal efficiency (olive) | quality `efficiency` | |

The goal types (the A, P, M badges) are the `type` property; the
achievement and maintain conditions are properties of their goals (#134
D3).

## Scenarios and references

- `scenarios/paper.json`: §5's run. DryCleaning succeeds but stubborn dirt
  remains; WetCleaning fails (out of water) but the spots are gone.
  `reference/trace-paper.txt` is §5 and Fig. 3 transcribed: RoomClean's
  seven states and rules, in order, ending in `success(RoomClean)`. The
  engine's full trace also has the self-loop `[OR:subg-achieve]` (WC's
  failure), which Fig. 3 doesn't draw; the stress test compares RoomClean's
  state changes with the reference, exactly.
- `scenarios/all-fail.json`: both alternatives fail and the room stays
  dirty. **Derived by hand from the rules, not from the paper**
  (`reference/trace-all-fail.txt`): RoomClean, `A(s, f)` behaviour a),
  restarts (`[reactivateE]`) rather than being dropped (#134 D6).

DryCleaning is tried first because sweep contributes + to efficiency and mop
− (§3.1; the engine's ordering of OR alternatives, #134 D8), not because of
link order.
