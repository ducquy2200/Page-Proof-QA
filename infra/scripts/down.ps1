param(
    [switch]$RemoveVolumes
)

$ErrorActionPreference = "Stop"
$infraRoot = Split-Path -Parent $PSScriptRoot
$projectName = "pageproofqa-selfhost"

Push-Location $infraRoot
try {
    $composeArgs = @("--project-name", $projectName, "--env-file", ".env", "-f", "docker-compose.selfhost.yml", "--profile", "tunnel", "down", "--remove-orphans")
    if ($RemoveVolumes) {
        $composeArgs += "--volumes"
    }
    docker compose @composeArgs
}
finally {
    Pop-Location
}
