param(
    [string]$ApiDisplayName,
    [string]$UiDisplayName,
    [string]$LocalRedirectUri = "http://localhost:8080",
    [string[]]$AdditionalRedirectUris = @(),
    [string]$EnvFile,
    [switch]$GrantAdminConsent
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$env:AZURE_CORE_ONLY_SHOW_ERRORS = "true"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$InfrastructureDir = Join-Path $RepoRoot "infrastructure"

if (-not $EnvFile) {
    $EnvFile = Join-Path $InfrastructureDir ".env"
}

function Invoke-JsonCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Command,
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    $output = & $Command @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "$Command $($Arguments -join ' ') failed:`n$output"
    }

    if (-not $output) {
        return $null
    }

    return ($output | Out-String | ConvertFrom-Json)
}

function Invoke-TextCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Command,
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    $output = & $Command @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "$Command $($Arguments -join ' ') failed:`n$output"
    }

    return ($output | Out-String).Trim()
}

function Get-TerraformOutput {
    param([Parameter(Mandatory = $true)][string]$Name)

    Invoke-TextCommand "terraform" @("-chdir=$InfrastructureDir", "output", "-raw", $Name)
}

function Get-AppRegistration {
    param([Parameter(Mandatory = $true)][string]$DisplayName)

    $apps = Invoke-JsonCommand "az" @("ad", "app", "list", "--display-name", $DisplayName, "-o", "json")
    @($apps) | Where-Object { $_.displayName -eq $DisplayName } | Select-Object -First 1
}

function Get-ObjectProperty {
    param(
        $Object,
        [Parameter(Mandatory = $true)][string]$Name
    )

    if ($null -eq $Object) {
        return $null
    }

    if ($Object -is [System.Collections.IDictionary]) {
        if ($Object.Contains($Name)) {
            return $Object[$Name]
        }

        return $null
    }

    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property) {
        return $null
    }

    $property.Value
}

function Ensure-AppRegistration {
    param([Parameter(Mandatory = $true)][string]$DisplayName)

    $app = Get-AppRegistration $DisplayName
    if ($app) {
        Write-Host "Using existing app registration: $DisplayName ($($app.appId))"
        return $app
    }

    Write-Host "Creating app registration: $DisplayName"
    Invoke-JsonCommand "az" @(
        "ad", "app", "create",
        "--display-name", $DisplayName,
        "--sign-in-audience", "AzureADMyOrg",
        "-o", "json"
    )
}

function Ensure-ServicePrincipal {
    param([Parameter(Mandatory = $true)][string]$AppId)

    $sp = Invoke-JsonCommand "az" @("ad", "sp", "list", "--filter", "appId eq '$AppId'", "-o", "json")
    if (@($sp).Count -gt 0) {
        return
    }

    Write-Host "Creating service principal for app id: $AppId"
    $null = Invoke-JsonCommand "az" @("ad", "sp", "create", "--id", $AppId, "-o", "json")
}

function New-Scope {
    param(
        [Parameter(Mandatory = $true)][string]$Value,
        [Parameter(Mandatory = $true)][string]$DisplayName,
        [Parameter(Mandatory = $true)][string]$Description,
        [string]$ExistingId
    )

    $scopeId = $ExistingId
    if (-not $scopeId) {
        $scopeId = [guid]::NewGuid().ToString()
    }

    [ordered]@{
        adminConsentDescription = $Description
        adminConsentDisplayName = $DisplayName
        id                      = $scopeId
        isEnabled               = $true
        type                    = "User"
        userConsentDescription  = $Description
        userConsentDisplayName  = $DisplayName
        value                   = $Value
    }
}

function Merge-ApiScopes {
    param($ExistingScopes)

    $existingByValue = @{}
    foreach ($scope in @($ExistingScopes)) {
        $value = Get-ObjectProperty $scope "value"
        if ($value) {
            $existingByValue[$value] = $scope
        }
    }

    $passwordAllScope = Get-ObjectProperty $existingByValue["Password.All"] "id"
    $passwordHistoryScope = Get-ObjectProperty $existingByValue["PasswordHistory.Read"] "id"
    $required = @(
        New-Scope "Password.All" "Access Password Vault" "Read and write Password Vault data." $passwordAllScope
        New-Scope "PasswordHistory.Read" "Read Password Vault history" "Read Password Vault password history." $passwordHistoryScope
    )

    $otherScopes = @($ExistingScopes) | Where-Object {
        $value = Get-ObjectProperty $_ "value"
        $value -and $value -notin @("Password.All", "PasswordHistory.Read")
    }

    @($otherScopes) + $required
}

