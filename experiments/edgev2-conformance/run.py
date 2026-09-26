#!/usr/bin/env python3
"""edgeV2 conformance run — see README.md in this folder.

Suites
  reference  goal trees reconstructed from the EDGE fuzzer's reference PRISM
             models (EDGE-XT code/evaluation/generated_models); edgeV2 output is
             compared against the exact reference file.
  freeform   random trees exercising the whole edgeV2 notation (tasks at any
             depth, 1–4 children, every operator, arbitrary retries, goals
             without notation). Trees that only use reference constructs are
             also compared against the reference rendering.

For every model a folder <out>/<suite>/<name>/ is written with
  goal.txt            piStar goal model (edgeV2 input)
  notation.txt        the tree in RT notation, one goal per token
  tree.json           the tree (used to re-render reports)
  edgev2.prism        edgeV2 output (or edgev2.error.txt)
  edgev2.pctl         properties in edgeV2 names
  reference.prism     reference model, errata applied (when the tree has one)
  reference.pctl      reference properties (+ P=? [F root achieved])
  errata.json         reference defects corrected before comparison
  findings.json       raw structural differences vs the reference
  *.prism.log         PRISM output (with --prism)
and <out>/SUMMARY.md, the human-readable report.

Usage
  python3 run.py                                   # committed example set
  python3 run.py --prism                           # … and model-check it
  python3 run.py --reference-filter '*' --freeform 60 --out /tmp/edgev2-full
  python3 run.py --report-only /tmp/edgev2-full    # re-render SUMMARY.md
"""
from __future__ import annotations

import argparse
import datetime
import fnmatch
import json
import re
import shutil
import subprocess
import sys
import uuid
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
sys.path.insert(0, str(HERE))

import compare  # noqa: E402
import models  # noqa: E402
import prism_expr  # noqa: E402
import report  # noqa: E402

DEFAULT_REFERENCE_DIR = REPO.parent / "EDGE-XT" / "code" / "evaluation" / "generated_models"
DEFAULT_OUT = REPO / "examples" / "edgeV2" / "generated"
DEFAULT_REFERENCE_FILTER = "random_N10_d[234]_w2_00[0-2]"
PRISM_IMAGE = "prism49"


# ---------------------------------------------------------------------------
# Suites
# ---------------------------------------------------------------------------


def build_reference_suite(reference_dir: Path, pattern: str) -> list[dict]:
    cases = []
    for prism_file in sorted(reference_dir.glob("*.prism")):
        if not fnmatch.fnmatch(prism_file.stem, pattern):
            continue
        text = prism_file.read_text()
        root, n = models.tree_from_reference(text)
        cases.append({
            "suite": "reference", "name": prism_file.stem, "root": root, "n": n,
            "reference": text, "reference_pctl": prism_file.with_suffix(".pctl").read_text(),
        })
    return cases


def build_freeform_suite(count: int) -> list[dict]:
    cases = []
    for seed in range(count):
        reference_only = seed % 3 == 0  # every third tree is reference-comparable
        root = models.random_tree(
            seed, max_depth=2 + seed % 3, max_children=2 + seed % 3, reference_only=reference_only,
        )
        case = {"suite": "freeform", "name": f"freeform_{seed:03d}", "root": root, "n": 10}
        if root.has_reference():
            case["reference"], case["reference_pctl"] = models.reference_model(root, 10)
        cases.append(case)
    return cases


def write_cases(cases: list[dict], out: Path) -> list[dict]:
    manifest = []
    for case in cases:
        folder = out / case["suite"] / case["name"]
        if folder.exists():
            shutil.rmtree(folder)
        folder.mkdir(parents=True)
        case["folder"] = folder
        (folder / "goal.txt").write_text(models.to_pistar(case["root"], case["name"]))
        (folder / "notation.txt").write_text(models.describe(case["root"]) + "\n")
        (folder / "tree.json").write_text(json.dumps({"n": case["n"], "root": models.tree_to_dict(case["root"])}))
        pctl = models.generic_pctl(case["root"])
        if "reference" in case:
            case["reference"], case["reference_pctl"], case["errata"] = models.apply_errata(
                case["root"], case["reference"], case["reference_pctl"])
            (folder / "reference.prism").write_text(case["reference"])
            (folder / "errata.json").write_text(json.dumps(case["errata"]))
            fn = models.name_mapper(case["root"])
            root_ach = f"g{case['root'].id}_achieved"
            (folder / "reference.pctl").write_text(case["reference_pctl"].strip() + f"\nP=? [ F {root_ach} ]\n")
            pctl = models.translate_pctl(case["reference_pctl"], fn).strip() + "\n" + pctl
        (folder / "edgev2.pctl").write_text(pctl)
        manifest.append({"goal": str(folder / "goal.txt"), "out": str(folder / "edgev2.prism"), "n": case["n"]})
    return manifest


