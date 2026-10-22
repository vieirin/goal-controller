# CAIRIS fixtures (goal-controller#192)

- `NeuroGrid.xml`, `ACME_Water.xml`, `Balkan_Rail.xml`: CAIRIS's exemplars,
  byte for byte, from `examples/exemplars/` of
  [cairis-platform/cairis](https://github.com/cairis-platform/cairis) at
  `44cc57ddd08fb41a8d028411ec712847eefc9be5`. They are © the CAIRIS authors
  under the Apache License 2.0, which is in `LICENSE` (CAIRIS's own); each
  file keeps its licence header. The repository has no NOTICE file. The
  CAIRIS seeds (`examples/kaos/cairis-*`) are these files read by lib's
  importer, one per environment.
- `synthetic.xml`: ours, hand-written for the cross-check. It holds small
  obstacle trees with probabilities, each a case: an AND (S1, S1b with the
  refined obstacle's own 0.1), an OR (S2), an OR whose sum exceeds 1 (S3),
  an AND and an OR on one obstacle (S4), nested ORs (S5), and a leaf (S6).
  It is not CAIRIS's and not a seed.
- `cairis-oracle.csv`: CAIRIS's own `obstacleProbability`
  (`cairis/sql/procs.sql`) for every obstacle of `synthetic.xml` and of ACME
  Water, as CAIRIS computes it in Docker:

  ```sh
  scripts/kaos-stress/cairis-oracle.sh \
    packages/lib/test/importers/fixtures/cairis/synthetic.xml \
    packages/lib/test/importers/fixtures/cairis/ACME_Water.xml \
    > packages/lib/test/importers/fixtures/cairis/cairis-oracle.csv
  ```

  Nothing of CAIRIS is committed but these numbers. NeuroGrid and Balkan
  Rail aren't in it: their obstacles have no probability (Balkan Rail has
  no obstacles), so CAIRIS gives them all 0. That is no oracle.
- `synthetic.expected.csv`: the synthetic cross-check. Each row has CAIRIS's
  number (from `cairis-oracle.csv`) and kaosprop's (RE'12, derived in the
  row). Where they differ, the row says why: `and-from-0` (CAIRIS's AND
  product starts from 0, since `andProb` is declared `default 0` and never
  set to 1) or `or-sum` (CAIRIS sums an OR with no clamp; RE'12 takes a
  noisy-or). ACME Water's field cross-check is the seed's,
  `examples/kaos/cairis-acme-water-day/cairis-acme-water-day.expected.csv`.
