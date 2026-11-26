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
    foreach ($taskService in @('orders', 'inventory', 'fulfillment')) {
        $taskCommands = if ($taskService -eq 'fulfillment') { @('migrate') } else { @('migrate', 'seed_demo') }
        foreach ($taskCommand in $taskCommands) {
            uv run --project backend --locked --no-sync --env-file .env --package "cateringhub-$taskService" python "backend/services/$taskService/manage.py" $taskCommand
            if ($LASTEXITCODE -ne 0) { throw "Polecenie $taskCommand nie powiodło się ($taskService)." }
        }
    }
    npm.cmd --prefix frontend ci --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'Instalacja frontendu nie powiodła się.' }
} finally { Pop-Location }
