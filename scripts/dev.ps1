$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
$taskLogDir = Join-Path $taskRoot '.artifacts/dev'
if (-not (Test-Path -LiteralPath (Join-Path $taskRoot '.env'))) {
    throw 'Najpierw uruchom ./scripts/setup.ps1.'
}
New-Item -ItemType Directory -Path $taskLogDir -Force | Out-Null
$env:UV_CACHE_DIR = Join-Path $taskRoot '.cache/uv'
$taskUv = (Get-Command uv -ErrorAction Stop).Source
$taskNode = (Get-Command node -ErrorAction Stop).Source
$taskDjangoArgs = @('run', '--project', 'backend', '--locked', '--env-file', '.env',
    '--package', 'cateringhub-orders', 'python', 'backend/services/orders/manage.py')
$taskProcesses = @()
function Start-DevProcess($taskName, $taskExecutable, $taskArguments) {
    $taskOptions = @{
        FilePath = $taskExecutable
        ArgumentList = $taskArguments
        WorkingDirectory = $taskRoot
        WindowStyle = 'Hidden'
        PassThru = $true
        RedirectStandardOutput = (Join-Path $taskLogDir "$taskName.out.log")
        RedirectStandardError = (Join-Path $taskLogDir "$taskName.err.log")
    }
    Start-Process @taskOptions
}
try {
    $taskProcesses += Start-DevProcess 'api' $taskUv ($taskDjangoArgs + @('runserver', '127.0.0.1:8001'))
    $taskProcesses += Start-DevProcess 'publisher' $taskUv ($taskDjangoArgs + @('publish_events'))
    $taskProcesses += Start-DevProcess 'web' $taskNode @(
        'frontend/node_modules/vite/bin/vite.js', 'frontend', '--host', '127.0.0.1',
        '--port', '5173', '--strictPort')
    Write-Output 'CateringHub: http://localhost:5173. Ctrl+C kończy procesy aplikacji.'
    while ($true) {
        foreach ($taskProcess in $taskProcesses) {
            if ($taskProcess.HasExited) { throw "Proces zakończył się. Sprawdź logi w $taskLogDir." }
        }
        Start-Sleep -Seconds 1
    }
} finally {
    foreach ($taskProcess in $taskProcesses) {
        if (-not $taskProcess.HasExited) { $taskProcess.Kill($true) }
    }
}