def load_cases(out: Path) -> list[dict]:
    """Rebuild cases from an existing output folder (for --report-only).
    Works with folders written by older versions of this script, too."""
    cases = []
    for folder in sorted(p for p in out.glob("*/*") if (p / "goal.txt").exists()):
        case = {"suite": folder.parent.name, "name": folder.name, "folder": folder}
        reference = folder / "reference.prism"
        if (folder / "tree.json").exists():
            data = json.loads((folder / "tree.json").read_text())
            case["root"], case["n"] = models.tree_from_dict(data["root"]), data["n"]
        elif reference.exists():
            case["root"], case["n"] = models.tree_from_reference(reference.read_text())
        else:
            case["root"], case["n"] = models.tree_from_pistar((folder / "goal.txt").read_text()), 10
        if reference.exists():
            pctl = folder / "reference.pctl"
            # older folders hold the reference before errata; applying them again is a no-op otherwise
            case["reference"], _, errata = models.apply_errata(
                case["root"], reference.read_text(), pctl.read_text() if pctl.exists() else "")
            stored = folder / "errata.json"
            case["errata"] = Counter(json.loads(stored.read_text())) if stored.exists() else errata
        cases.append(case)
    return cases


def convert(manifest: list[dict], out: Path) -> None:
    manifest_file = out / ".manifest.json"
    manifest_file.write_text(json.dumps(manifest))
    subprocess.run(["node", str(HERE / "convert.js"), str(manifest_file)], check=True)
    manifest_file.unlink()


def compare_cases(cases: list[dict]) -> dict[str, compare.Report]:
    reports = {}
    for case in cases:
        folder = case["folder"]
        edge_file = folder / "edgev2.prism"
        if "reference" not in case:
            continue
        if not edge_file.exists():
            report_ = compare.Report([compare.Finding("model", "model", "edgeV2 generation failed", "",
                                                      edgev2=(folder / "edgev2.error.txt").read_text()[:400])])
        else:
            report_ = compare.compare(case["reference"], edge_file.read_text(), case["root"], case["n"])
        (folder / "findings.json").write_text(json.dumps([asdict(f) for f in report_.findings], indent=1))
        reports[f"{case['suite']}/{case['name']}"] = report_
    return reports


# ---------------------------------------------------------------------------
# PRISM (docker)
# ---------------------------------------------------------------------------


def constants_for(model_text: str, root, n: int) -> str:
    """Values for undefined constants, as chosen by the reference fuzzer:
    decision_X = int(0.2 N), _decision_X = int((N-1)/#children)."""
    children = {node.id: len(node.children) for node in root.walk()}
    values = []
    for name, value in prism_expr.parse_model(model_text).constants.items():
        if value is not None:
            continue
        if name.startswith("_decision_"):
            values.append(f"{name}={int((n - 1) / max(1, children[name[len('_decision_'):]]))}")
        elif name.startswith("decision_"):
            values.append(f"{name}={int(0.2 * n)}")
        elif name == "N":
            values.append(f"N={n}")
        else:
            raise ValueError(f"no value for undefined constant {name}")
    return ",".join(values)


