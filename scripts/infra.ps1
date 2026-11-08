$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
$taskEnvPath = Join-Path $taskRoot '.env'
if (-not (Test-Path -LiteralPath $taskEnvPath)) {
    $taskContent = Get-Content -LiteralPath (Join-Path $taskRoot '.env.example') -Raw
    $taskContent = [regex]::Replace($taskContent, 'replace-with-(?:a|another)-random-(?:secret|password)', {
        [Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
    })
    [System.IO.File]::WriteAllText($taskEnvPath, $taskContent, [System.Text.UTF8Encoding]::new($false))
    Write-Output 'Utworzono lokalny plik .env.'
}
$taskDocker = Get-Command docker -ErrorAction SilentlyContinue
$taskDockerPath = if ($taskDocker) {
    $taskDocker.Source
} else {
    Join-Path $env:LOCALAPPDATA 'Programs/DockerDesktop/resources/bin/docker.exe'
}
if (-not (Test-Path -LiteralPath $taskDockerPath)) { throw 'Nie znaleziono Docker CLI.' }
$taskPreviousPath = $env:Path
$env:Path = "$(Split-Path $taskDockerPath -Parent);$taskPreviousPath"
Push-Location $taskRoot
try {
    & $taskDockerPath compose up -d --wait
    if ($LASTEXITCODE -ne 0) { throw 'Nie uruchomiono infrastruktury.' }
} finally {
    Pop-Location
    $env:Path = $taskPreviousPath
}
