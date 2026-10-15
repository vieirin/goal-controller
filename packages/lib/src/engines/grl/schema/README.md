# jUCMNav's metamodel

The `.jucm` format's schema (goal-controller#144): `grl.ecore` (with its `kpimodel` subpackage), `urn.ecore`, `urncore.ecore` and `ucm.ecore`, as JUCMNAV/jUCMNavPlus has them at `ffe86d60` (`seg.jUCMNav/src/seg/jUCMNav/emf/`, the commit `docker/jucmnav` builds). The importer and the writer read and write the namespaces `grl`, `grl.kpimodel` and `urn`. `urncore` and `ucm` are what `urn` contains.

The metamodel's defaults are the ones the reader's zod schemas fall back on, the ones the writer leaves out, and the ones `canonicalJucm` drops.

EPL-1.0 (`LICENSE-EPL-1.0`), as jUCMNav. Copied unchanged.
