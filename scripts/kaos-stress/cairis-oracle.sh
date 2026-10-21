#!/usr/bin/env bash
# CAIRIS's own obstacle propagation (goal-controller#192): each obstacle's
# probability as CAIRIS's stored procedure `obstacleProbability`
# (cairis/sql/procs.sql) computes it, per environment, for each CAIRIS model
# file given, as CSV on stdout:
#
#   file,environment,obstacle,cairis
#
# Run in Docker only (nothing of CAIRIS is installed or committed): MySQL
# 8.0 (not mysql:lts, whose schema load fails with ERROR 6125) and CAIRIS's
# image, both pinned by digest, on a network of their own, removed after.
# The image's procs.sql is cairis-platform/cairis 44cc57d's, byte for byte
# for obstacleProbability.
#
#   scripts/kaos-stress/cairis-oracle.sh \
#     packages/lib/test/importers/fixtures/cairis/synthetic.xml \
#     packages/lib/test/importers/fixtures/cairis/ACME_Water.xml
#
# Its output is committed as packages/lib/test/importers/fixtures/cairis/
# cairis-oracle.csv; the tests and stress:kaos read that file.
set -euo pipefail

MYSQL_IMAGE='mysql@sha256:7dcddc01f13bab2f15cde676d44d01f61fc9f99fe7785e86196dfc07d358ae2b' # mysql:8.0
CAIRIS_IMAGE='shamalfaily/cairis@sha256:acbb1c3ae154ac4c284748110dbab4cd21b69b981940ef84a48f7638dbc2e893'
NET=cairis-oracle-net
DB=cairis-oracle-mysql
APP=cairis-oracle

[ "$#" -gt 0 ] || { echo "usage: $0 <cairis model .xml>..." >&2; exit 2; }

cleanup() {
  docker rm -f "$APP" "$DB" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
}
trap cleanup EXIT
cleanup

docker network create "$NET" >/dev/null
# the image's configuration names its database host cairis-mysql
docker run -d --name "$DB" --network "$NET" --network-alias cairis-mysql \
  -e MYSQL_ROOT_PASSWORD=my-secret-pw "$MYSQL_IMAGE" \
  --thread_stack=256K --max_sp_recursion_depth=255 \
  --log_bin_trust_function_creators=1 >/dev/null
for _ in $(seq 1 90); do
  docker exec "$DB" mysqladmin ping -h 127.0.0.1 -uroot -pmy-secret-pw --silent >/dev/null 2>&1 && break
  sleep 2
done
sleep 5
# setupDb.sh (the image's command) loads the schema and the procedures, then serves
docker run -d --name "$APP" --network "$NET" "$CAIRIS_IMAGE" >/dev/null
for _ in $(seq 1 120); do
  docker logs "$APP" 2>&1 | grep -q 'mod_wsgi-express start-server' && break
  sleep 2
done
sleep 10
docker exec "$APP" /addAccount.sh test test TestUser >/dev/null 2>&1

files=()
given="$*"
for file in "$@"; do
  name=$(basename "$file")
  docker cp "$file" "$APP:/tmp/$name"
  files+=("/tmp/$name")
done

docker exec -i "$APP" env ORACLE_FILES="$given" CAIRIS_SRC=/cairis/cairis PYTHONPATH=/cairis CAIRIS_CFG=/cairis.cnf \
  python3 - "${files[@]}" <<'PY'
import os, sys
from cairis.daemon import create_test_app
from cairis.core.Borg import Borg
from cairis.mio.ModelImport import importModelFile

app = create_test_app()
db = Borg().get_dbproxy('test')
print("# CAIRIS's obstacleProbability (cairis/sql/procs.sql) per environment, run in Docker by")
print('# scripts/kaos-stress/cairis-oracle.sh ' + ' '.join(os.environ['ORACLE_FILES'].split()))
print("# (mysql:8.0 and shamalfaily/cairis, pinned by digest in the script). Obstacles CAIRIS gives no value in an environment are left out.")
print('file,environment,obstacle,cairis')
for path in sys.argv[1:]:
    with open(os.devnull, 'w') as quiet:
        out = sys.stdout
        sys.stdout = quiet
        try:
            importModelFile(path, 1, 'test')
        finally:
            sys.stdout = out
    name = os.path.basename(path)
    for environment in sorted(db.getEnvironments().keys()):
        envId = db.getDimensionId(environment, 'environment')
        for obstacle in sorted(db.getObstacles().keys()):
            obsId = db.getDimensionId(obstacle, 'obstacle')
            value, _rationale = db.obstacleProbability(obsId, envId)
            if value is None:
                continue
            print(f'{name},"{environment}","{obstacle}",{value!r}')
PY
