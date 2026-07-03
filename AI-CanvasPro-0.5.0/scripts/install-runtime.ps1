param(
  [int]$Port = 8777,
  [string]$HostName = "127.0.0.1"
)

$ErrorActionPreference = "Stop"
$pluginRoot = Split-Path -Parent $PSScriptRoot
$runtimeRoot = Join-Path $pluginRoot "runtime"
$venvRoot = Join-Path $runtimeRoot ".venv"
$python = Join-Path $venvRoot "Scripts\python.exe"

if (-not (Test-Path -LiteralPath (Join-Path $runtimeRoot "server.py"))) {
  throw "runtime/server.py not found under $pluginRoot"
}

Push-Location $runtimeRoot
try {
  if (-not (Test-Path -LiteralPath $python)) {
    python -m venv .venv
  }

  & $python -m pip install --upgrade pip
  & $python -m pip install -r requirements.txt
  & $python -m py_compile server.py

  Write-Host "AI-CanvasPro runtime dependencies installed."
  Write-Host "Runtime: $runtimeRoot"
  Write-Host "Python:  $python"
  Write-Host "Use /aicanvas in OpenChamber to start http://$HostName`:$Port/"
}
finally {
  Pop-Location
}
