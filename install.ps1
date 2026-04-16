$ErrorActionPreference = "Stop"

$RepoUrl    = if ($env:REPO_URL)    { $env:REPO_URL }    else { "https://github.com/Idun-Group/imt-lab.git" }
$InstallDir = if ($env:INSTALL_DIR) { $env:INSTALL_DIR } else { Join-Path $env:USERPROFILE "imt-lab" }

function Say  ($msg) { Write-Host "▸ $msg" -ForegroundColor Blue }
function Ok   ($msg) { Write-Host "✓ $msg" -ForegroundColor Green }
function Warn ($msg) { Write-Host "! $msg" -ForegroundColor Yellow }
function Die  ($msg) { Write-Host "✗ $msg" -ForegroundColor Red; exit 1 }

function Need-Cmd ($cmd, $hint) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { Die "missing: $cmd — $hint" }
}

function Refresh-Path {
  $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
              [Environment]::GetEnvironmentVariable("Path", "User")
}

function Winget-Install ($id, $label) {
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Die "winget not available — install $label manually"
  }
  Say "installing $label via winget"
  winget install --id $id --silent --accept-source-agreements --accept-package-agreements | Out-Null
  Refresh-Path
}

function Ensure-Git {
  if (Get-Command git -ErrorAction SilentlyContinue) { return }
  Winget-Install "Git.Git" "git"
  if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Die "git install failed — open a new terminal and retry" }
}

function Ensure-Node {
  if (Get-Command node -ErrorAction SilentlyContinue) {
    $major = [int]((node -v) -replace 'v(\d+).*', '$1')
    if ($major -ge 18) { return }
    Warn "node $major detected, installing LTS"
  }
  Winget-Install "OpenJS.NodeJS.LTS" "Node.js LTS"
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Die "node install failed — open a new terminal and retry" }
}

function Ensure-Uv {
  if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
    Say "installing uv (python toolchain)"
    powershell -c "irm https://astral.sh/uv/install.ps1 | iex" | Out-Null
    $env:Path = "$env:USERPROFILE\.local\bin;$env:Path"
    Refresh-Path
    if (-not (Get-Command uv -ErrorAction SilentlyContinue)) { Die "uv install failed — open a new terminal and retry" }
  }
}

Write-Host ""
Write-Host "🇪🇺  AI Lab — setup" -ForegroundColor White
Write-Host ""

Ensure-Git
Ensure-Node
Need-Cmd npm "comes with Node.js"
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

$groqKey = $env:GROQ_API_KEY
if ([string]::IsNullOrWhiteSpace($groqKey)) {
  Write-Host ""
  Write-Host "GROQ API key — paste it (https://console.groq.com)" -ForegroundColor White
  $groqKey = Read-Host "key"
}
if ([string]::IsNullOrWhiteSpace($groqKey)) { Die "empty key, aborting" }
@"
GROQ_API_KEY=$groqKey
GROQ_MODEL=qwen/qwen3-32b
"@ | Set-Content .env -NoNewline
Ok ".env written"

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
