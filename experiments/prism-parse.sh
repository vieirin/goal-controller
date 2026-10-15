#!/usr/bin/env bash
# Parse a generated Edge model with PRISM, giving every decision constant a value.
#
# Edge writes its decision variables as undefined constants (`const int decision_…;`),
# to be set per experiment on PRISM's command line. PRISM refuses to parse a model
# with undefined constants, even with -nobuild, so this sets each one to 0: enough
# to check that the generated file is valid PRISM.
#
# Usage: experiments/prism-parse.sh output/<model>.prism
set -euo pipefail
model="${1:?usage: prism-parse.sh <model.prism>}"
consts=$(grep -o '^const int decision_[A-Za-z0-9_]*' "$model" | sed 's/^const int //; s/$/=0/' | paste -sd, -)
if [ -n "$consts" ]; then
  echo "Parsing $model with $(echo "$consts" | tr ',' '\n' | wc -l | tr -d ' ') decision constants set to 0"
  prism -nobuild "$model" -const "$consts"
else
  prism -nobuild "$model"
fi
