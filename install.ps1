$ErrorActionPreference = "Stop"

$RepoUrl    = if ($env:REPO_URL)    { $env:REPO_URL }    else { "https://github.com/AhmedEnnaifer/imt.git" }
$InstallDir = if ($env:INSTALL_DIR) { $env:INSTALL_DIR } else { Join-Path $env:USERPROFILE "sovereign-ai-lab" }

function Say  ($msg) { Write-Host "▸ $msg" -ForegroundColor Blue }
function Ok   ($msg) { Write-Host "✓ $msg" -ForegroundColor Green }
function Warn ($msg) { Write-Host "! $msg" -ForegroundColor Yellow }
function Die  ($msg) { Write-Host "✗ $msg" -ForegroundColor Red; exit 1 }

function Need-Cmd ($cmd, $hint) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { Die "missing: $cmd — $hint" }
}

function Ensure-Uv {
  if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
    Say "installing uv (python toolchain)"
    powershell -c "irm https://astral.sh/uv/install.ps1 | iex" | Out-Null
    $env:Path = "$env:USERPROFILE\.local\bin;$env:Path"
    if (-not (Get-Command uv -ErrorAction SilentlyContinue)) { Die "uv install failed — open a new terminal and retry" }
  }
}

Write-Host ""
Write-Host "🇪🇺  Sovereign AI Lab — setup" -ForegroundColor White
Write-Host ""

Need-Cmd git  "https://git-scm.com/download/win"
Need-Cmd node "https://nodejs.org"
Need-Cmd npm  "comes with Node.js"
Ensure-Uv

if (-not (Test-Path $InstallDir)) {
  Say "cloning into $InstallDir"
  git clone --depth 1 $RepoUrl $InstallDir | Out-Null
} else {
  Say "updating $InstallDir"
  git -C $InstallDir pull --rebase --autostash 2>$null | Out-Null
}
Set-Location $InstallDir

Say "installing python dependencies (uv)"
uv sync --quiet

if (-not (Test-Path ".env")) {
  Write-Host ""
  Write-Host "GROQ API key — paste it (get one free at https://console.groq.com)" -ForegroundColor White
  $groqKey = Read-Host "key"
  if ([string]::IsNullOrWhiteSpace($groqKey)) { Die "empty key, aborting" }
  @"
GROQ_API_KEY=$groqKey
GROQ_MODEL=qwen/qwen3-32b
"@ | Set-Content .env -NoNewline
  Ok ".env written"
}

if (-not (Test-Path "data\ai_adoption_eu.csv")) {
  Say "fetching Eurostat datasets (~30s)"
  uv run python scripts\fetch_data.py
}

Say "installing web dependencies"
Push-Location web
npm install --silent
Pop-Location

Write-Host ""
Write-Host "✓ setup complete — starting services" -ForegroundColor Green
Write-Host ""

$api = Start-Process -PassThru -NoNewWindow -FilePath "uv" -ArgumentList "run","idun","agent","serve","--file","--path","config.yaml"
$web = Start-Process -PassThru -NoNewWindow -FilePath "npm" -ArgumentList "run","dev" -WorkingDirectory (Join-Path $InstallDir "web")

Start-Sleep -Seconds 4
Start-Process "http://localhost:3000"

Write-Host "→ open http://localhost:3000 (close this window to stop)" -ForegroundColor White

try {
  Wait-Process -Id $api.Id, $web.Id
} finally {
  if (-not $api.HasExited) { Stop-Process -Id $api.Id -Force -ErrorAction SilentlyContinue }
  if (-not $web.HasExited) { Stop-Process -Id $web.Id -Force -ErrorAction SilentlyContinue }
}
