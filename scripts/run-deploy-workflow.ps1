param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("api", "ui", "maintenance", "all")]
    [string]$Component,
    [string]$Ref,
    [switch]$AllowMain
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if (-not $Ref) {
    $Ref = (& git branch --show-current 2>$null).Trim()
}

if (-not $Ref) {
    throw "Unable to resolve a Git ref. Pass one explicitly, for example: task deploy:$Component -- improvements/security-and-features-backlog"
}

$normalizedRef = $Ref.Trim()
$isMainRef = $normalizedRef -in @("main", "origin/main", "refs/heads/main")
if ($isMainRef -and -not $AllowMain) {
    throw "Ref '$Ref' targets main. Re-run with -AllowMain only when you explicitly intend to deploy production from main."
}

Write-Host "Triggering deploy.yml for component '$Component' at ref '$Ref'."
$args = @("workflow", "run", "deploy.yml", "--ref", $Ref, "-f", "component=$Component")
if ($isMainRef -and $AllowMain) {
    $args += @("-f", "confirm_main=deploy-main")
}

& gh @args
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}
