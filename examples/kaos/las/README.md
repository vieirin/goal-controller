# London Ambulance Service (KAOSTools)

Antoine Cailliau's London Ambulance Service model, as KAOSTools ships it:
`Parsing.Tests/Examples/las.kaos` in
[ancailliau/KAOSTools](https://github.com/ancailliau/KAOSTools) at
`6a25d84` (MIT, © 2016 Antoine Cailliau; the licence is in the
repository's readme). It is the model behind Cailliau and van Lamsweerde's
*A probabilistic framework for goal-oriented risk analysis* (RE'12) and
their later papers (RE'15, SEAMS'17).

- `las.kaos`: KAOSTools' file, byte for byte. It is the project's native file
  (goal-controller#181): the model is read from it, and it is written from
  the model once you edit it, in KAOSTools' syntax.
- `las.txt`: the model, as the `.kaos` importer reads the file. It opens in
  kaosres's mode, as a `.kaos` with resolutions does (goal-controller#191):
  RE'12's obstacle probabilities and the countermeasure selection, whose
  one resolution, untyped, is left out. kaosprop and the plain `kaos` mode
  are one switch away.
- `las.expected.csv`: the oracle of **RE'12's hand-drawn model**
  (`packages/lib/test/engines/kaosprop/fixtures/re12-las.txt`), not of this
  file. KAOSTools' `las.kaos` has `[.8]`/`[.2]` case legs where the paper
  has 0.6/0.4, one fax/phone refinement where the paper has two
  alternatives, and none of the paper's estimates. So kaosprop gives other
  numbers here (goal-controller#182).
