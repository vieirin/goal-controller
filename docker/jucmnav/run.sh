#!/bin/sh
# The GRL oracle: builds the image (once; it is cached), then evaluates every
# .jucm in a seeds directory with jUCMNav itself, a CSV per seed into an
# output directory. Docker only: nothing is installed on the host.
#
#   docker/jucmnav/run.sh <seeds directory> <output directory>
set -eu
here=$(cd "$(dirname "$0")" && pwd)
seeds=$(cd "$1" && pwd)
mkdir -p "$2"
out=$(cd "$2" && pwd)
docker build -t goal-controller/jucmnav-oracle "$here"
docker run --rm -v "$seeds:/seeds:ro" -v "$out:/out" goal-controller/jucmnav-oracle
