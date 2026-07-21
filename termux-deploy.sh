#!/data/data/com.termux/files/usr/bin/bash
set -Eeuo pipefail

EXPECTED_BUILD="1.4.18-diagnose13"
HEALTH_URL="https://hitr.rdoe.workers.dev/api/health"
REPO="${HOME}/hitr"
PACKAGE_ROOT="$(cd "$(dirname "$0")" && pwd)"

fail() {
  printf '\n❌ %s\n' "$*" >&2
  exit 1
}

trap 'fail "Abbruch in Zeile $LINENO. Deployment nicht vollständig abgeschlossen."' ERR

echo "=== Hitster Cloudflare ${EXPECTED_BUILD} ==="

if command -v pkg >/dev/null 2>&1; then
  missing=()
  for cmd in git node curl timeout; do
    command -v "$cmd" >/dev/null 2>&1 || missing+=("$cmd")
  done
  if ((${#missing[@]})); then
    echo "Fehlende Termux-Werkzeuge werden einmalig installiert …"
    pkg install -y git nodejs curl coreutils
  fi
fi

command -v git >/dev/null 2>&1 || fail "git fehlt."
command -v node >/dev/null 2>&1 || fail "node fehlt."
command -v curl >/dev/null 2>&1 || fail "curl fehlt."
command -v timeout >/dev/null 2>&1 || fail "timeout fehlt."

[[ -f "$PACKAGE_ROOT/wrangler.jsonc" ]] || fail "wrangler.jsonc fehlt im Paket."
[[ -f "$PACKAGE_ROOT/src/worker.js" ]] || fail "src/worker.js fehlt im Paket."

echo "[1/5] Paket prüfen"
node --check "$PACKAGE_ROOT/src/worker.js"
if [[ -d "$PACKAGE_ROOT/tests" ]]; then
  while IFS= read -r -d '' test_file; do
    echo "  Test: $(basename "$test_file")"
    timeout 25s node "$test_file"
  done < <(find "$PACKAGE_ROOT/tests" -maxdepth 1 -type f \( -name '*.mjs' -o -name '*.js' \) -print0 | sort -z)
fi

echo "[2/5] Repository vorbereiten"
if [[ ! -d "$REPO/.git" ]]; then
  rm -rf "$REPO"
  git clone https://github.com/Resa59/hitr.git "$REPO"
else
  git -C "$REPO" fetch origin main
  git -C "$REPO" checkout main
  git -C "$REPO" reset --hard origin/main
  git -C "$REPO" clean -fdx
fi
OLD_COMMIT="$(git -C "$REPO" rev-parse HEAD)"

echo "[3/5] Dateien übernehmen und pushen"
find "$REPO" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -a "$PACKAGE_ROOT"/. "$REPO"/
cd "$REPO"
git add -A
if git diff --cached --quiet; then
  echo "  Keine neuen Änderungen zu committen."
else
  git commit -m "Deploy Hitster ${EXPECTED_BUILD}"
  git push origin main
fi
NEW_COMMIT="$(git rev-parse HEAD)"
echo "  Alter Commit: $OLD_COMMIT"
echo "  Neuer Commit: $NEW_COMMIT"

echo "[4/5] Cloudflare-Health prüfen"
for attempt in $(seq 1 36); do
  response="$(curl -fsS --max-time 10 "$HEALTH_URL" 2>/dev/null || true)"
  if printf '%s' "$response" | grep -q '"build"[[:space:]]*:[[:space:]]*"'"$EXPECTED_BUILD"'"'; then
    echo "  ✅ Richtige Version aktiv:"
    printf '%s\n' "$response"
    echo "[5/5] Fertig"
    exit 0
  fi
  echo "  Versuch $attempt/36: noch nicht bestätigt; warte 5 Sekunden."
  sleep 5
done

fail "GitHub wurde aktualisiert, aber der Health-Check meldet ${EXPECTED_BUILD} noch nicht. Manuell prüfen: curl -fsS --max-time 10 '$HEALTH_URL' && echo"
