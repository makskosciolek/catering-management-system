$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
$taskListeners = [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners()
if ($taskListeners.Port -contains 5173) {
    throw 'Port 5173 jest zajęty. Zatrzymaj serwer Vite (Ctrl+C w scripts/dev.ps1) przed instalacją frontendu.'
}
& (Join-Path $PSScriptRoot 'infra.ps1')
Push-Location $taskRoot
try {
    $env:UV_CACHE_DIR = Join-Path $taskRoot '.cache/uv'
    uv sync --project backend --all-packages --locked
    if ($LASTEXITCODE -ne 0) { throw 'Instalacja zależności Pythona nie powiodła się.' }
    uv run --project backend --env-file .env --package cateringhub-orders python backend/services/orders/manage.py migrate
    if ($LASTEXITCODE -ne 0) { throw 'Migracje nie powiodły się.' }
    uv run --project backend --env-file .env --package cateringhub-orders python backend/services/orders/manage.py seed_demo
    if ($LASTEXITCODE -ne 0) { throw 'Przygotowanie danych nie powiodło się.' }
    npm.cmd --prefix frontend ci --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'Instalacja frontendu nie powiodła się.' }
} finally { Pop-Location }
