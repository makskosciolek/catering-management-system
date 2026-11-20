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
    if (-not $env:RABBITMQ_NODE_HOSTNAME -and -not (Select-String -LiteralPath $taskEnvPath -Pattern '^\s*RABBITMQ_NODE_HOSTNAME\s*=\s*[^#\s]')) {
        $taskContainer = & $taskDockerPath compose ps -a -q rabbitmq
        if ($LASTEXITCODE -ne 0) { throw 'Nie udało się sprawdzić kontenera RabbitMQ.' }
        $taskHostName = if ($taskContainer) {
            & $taskDockerPath inspect --format '{{.Config.Hostname}}' $taskContainer
            if ($LASTEXITCODE -ne 0) { throw 'Nie udało się odczytać nazwy kontenera RabbitMQ.' }
        } else {
            $taskConfig = (& $taskDockerPath compose config --format json) | ConvertFrom-Json
            if ($LASTEXITCODE -ne 0) { throw 'Nie udało się odczytać konfiguracji Compose.' }
            $taskVolume = $taskConfig.volumes.rabbitmq_data.name
            $null = & $taskDockerPath volume inspect $taskVolume 2>$null
            if ($LASTEXITCODE -eq 0) {
                $taskNames = @(& $taskDockerPath run --rm --network none --entrypoint /bin/sh `
                    --mount "type=volume,source=$taskVolume,target=/saved,readonly" `
                    $taskConfig.services.rabbitmq.image -c 'for d in /saved/mnesia/rabbit@*; do [ -d "$d" ] || continue; case "$d" in *-plugins-expand) continue ;; esac; printf "%s\n" "${d##*@}"; done')
                if ($LASTEXITCODE -ne 0 -or $taskNames.Count -gt 1) {
                    throw 'Nie można ustalić nazwy węzła ze starego wolumenu. Ustaw RABBITMQ_NODE_HOSTNAME w .env zgodnie z dokumentacją.'
                }
                $taskNames | Select-Object -First 1
            }
        }
        if ($taskHostName -and $taskHostName -cne 'rabbitmq') {
            if ($taskHostName -notmatch '^[A-Za-z0-9][A-Za-z0-9.-]*$') {
                throw 'Odczytana nazwa węzła RabbitMQ ma nieprawidłowy format.'
            }
            Add-Content -LiteralPath $taskEnvPath -Value "`nRABBITMQ_NODE_HOSTNAME=$taskHostName" -Encoding utf8
            Write-Output "Zachowano nazwę istniejącego węzła RabbitMQ: $taskHostName."
        }
    }
    & $taskDockerPath compose up -d --wait
    if ($LASTEXITCODE -ne 0) { throw 'Nie uruchomiono infrastruktury.' }
} finally {
    Pop-Location
    $env:Path = $taskPreviousPath
}