def _prism_job(folder: Path, kind: str, constants: str, timeout: int) -> None:
    """One PRISM run in its own container. PRISM gets `timeout` seconds, a hard
    kill 10 s later if it ignores SIGTERM, and the container itself is killed
    if docker does not return within timeout + 60 s."""
    log = folder / f"{kind}.prism.log"
    container = f"edgev2-prism-{uuid.uuid4().hex[:12]}"
    command = (f"timeout -k 10 {timeout} prism -javamaxmem 4g {kind}.prism {kind}.pctl"
               + (f" -const {constants}" if constants else ""))
    try:
        result = subprocess.run(
            ["docker", "run", "--rm", "--name", container, "-v", f"{folder}:/work", "-w", "/work",
             PRISM_IMAGE, "bash", "-c", command],
            capture_output=True, text=True, timeout=timeout + 60,
        )
        output = result.stdout + result.stderr
        if result.returncode in (124, 137):
            output += f"\nTIMEOUT: PRISM exceeded {timeout}s\n"
    except subprocess.TimeoutExpired:
        subprocess.run(["docker", "kill", container], capture_output=True)
        output = f"TIMEOUT: container killed after {timeout + 60}s\n"
    log.write_text(output)


def run_prism(cases: list[dict], timeout: int, jobs: int) -> None:
    work = []
    for case in cases:
        folder = case["folder"]
        edge = folder / "edgev2.prism"
        if not edge.exists():
            continue
        work.append((folder, "edgev2", constants_for(edge.read_text(), case["root"], case["n"])))
        if (folder / "reference.prism").exists():
            work.append((folder, "reference", ""))
    print(f"running PRISM on {len(work)} models ({jobs} in parallel, {timeout}s limit each)")
    with ThreadPoolExecutor(max_workers=jobs) as pool:
        list(pool.map(lambda job: _prism_job(*job, timeout), work))


def read_prism_results(cases: list[dict]) -> dict:
    results = {}
    for case in cases:
        for kind in ("edgev2", "reference"):
            log_file = case["folder"] / f"{kind}.prism.log"
            if not log_file.exists():
                continue
            log = log_file.read_text()
            error = re.search(r"^(Error:.*|TIMEOUT:.*)$", log, flags=re.M)
            results[(str(case["folder"]), kind)] = {
                "results": re.findall(r"^Result:\s*(\S+)", log, flags=re.M),
                "error": error.group(0) if error else None,
            }
    return results


# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--reference-dir", type=Path, default=DEFAULT_REFERENCE_DIR)
    parser.add_argument("--reference-filter", default=DEFAULT_REFERENCE_FILTER,
                        help="glob on reference model names (default: %(default)s)")
    parser.add_argument("--freeform", type=int, default=30, help="number of free-form models")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--prism", action="store_true", help=f"model-check with PRISM (docker image {PRISM_IMAGE})")
    parser.add_argument("--prism-timeout", type=int, default=300, help="seconds per PRISM run")
    parser.add_argument("--prism-jobs", type=int, default=4, help="PRISM runs in parallel")
    parser.add_argument("--report-only", type=Path, metavar="DIR",
                        help="re-render DIR/SUMMARY.md from an existing output folder")
    parser.add_argument("--title", default="", help="report title")
    args = parser.parse_args()

    if args.report_only:
        out = args.report_only
        cases = load_cases(out)
        run_file = out / "RUN.json"
        run_info = json.loads(run_file.read_text()) if run_file.exists() else {}
    else:
        out = args.out
        cases = []
        if args.reference_dir.exists():
            cases += build_reference_suite(args.reference_dir, args.reference_filter)
        else:
            print(f"reference dir {args.reference_dir} not found; skipping reference suite")
        cases += build_freeform_suite(args.freeform)
        out.mkdir(parents=True, exist_ok=True)
        convert(write_cases(cases, out), out)
        run_info = {"date": datetime.date.today().isoformat(), "engine": report.engine_state(REPO),
                    "command": " ".join(sys.argv[1:])}
        (out / "RUN.json").write_text(json.dumps(run_info, indent=1))

    reports = compare_cases(cases)
    if args.prism:
        run_prism(cases, args.prism_timeout, args.prism_jobs)
    summary = report.render(cases, reports, read_prism_results(cases), run_info, args.title)
    (out / "SUMMARY.md").write_text(summary)
    print(summary.split("## What was checked")[0].strip())
    print(f"\nfull report: {out / 'SUMMARY.md'}")


if __name__ == "__main__":
    main()
