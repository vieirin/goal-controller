# GRL: Smart home (SmartHome2.jucm)

**What it exercises:** the `.jucm` importer on a 2014 jUCMNav file (features, a feature model diagram, Use Case Maps beside the GRL graph), and the quantitative and qualitative evaluations of its strategy, checked against jUCMNav's own (goal-controller #106).

- **Source:** [gmussbacher/seg.jUCMNav](https://github.com/gmussbacher/seg.jUCMNav) `modelExamples/SmartHome2.jucm` at commit `aaaabe83bf9fdbaa5f3d04cae799a715cae960ed` (2014), copied unchanged.
- **Licence:** Eclipse Public License 1.0. `LICENSE-EPL-1.0` is the repository's `LICENSE`, copied unchanged. The model is © its jUCMNav authors (author recorded in the file: YK). It is redistributed under the EPL, which allows copying with this notice; nothing here modifies it.
- **What is in the project:**
  - `SmartHome2.jucm`: the source.
  - `SmartHome2.txt`: the model `importJucm` makes of it, in the GRL dialect.
  - `strategies/StrategiesGroup5.json`: its one strategy, the `strategies` resource.
  - `reference/evaluations.csv`: jUCMNav's evaluation of it. The oracle (`docker/jucmnav/`, #105 D1) runs jUCMNavPlus `ffe86d60` and writes every element and actor under the strategy, for quantitative at tolerance 0, quantitative at tolerance 10, and qualitative.
- **What was mapped:**
  - 20 elements: 17 `grl:Feature` of the 2014 `Feature` type, read as tasks, and 3 goals.
  - 25 links: decompositions as refinements, contributions with their GRL type and weight.
  - The strategy.
  - Not imported: 9 elements are in no GRL diagram (they are placed in a grid); the feature model diagram; the 2 Use Case Maps; the elements' metadata.
- **Checked by:** `pnpm stress:grl`: the import, and the evaluations against `reference/` (exact integers and labels).
- **Blocks:** feature-model semantics (`FeatureModelStrategyAlgorithm`) are not ported (#106, still open); the evaluations here don't need them.
