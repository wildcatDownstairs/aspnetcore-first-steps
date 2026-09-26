#!/usr/bin/env bash
# CI only: use an isolated Compose project and temporary volume; do not contact an external identity service.
set -euo pipefail
cd "$(dirname "$0")"
if [ -e .env ]; then
  echo "An existing .env was found; aborting CI verification to avoid overwriting local settings." >&2
  exit 1
fi
project="todo23-ci-${RANDOM}-$$"
work=$(mktemp -d)
compose=(docker compose -p "$project")
cleanup() {
  "${compose[@]}" down --volumes --remove-orphans
  rm -f .env
  rm -rf "$work"
}
trap cleanup EXIT
cp .env.example .env
"${compose[@]}" run --rm init-data
"${compose[@]}" run --rm migrate
"${compose[@]}" create api
container=$("${compose[@]}" ps -aq api)
docker cp "$container:/data/todos.db" "$work/before.db"
# Prepare data for the persistence check; integration tests cover JWT and CRUD separately.
python3 - "$work/before.db" <<'PY'
import sqlite3, sys
with sqlite3.connect(sys.argv[1]) as db:
    db.execute('INSERT INTO Todos (Title, Done, CategoryId) VALUES (?, ?, ?)', ('CI persistent', 0, 1))
PY
docker cp "$work/before.db" "$container:/data/todos.db"
"${compose[@]}" run --rm --user 0:0 --entrypoint sh migrate -c 'chown 1654:1654 /data/todos.db'
"${compose[@]}" up -d api
check_http() {
  curl --fail --silent --show-error --retry 20 --retry-connrefused --retry-delay 1 http://127.0.0.1:5080/health
  for path in /openapi/v1.json /scalar; do
    [ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:5080$path")" = 404 ]
  done
  [ "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:5080/todos)" = 401 ]
}
check_http
"${compose[@]}" up -d --force-recreate api
check_http
"${compose[@]}" stop api
container=$("${compose[@]}" ps -aq api)
docker cp "$container:/data/todos.db" "$work/after.db"
python3 - "$work/after.db" <<'PY'
import sqlite3, sys
with sqlite3.connect(sys.argv[1]) as db:
    assert db.execute('SELECT Title FROM Todos').fetchall() == [('CI persistent',)]
    assert db.execute('SELECT COUNT(*) FROM __EFMigrationsHistory').fetchone() == (2,)
    assert db.execute('SELECT COUNT(*) FROM Categories').fetchone() == (2,)
print('Container recreation preserved Todo data and migration history.')
PY
