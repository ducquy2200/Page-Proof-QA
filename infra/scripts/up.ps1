param(
    [switch]$Tunnel
)

$ErrorActionPreference = "Stop"
$infraRoot = Split-Path -Parent $PSScriptRoot
$projectName = "pageproofqa-selfhost"

Push-Location $infraRoot
try {
    $composeArgs = @("--project-name", $projectName, "--env-file", ".env", "-f", "docker-compose.selfhost.yml")
    if ($Tunnel) {
        $composeArgs += @("--profile", "tunnel")
    }
    $composeArgs += @("up", "-d", "--build", "--force-recreate", "--remove-orphans")
    docker compose @composeArgs
}
finally {
    Pop-Location
}
