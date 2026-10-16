#!/usr/bin/env bash
# Pruebas SQL del MDM (v6 → v7 → v8 → v9 → v10) en un Postgres descartable.
#
#   apps/nex-os/supabase/tests/run.sh
#   PG_BIN=/ruta/a/postgres/bin apps/nex-os/supabase/tests/run.sh
#
# Necesita Postgres 15+ con pgcrypto (initdb, pg_ctl, psql). Usa $PG_BIN si está definido; si no, el PATH.
# Crea un cluster en un directorio temporal (solo socket Unix, sin TCP), aplica stubs de Supabase, v6, v7, los datos
# de prueba, v8 dos veces y v9 y v10 dos veces (idempotencia), corre tests.sql y borra todo al salir.
# Sale con código distinto de 0 si alguna prueba falla o si algún script da error.
set -euo pipefail

HERE=$(cd "$(dirname "$0")" && pwd)
SQL_DIR=$(cd "$HERE/.." && pwd)

bin() {
	if [ -n "${PG_BIN:-}" ]; then
		echo "$PG_BIN/$1"
	else
		command -v "$1" || { echo "No encuentro $1: definí PG_BIN" >&2; exit 2; }
	fi
}
INITDB=$(bin initdb)
PG_CTL=$(bin pg_ctl)
PSQL=$(bin psql)

TMP=$(mktemp -d "${TMPDIR:-/tmp}/nex-mdm-sql.XXXXXX")
PORT=$((50000 + RANDOM % 10000))
cleanup() {
	"$PG_CTL" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true
	rm -rf "$TMP"
}
trap cleanup EXIT

"$INITDB" -D "$TMP/data" -U postgres -A trust --no-locale -E UTF8 >"$TMP/initdb.log" 2>&1 ||
	{ cat "$TMP/initdb.log" >&2; exit 2; }
# Socket en el directorio temporal y sin TCP: no choca con otro Postgres ni con otra corrida.
"$PG_CTL" -D "$TMP/data" -l "$TMP/server.log" -w \
	-o "-p $PORT -k $TMP -c listen_addresses='' -c fsync=off" start >/dev/null ||
	{ cat "$TMP/server.log" >&2; exit 2; }

q() { "$PSQL" -h "$TMP" -p "$PORT" -U postgres -d postgres -X -q -v ON_ERROR_STOP=1 "$@"; }

if ! q -tAc "select 1 from pg_available_extensions where name = 'pgcrypto'" | grep -q 1; then
	echo "Este Postgres no trae pgcrypto: usá otro (PG_BIN=...)" >&2
	exit 2
fi

apply() {
	local label=$1 file=$2
	if ! q -f "$file" >"$TMP/apply.log" 2>&1; then
		echo "ERROR aplicando $label:" >&2
		grep -E 'ERROR|FATAL' "$TMP/apply.log" >&2 || cat "$TMP/apply.log" >&2
		exit 1
	fi
	echo "ok  $label"
}

apply stubs "$HERE/stubs.sql"
apply v6 "$SQL_DIR/schema-mdm-v6.sql"
apply v7 "$SQL_DIR/schema-mdm-v7.sql"
apply seed "$HERE/seed.sql"
apply "v8 (1ra pasada)" "$SQL_DIR/schema-mdm-v8.sql"
apply "v8 (2da pasada)" "$SQL_DIR/schema-mdm-v8.sql"
apply "v9 (1ra pasada)" "$SQL_DIR/schema-mdm-v9.sql"
apply "v9 (2da pasada)" "$SQL_DIR/schema-mdm-v9.sql"
apply "v10 (1ra pasada)" "$SQL_DIR/schema-mdm-v10.sql"
apply "v10 (2da pasada)" "$SQL_DIR/schema-mdm-v10.sql"

status=0
q -f "$HERE/tests.sql" >"$TMP/tests.log" 2>&1 || status=$?
sed -nE 's/^(psql:[^:]*:[0-9]+: )?NOTICE: +((PASS|FAIL).*)$/\2/p' "$TMP/tests.log"
pass=$(grep -cE 'NOTICE: +PASS' "$TMP/tests.log" || true)
fail=$(grep -cE 'NOTICE: +FAIL' "$TMP/tests.log" || true)

echo
if [ "$status" -ne 0 ]; then
	echo "tests.sql se cortó con un error:" >&2
	grep -E 'ERROR' "$TMP/tests.log" >&2 || tail -5 "$TMP/tests.log" >&2
	fail=$((fail + 1))
fi
echo "Resultado: $pass PASS, $fail FAIL"
[ "$fail" -eq 0 ]
