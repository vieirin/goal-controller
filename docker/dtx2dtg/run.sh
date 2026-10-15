#!/bin/sh
# The iStarDT-X writer's oracle: builds the image (once; it is cached, and
# never pushed), then validates every .istardt/.istardtx in a directory with
# dtx2dtg's validator (XSD, then Schematron), a result per file into an
# output directory. Docker only: nothing is installed on the host.
#
#   docker/dtx2dtg/run.sh <models directory> <output directory>
set -eu
here=$(cd "$(dirname "$0")" && pwd)
models=$(cd "$1" && pwd)
mkdir -p "$2"
out=$(cd "$2" && pwd)
docker build -q -t goal-controller/dtx2dtg-validator "$here" >/dev/null
docker run --rm -v "$models:/models:ro" -v "$out:/out" goal-controller/dtx2dtg-validator
