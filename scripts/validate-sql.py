#!/usr/bin/env python3
"""Check every static SQL string in the Rust code against a live schema.

Extracts the string literal passed to sqlx::query / query_as / query_scalar and
PREPAREs it, so a missing table or column, a bad cast or a syntax error is
reported without running anything. Dynamic SQL (format!) is skipped and listed.

    DATABASE_URL=postgresql://nid:nid@localhost:5432/nid scripts/validate-sql.py

Exits non-zero if any statement fails to prepare. Prepared statements are
parsed and analysed but never executed, inside a transaction that is rolled back.
"""
import glob, os, re, subprocess, sys

DB = os.environ.get("DATABASE_URL")
if not DB:
    sys.exit("set DATABASE_URL")

CALL = re.compile(r'sqlx::query(?:_as|_scalar)?(?:::<[^>]*>)?\(\s*(r#"(?:.|\n)*?"#|"(?:[^"\\]|\\.)*")', re.S)
files = sorted(glob.glob("crates/*/src/**/*.rs", recursive=True) + glob.glob("apps/rust-api/src/**/*.rs", recursive=True) + glob.glob("services/*/src/**/*.rs", recursive=True))

def literal(s):
    return s[3:-2] if s.startswith('r#"') else bytes(s[1:-1], "utf-8").decode("unicode_escape")

stmts, dynamic = [], []
for f in files:
    src = open(f).read()
    for m in CALL.finditer(src):
        sql = literal(m.group(1)).strip()
        line = src.count("\n", 0, m.start()) + 1
        if "{" in sql and "format!" in src[max(0, m.start() - 40):m.start()]:
            dynamic.append((f, line)); continue
        # SET (e.g. transaction isolation) and set_config cannot be PREPAREd.
        if sql.upper().startswith(("SELECT SET_CONFIG", "SET ", "ALTER ", "CREATE ", "DROP ")) or "pg_advisory" in sql:
            continue
        # One-time upgrade code that reads columns a migration later removes.
        if "validate-sql: skip" in sql:
            continue
        stmts.append((f, line, sql))

failures = 0
for i, (f, line, sql) in enumerate(stmts):
    script = f"BEGIN;\nPREPARE v{i} AS\n{sql};\nROLLBACK;\n"
    r = subprocess.run(["psql", DB, "-v", "ON_ERROR_STOP=1", "-q", "-X", "-f", "-"], input=script, capture_output=True, text=True)
    if r.returncode != 0:
        failures += 1
        err = next((l for l in r.stderr.splitlines() if "ERROR" in l), r.stderr.strip())
        print(f"FAIL {f}:{line}\n     {err.strip()}\n     {' '.join(sql.split())[:150]}")
print(f"\n{len(stmts)} statements checked, {failures} failed, {len(dynamic)} dynamic skipped")
sys.exit(1 if failures else 0)
