#!/bin/sh
# The contextual goal models' oracle: builds the image (once; it is cached,
# and never pushed: DLV's licence forbids redistribution), then runs DLV 2
# on every .dlv in a directory and z3 on its checks.json, a result per job
# into an output directory. Docker only: nothing is installed on the host.
#
#   docker/dlv/run.sh <jobs directory> <output directory>
set -eu
here=$(cd "$(dirname "$0")" && pwd)
jobs=$(cd "$1" && pwd)
mkdir -p "$2"
out=$(cd "$2" && pwd)
docker build -q --platform linux/amd64 -t goal-controller/dlv-oracle "$here" >/dev/null
docker run --rm --platform linux/amd64 -v "$jobs:/jobs:ro" -v "$out:/out" goal-controller/dlv-oracle
