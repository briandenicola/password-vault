param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("api", "ui", "maintenance", "all")]
    [string]$Component,
    [string]$Ref
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if (-not $Ref) {
    $Ref = (& git branch --show-current 2>$null).Trim()
}

if (-not $Ref) {
    throw "Unable to resolve a Git ref. Pass one explicitly, for example: task deploy:$Component -- improvements/security-and-features-backlog"
}

Write-Host "Triggering deploy.yml for component '$Component' at ref '$Ref'."
& gh workflow run deploy.yml --ref $Ref -f "component=$Component"
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}
