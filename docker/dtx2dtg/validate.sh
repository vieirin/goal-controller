#!/bin/sh
# Inside the image: `dtx2dtg -v` on every .istardt/.istardtx in $1, a result
# per file into $2 (<name>.txt): `VALID`, or `INVALID` and what dtx2dtg said.
set -u
models=$1
out=$2
cd /istardt
classpath="target/classes:$(cat classpath.txt)"
for model in "$models"/*.istardt "$models"/*.istardtx; do
  [ -e "$model" ] || continue
  name=$(basename "$model")
  name=${name%.*}
  if said=$(java -cp "$classpath" ca.yorku.cmg.istardt.translators.dtx2dtg.dtx2dtg -v -f "$model" 2>&1); then
    echo VALID > "$out/$name.txt"
  else
    { echo INVALID; echo "$said"; } > "$out/$name.txt"
  fi
  echo "$name: $(head -1 "$out/$name.txt")"
done
