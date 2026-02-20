param(
    [string]$Service = ""
)

$ErrorActionPreference = "Stop"
$infraRoot = Split-Path -Parent $PSScriptRoot
$projectName = "pageproofqa-selfhost"

Push-Location $infraRoot
try {
    $composeArgs = @("--project-name", $projectName, "--env-file", ".env", "-f", "docker-compose.selfhost.yml", "logs", "-f")
    if ($Service) {
        $composeArgs += $Service
    }
    docker compose @composeArgs
}
finally {
    Pop-Location
}
