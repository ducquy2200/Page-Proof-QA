param(
    [string]$TunnelRef = "",
    [string]$AppDomain = "",
    [string]$ApiDomain = "",
    [switch]$SkipDnsRoute,
    [switch]$StartStack
)

$ErrorActionPreference = "Stop"
$infraRoot = $PSScriptRoot
$envFile = Join-Path $infraRoot ".env"

function Get-EnvFileValue {
    param(
        [string]$Path,
        [string]$Key
    )

    if (!(Test-Path $Path)) {
        return ""
    }

    $line = Get-Content $Path | Where-Object { $_ -match "^\s*$Key=" } | Select-Object -First 1
    if (-not $line) {
        return ""
    }

    return ($line -split "=", 2)[1].Trim()
}

function Resolve-Setting {
    param(
        [string]$ExplicitValue,
        [string]$EnvKey
    )

    if ($ExplicitValue) {
        return $ExplicitValue
    }

    $processValue = [System.Environment]::GetEnvironmentVariable($EnvKey)
    if ($processValue) {
        return $processValue
    }

    return Get-EnvFileValue -Path $envFile -Key $EnvKey
}

$resolvedTunnelRef = $TunnelRef
if (-not $resolvedTunnelRef) {
    $resolvedTunnelRef = Resolve-Setting -ExplicitValue "" -EnvKey "CF_TUNNEL_NAME"
}
if (-not $resolvedTunnelRef) {
    $resolvedTunnelRef = Resolve-Setting -ExplicitValue "" -EnvKey "CF_TUNNEL_ID"
}
if (-not $resolvedTunnelRef) {
    throw "Set -TunnelRef or define CF_TUNNEL_NAME / CF_TUNNEL_ID in infra/.env."
}

$resolvedAppDomain = Resolve-Setting -ExplicitValue $AppDomain -EnvKey "CF_APP_DOMAIN"
$resolvedApiDomain = Resolve-Setting -ExplicitValue $ApiDomain -EnvKey "CF_API_DOMAIN"

if ($StartStack) {
    Write-Host "Starting local infra stack..."
    & (Join-Path $infraRoot "scripts\\up.ps1")
}

if (-not $SkipDnsRoute) {
    if (-not $resolvedAppDomain -or -not $resolvedApiDomain) {
        Write-Warning "CF_APP_DOMAIN / CF_API_DOMAIN not set. Skipping DNS route updates."
    } else {
        Write-Host "Routing domains to tunnel '$resolvedTunnelRef'..."
        try {
            & cloudflared tunnel route dns --overwrite-dns $resolvedTunnelRef $resolvedAppDomain
        } catch {
            Write-Warning "Failed routing $resolvedAppDomain (continuing)."
        }
        try {
            & cloudflared tunnel route dns --overwrite-dns $resolvedTunnelRef $resolvedApiDomain
        } catch {
            Write-Warning "Failed routing $resolvedApiDomain (continuing)."
        }
    }
}

Write-Host "Starting tunnel '$resolvedTunnelRef'..."
& cloudflared tunnel run $resolvedTunnelRef
exit $LASTEXITCODE
