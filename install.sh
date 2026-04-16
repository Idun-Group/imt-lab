#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/Idun-Group/imt-lab.git}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/imt-lab}"

say()  { printf "\033[1;34m▸\033[0m %s\n" "$*"; }
ok()   { printf "\033[1;32m✓\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m!\033[0m %s\n" "$*"; }
die()  { printf "\033[1;31m✗\033[0m %s\n" "$*" >&2; exit 1; }

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "missing: $1 — $2"
}

os_kind() {
  case "$(uname -s)" in
    Darwin) echo mac ;;
    Linux)  echo linux ;;
    *)      echo other ;;
  esac
}

ensure_git() {
  command -v git >/dev/null 2>&1 && return
  case "$(os_kind)" in
    mac)
      say "installing git (accept the Xcode Command Line Tools popup)"
      xcode-select --install 2>/dev/null || true
      until command -v git >/dev/null 2>&1; do sleep 4; done
      ;;
    linux)
      if command -v apt-get >/dev/null 2>&1; then
        say "installing git via apt"
        sudo apt-get update -qq && sudo apt-get install -y git
      elif command -v dnf >/dev/null 2>&1; then
        say "installing git via dnf"
        sudo dnf install -y git
      elif command -v pacman >/dev/null 2>&1; then
        say "installing git via pacman"
        sudo pacman -S --noconfirm git
      else
        die "no known package manager — install git manually"
      fi
      ;;
    *) die "unsupported OS — install git manually" ;;
  esac
}

ensure_node() {
  if command -v node >/dev/null 2>&1; then
    local major
    major=$(node -v | sed 's/^v\([0-9]*\).*/\1/')
    [ "$major" -ge 18 ] && return
    warn "node $major detected, installing 20 LTS via nvm"
  else
    say "installing node 20 LTS via nvm"
  fi
  if [ ! -s "$HOME/.nvm/nvm.sh" ]; then
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
  fi
  export NVM_DIR="$HOME/.nvm"
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
  nvm install --lts >/dev/null
  nvm use --lts >/dev/null
  command -v node >/dev/null 2>&1 || die "node install failed — open a new terminal and retry"
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

printf "\n\033[1m🇪🇺  AI Lab — setup\033[0m\n\n"

ensure_git
ensure_node
need_cmd npm "comes with Node.js"
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

GROQ_KEY="${GROQ_API_KEY:-}"
if [ -z "$GROQ_KEY" ]; then
  if [ -r /dev/tty ] && [ -w /dev/tty ]; then
    printf "\n\033[1mGROQ API key\033[0m — paste it (https://console.groq.com)\n> " > /dev/tty
    IFS= read -r GROQ_KEY < /dev/tty || true
  else
    cat >&2 <<'EOF'

No interactive terminal detected. Re-run with ONE of:

  # 1. Pass the key inline
  curl -fsSL https://raw.githubusercontent.com/Idun-Group/imt-lab/main/install.sh | GROQ_API_KEY=gsk_xxx bash

  # 2. Or download then run
  curl -fsSL https://raw.githubusercontent.com/Idun-Group/imt-lab/main/install.sh -o install.sh && bash install.sh

EOF
    exit 1
  fi
fi
[ -n "$GROQ_KEY" ] || die "empty key, aborting"
cat > .env <<EOF
GROQ_API_KEY=$GROQ_KEY
GROQ_MODEL=qwen/qwen3-32b
EOF
ok ".env written"

if [ ! -f data/ai_adoption_eu.csv ]; then
  say "fetching Eurostat datasets (~30s)"
  uv run python scripts/fetch_data.py
fi

say "installing web dependencies"
( cd web && npm install --silent )

port_in_use() {
  if command -v lsof >/dev/null 2>&1; then
    lsof -i ":$1" -sTCP:LISTEN >/dev/null 2>&1
  else
    (echo > "/dev/tcp/127.0.0.1/$1") >/dev/null 2>&1
  fi
}

for p in 8001 3000; do
  if port_in_use "$p"; then
    die "port $p is already in use — stop the process first (lsof -i :$p then kill <pid>)"
  fi
done

printf "\n\033[1;32m✓ setup complete\033[0m — starting services\n\n"

trap 'kill 0 2>/dev/null; exit 0' INT TERM EXIT

( uv run idun agent serve --source file --path config.yaml 2>&1 | sed 's/^/\x1b[36m[api]\x1b[0m /' ) &
( cd web && npm run dev 2>&1 | sed 's/^/\x1b[35m[web]\x1b[0m /' ) &

sleep 4
open_browser "http://localhost:3000"

printf "\n\033[1m→ open http://localhost:3000 (ctrl-c to stop)\033[0m\n\n"
wait
