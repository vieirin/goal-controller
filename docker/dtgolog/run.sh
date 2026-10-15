#!/bin/sh
# The iStar-DT oracle: builds the image (once; it is cached, and never
# pushed: DT-Golog.pl's licence forbids redistribution), then runs DT-Golog
# on every .pl in a directory, a result per program into an output
# directory. Docker only: nothing is installed on the host.
#
#   docker/dtgolog/run.sh <programs directory> <output directory>
set -eu
here=$(cd "$(dirname "$0")" && pwd)
specs=$(cd "$1" && pwd)
mkdir -p "$2"
out=$(cd "$2" && pwd)
docker build -q -t goal-controller/dtgolog-oracle "$here" >/dev/null
docker run --rm -v "$specs:/specs:ro" -v "$out:/out" goal-controller/dtgolog-oracle
