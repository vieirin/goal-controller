# DeltaIoT (ActivFORMS)

The DeltaIoT network from Weyns and Iftikhar, *ActivFORMS: A Formally-Founded
Model-Based Approach to Engineer Self-Adaptive Systems*
([arXiv 1908.11179](https://arxiv.org/abs/1908.11179)), as an EdgeV2 goal model.
The model states the network's high-level requirements; EdgeV2 generates the
PRISM model, PRISM resolves the decisions (the planner), and the network
executes the chosen tasks. This is the MAPE-K loop of the paper, with PRISM in
place of its Uppaal-SMC analysis and planner.

| Paper | Model |
| --- | --- |
| R1 packet loss below 10% | G1, maintain `R4<=10` (R4: packet loss, %) |
| R2 minimise energy | `cost` on T1..T7 (relative energy), against `utility` (delivery quality) on T1..T5 |
| R3 latency below 5% of the cycle, added at runtime | G2, maintain `R5<5` (R5: latency, % of cycle), pursued once `r3Enabled` |
| R4 failsafe | G1 `[G3->G4]`: an energy-efficient configuration, else G4 (maximum power, duplicated packets) |
| `CHANGE_POWER` | G5 `[G7\|G8]`: low power while the SNR margin `R3>3`, else power fitted to the SNR |
| `CHANGE_DISTR` | G6 `[G9\|G10]`: one parent while traffic `R2<=5`, split only for motes with `twoParents` |
| Transmission power 0..15 | R0, initially 15 (the reference setting) |
| Distribution factor, 20% steps | R1, step 0..5 (5 = 100%) |
| Traffic load 0..10 messages | R2 |
| Link SNR | R3, the margin above 0 dB, 0..20 (EdgeV2 resources take no negative bound) |

- `deltaIoT.txt`: the model (piStar JSON).
- `variables.json`: the contexts (`networkActive`, `twoParents`,
  `r3Enabled`) and each task's achievability. The probabilities are illustrative, not from the paper; in a
  run they come from the monitored SNR and traffic.
- `props/deltaIoT.props`: the requirements and the refinement semantics as PCTL.

The paper adapts 15 motes; the model has one power choice and one routing
choice, standing for every mote's. The resources start with packet
loss and latency within bounds, so G1 and G2 hold; with R4 above 10, G1 is
only achieved once the System module has transitions that move R4
(DeltaIoT's quality models), which the model does not supply. Costs and
utilities are relative, not the paper's energy in Coulomb.

## Known engine gaps (checked in PRISM)

- Once G0 is achieved, the root has no enabled command, so PRISM marks that
  state as a deadlock. `P>=1 [ G !"deadlock" ]` therefore fails even when
  every requirement holds; read the deadlock as "requirements satisfied".
  The engine does not handle this yet (see `achieve.ts` in the edgeV2
  engine).
- Nothing moves R4 or R5, so when G1 or G2 is violated the controller keeps
  pursuing it without ever achieving it (no deadlock, but no progress).
