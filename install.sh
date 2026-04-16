#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/AhmedEnnaifer/imt.git}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/sovereign-ai-lab}"

say()  { printf "\033[1;34m▸\033[0m %s\n" "$*"; }
ok()   { printf "\033[1;32m✓\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m!\033[0m %s\n" "$*"; }
die()  { printf "\033[1;31m✗\033[0m %s\n" "$*" >&2; exit 1; }

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "missing: $1 — $2"
}

ensure_uv() {
  if ! command -v uv >/dev/null 2>&1; then
    say "installing uv (python toolchain)"
    curl -LsSf https://astral.sh/uv/install.sh | sh
    export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
    command -v uv >/dev/null 2>&1 || die "uv install failed — add \$HOME/.local/bin to PATH"
  fi
}

open_browser() {
  local url="$1"
  if command -v open >/dev/null 2>&1; then open "$url" >/dev/null 2>&1 || true
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$url" >/dev/null 2>&1 || true
  fi
}

printf "\n\033[1m🇪🇺  Sovereign AI Lab — setup\033[0m\n\n"

need_cmd git  "install from https://git-scm.com"
need_cmd node "install Node 18+ from https://nodejs.org"
need_cmd npm  "comes with Node.js"
ensure_uv

if [ ! -d "$INSTALL_DIR" ]; then
  say "cloning into $INSTALL_DIR"
  git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"
else
  say "updating $INSTALL_DIR"
  git -C "$INSTALL_DIR" pull --rebase --autostash >/dev/null 2>&1 || warn "git pull failed (local changes?), continuing"
fi
cd "$INSTALL_DIR"

say "installing python dependencies (uv)"
uv sync --quiet

if [ ! -f .env ]; then
  printf "\n\033[1mGROQ API key\033[0m — paste it (get one free at https://console.groq.com)\n"
  printf "> "
  read -r GROQ_KEY
  [ -n "$GROQ_KEY" ] || die "empty key, aborting"
  cat > .env <<EOF
GROQ_API_KEY=$GROQ_KEY
GROQ_MODEL=qwen/qwen3-32b
EOF
  ok ".env written"
fi

if [ ! -f data/ai_adoption_eu.csv ]; then
  say "fetching Eurostat datasets (~30s)"
  uv run python scripts/fetch_data.py
fi

say "installing web dependencies"
( cd web && npm install --silent )

printf "\n\033[1;32m✓ setup complete\033[0m — starting services\n\n"

trap 'kill 0 2>/dev/null; exit 0' INT TERM EXIT

( uv run idun agent serve --file --path config.yaml 2>&1 | sed 's/^/\x1b[36m[api]\x1b[0m /' ) &
( cd web && npm run dev 2>&1 | sed 's/^/\x1b[35m[web]\x1b[0m /' ) &

sleep 4
open_browser "http://localhost:3000"

printf "\n\033[1m→ open http://localhost:3000 (ctrl-c to stop)\033[0m\n\n"
wait
