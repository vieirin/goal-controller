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
| R1 packet loss below 10% | G1, maintain `packetLossBelow10` |
| R2 minimise energy | `cost` on T1..T7 (relative energy) |
| R3 latency bound (added at runtime) | G2, maintain `latencyWithinBound` |
| R4 failsafe | G1 `[G3@2->G4]`: two attempts at an energy-efficient configuration, then G4 |
| `CHANGE_POWER` | G5 `[G7\|G8]`: low power, or power fitted to the link SNR |
| `CHANGE_DISTR` | G6 `[G9\|G10]`: one parent, or split across parents |
| SNR and traffic uncertainty | contexts `highInterference`, `highTraffic` |

- `deltaIoT.txt`: the model (piStar JSON).
- `variables.json`: one snapshot of the contexts, and each task's
  achievability. The probabilities are illustrative, not from the paper; in a
  run they come from the monitored SNR and traffic.
- `props/deltaIoT.props`: the requirements and the refinement semantics as PCTL.

The paper adapts 15 motes; the model has one power choice and one routing
choice, standing for every mote's. The snapshot has packet loss and latency
within bounds, so G1 and G2 hold; with `packetLossBelow10` false, G1 is only
achieved once the System module has transitions that move the context
(DeltaIoT's quality models), which the model does not supply.