function Merge-AppRoles {
    param($ExistingRoles)

    $defaultRole = @($ExistingRoles) | Where-Object { (Get-ObjectProperty $_ "value") -eq "Default.Access" } | Select-Object -First 1
    $existingRoleId = Get-ObjectProperty $defaultRole "id"
    $defaultRoleId = if ($existingRoleId) { $existingRoleId } else { [guid]::NewGuid().ToString() }
    $otherRoles = @($ExistingRoles) | Where-Object {
        $value = Get-ObjectProperty $_ "value"
        $value -and $value -ne "Default.Access"
    }

    @($otherRoles) + [ordered]@{
        allowedMemberTypes = @("User", "Application")
        description        = "Default access to Password Vault."
        displayName        = "Default Access"
        id                 = $defaultRoleId
        isEnabled          = $true
        value              = "Default.Access"
    }
}

function Convert-ResourceAccess {
    param($ResourceAccess)

    @($ResourceAccess) | ForEach-Object {
        [ordered]@{
            id   = Get-ObjectProperty $_ "id"
            type = Get-ObjectProperty $_ "type"
        }
    }
}

function Merge-RequiredResourceAccess {
    param(
        $ExistingRequiredResourceAccess,
        [Parameter(Mandatory = $true)][string]$ApiAppId,
        [Parameter(Mandatory = $true)][string]$PasswordAllScopeId
    )

    $resources = @($ExistingRequiredResourceAccess) |
        Where-Object {
            $resourceAppId = Get-ObjectProperty $_ "resourceAppId"
            $resourceAppId -and $resourceAppId -ne $ApiAppId
        } |
        ForEach-Object {
            [ordered]@{
                resourceAppId  = Get-ObjectProperty $_ "resourceAppId"
                resourceAccess = @(Convert-ResourceAccess (Get-ObjectProperty $_ "resourceAccess"))
            }
        }
    $apiResource = [ordered]@{
        resourceAppId  = $ApiAppId
        resourceAccess = @(
            [ordered]@{
                id   = $PasswordAllScopeId
                type = "Scope"
            }
        )
    }

    @($resources) + $apiResource
}

function Update-GraphApplication {
    param(
        [Parameter(Mandatory = $true)][string]$ObjectId,
        [Parameter(Mandatory = $true)][hashtable]$Body
    )

    $tempFile = New-TemporaryFile
    try {
        ConvertTo-Json -InputObject $Body -Depth 20 | Set-Content -Path $tempFile -Encoding utf8
        $null = Invoke-TextCommand "az" @(
            "rest",
            "--method", "PATCH",
            "--uri", "https://graph.microsoft.com/v1.0/applications/$ObjectId",
            "--headers", "Content-Type=application/json",
            "--body", "@$tempFile"
        )
    }
    finally {
        Remove-Item -Path $tempFile -Force -ErrorAction SilentlyContinue
    }
}

function Set-EnvValues {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][hashtable]$Values
    )

    $lines = @()
    if (Test-Path $Path) {
        $lines = @(Get-Content -Path $Path)
    }
    else {
        $parent = Split-Path -Parent $Path
        if ($parent -and -not (Test-Path $parent)) {
            New-Item -ItemType Directory -Path $parent | Out-Null
        }
    }

    foreach ($key in $Values.Keys) {
        $escapedValue = [string]$Values[$key]
        $replacement = "$key=$escapedValue"
        $found = $false

        for ($i = 0; $i -lt $lines.Count; $i++) {
            if ($lines[$i] -match "^\s*$([regex]::Escape($key))=") {
                $lines[$i] = $replacement
                $found = $true
                break
            }
        }

        if (-not $found) {
            $lines += $replacement
        }
    }

    Set-Content -Path $Path -Value $lines -Encoding utf8
}

$account = Invoke-JsonCommand "az" @("account", "show", "-o", "json")
$tenantId = $account.tenantId
$appName = Get-TerraformOutput "APP_NAME"
$functionUrl = (Get-TerraformOutput "FUNCTION_URL").TrimEnd("/")
$swaDefaultUrl = (Get-TerraformOutput "SWA_DEFAULT_URL").TrimEnd("/")

if (-not $ApiDisplayName) {
    $ApiDisplayName = "$appName-api"
}

if (-not $UiDisplayName) {
    $UiDisplayName = "$appName-ui"
}

$apiCallbackUrl = "$functionUrl/.auth/login/aad/callback"
$scopeValue = "Password.All"
$scopeUri = "$functionUrl/$scopeValue"
$redirectUris = @($LocalRedirectUri, $swaDefaultUrl) + $AdditionalRedirectUris
$redirectUris = @($redirectUris | Where-Object { $_ } | ForEach-Object { $_.TrimEnd("/") } | Select-Object -Unique)

$apiApp = Ensure-AppRegistration $ApiDisplayName
$uiApp = Ensure-AppRegistration $UiDisplayName

Ensure-ServicePrincipal $apiApp.appId
Ensure-ServicePrincipal $uiApp.appId

$apiConfig = Get-ObjectProperty $apiApp "api"
$apiScopes = Merge-ApiScopes (Get-ObjectProperty $apiConfig "oauth2PermissionScopes")
$apiRoles = Merge-AppRoles (Get-ObjectProperty $apiApp "appRoles")

Write-Host "Configuring API app registration: $ApiDisplayName"
Update-GraphApplication $apiApp.id @{
    identifierUris = @($functionUrl)
    web            = @{
        redirectUris = @($apiCallbackUrl)
    }
    api            = @{
        requestedAccessTokenVersion = 2
        oauth2PermissionScopes      = @($apiScopes)
    }
    appRoles       = @($apiRoles)
}

$passwordAllScope = @($apiScopes) | Where-Object { (Get-ObjectProperty $_ "value") -eq $scopeValue } | Select-Object -First 1
$passwordAllScopeId = Get-ObjectProperty $passwordAllScope "id"
if (-not $passwordAllScopeId) {
    throw "Unable to resolve the $scopeValue scope id for the API app registration."
}
$apiAudience = "$functionUrl,$($apiApp.appId)"
$requiredResourceAccess = Merge-RequiredResourceAccess (Get-ObjectProperty $uiApp "requiredResourceAccess") $apiApp.appId $passwordAllScopeId

Write-Host "Configuring UI app registration: $UiDisplayName"
Update-GraphApplication $uiApp.id @{
    spa                    = @{
        redirectUris = $redirectUris
    }
    requiredResourceAccess = @($requiredResourceAccess)
}

if ($GrantAdminConsent) {
    Write-Host "Granting admin consent for the UI app registration"
    $null = Invoke-TextCommand "az" @("ad", "app", "permission", "admin-consent", "--id", $uiApp.appId)
}
else {
    Write-Host "Skipping admin consent. Re-run with -GrantAdminConsent if your account can approve tenant-wide consent."
}

Set-EnvValues $EnvFile @{
    AAD_CLIENT_ID        = $uiApp.appId
    AAD_TENANT_ID        = $tenantId
    AAD_AUDIENCE         = $apiAudience
    AAD_SCOPE            = $scopeUri
    VUE_APP_AAD_CLIENT_ID = $uiApp.appId
    VUE_APP_AAD_TENANT_ID = $tenantId
    VUE_APP_AAD_SCOPE    = $scopeUri
    TF_VAR_aad_tenant_id = $tenantId
    TF_VAR_aad_audience  = $apiAudience
}

Write-Host ""
Write-Host "Entra configuration complete."
Write-Host "API app registration: $ApiDisplayName ($($apiApp.appId))"
Write-Host "UI app registration:  $UiDisplayName ($($uiApp.appId))"
Write-Host "Tenant ID:            $tenantId"
Write-Host "API audience:         $apiAudience"
Write-Host "SPA scope:            $scopeUri"
Write-Host "Redirect URIs:        $($redirectUris -join ', ')"
Write-Host "Updated env file:     $EnvFile"
Write-Host ""
Write-Host "Run 'task apply' again so Terraform writes AAD_TENANT_ID/AAD_AUDIENCE to the Function App."
