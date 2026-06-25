param(
    [string]$Repo
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$RepoRoot = Split-Path -Parent $PSScriptRoot
$InfrastructureDir = Join-Path $RepoRoot "infrastructure"

function Invoke-TextCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Command,
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments,
        [switch]$AllowFailure
    )

    $output = & $Command @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        if ($AllowFailure) {
            return $null
        }

        throw "$Command $($Arguments -join ' ') failed:`n$output"
    }

    return ($output | Out-String).Trim()
}

function Get-TerraformOutput {
    param([Parameter(Mandatory = $true)][string]$Name)

    $value = Invoke-TextCommand "terraform" @("-chdir=$InfrastructureDir", "output", "-raw", $Name) -AllowFailure
    if ($value -eq "null") {
        return $null
    }

    $value
}

function Get-EnvValue {
    param([Parameter(Mandatory = $true)][string[]]$Names)

    foreach ($name in $Names) {
        $value = [Environment]::GetEnvironmentVariable($name)
        if ($value) {
            return $value
        }
    }

    return $null
}

function Get-GhRepoArgs {
    if ($Repo) {
        return @("--repo", $Repo)
    }

    return @()
}

function Set-GhVariable {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [string]$Value
    )

    if (-not $Value) {
        Write-Warning "Skipping GitHub variable $Name because the value is empty."
        return
    }

    $args = @("variable", "set", $Name, "--body", $Value) + (Get-GhRepoArgs)
    $null = Invoke-TextCommand "gh" $args
    Write-Host "Set GitHub variable $Name"
}

function Set-GhSecret {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [string]$Value
    )

    if (-not $Value) {
        Write-Warning "Skipping GitHub secret $Name because the value is empty."
        return
    }

    $args = @("secret", "set", $Name, "--body", $Value) + (Get-GhRepoArgs)
    $null = Invoke-TextCommand "gh" $args
    Write-Host "Set GitHub secret $Name"
}

$accountJson = Invoke-TextCommand "az" @("account", "show", "-o", "json")
$account = $accountJson | ConvertFrom-Json
$azureClientId = Get-EnvValue @("AZURE_CLIENT_ID", "ARM_CLIENT_ID")
$azureTenantId = Get-EnvValue @("AZURE_TENANT_ID", "ARM_TENANT_ID")
$azureSubscriptionId = Get-EnvValue @("AZURE_SUBSCRIPTION_ID", "ARM_SUBSCRIPTION_ID")

if (-not $azureTenantId) {
    $azureTenantId = $account.tenantId
}

if (-not $azureSubscriptionId) {
    $azureSubscriptionId = $account.id
}

Set-GhVariable "FUNCTION_NAME" (Get-TerraformOutput "FUNCTION_NAME")
Set-GhVariable "FUNCTION_URL" (Get-TerraformOutput "FUNCTION_URL")
Set-GhVariable "SWA_NAME" (Get-TerraformOutput "SWA_NAME")
Set-GhVariable "SWA_DEFAULT_URL" (Get-TerraformOutput "SWA_DEFAULT_URL")
Set-GhVariable "MAINTENANCE_FUNCTION_NAME" (Get-TerraformOutput "MAINTENANCE_FUNCTION_NAME")

Set-GhSecret "APP_INSIGHTS_CONNECTION_STRING" (Get-TerraformOutput "APP_INSIGHTS_CONNECTION_STRING")
Set-GhSecret "AAD_CLIENT_ID" (Get-EnvValue @("AAD_CLIENT_ID", "VUE_APP_AAD_CLIENT_ID"))
Set-GhSecret "AZURE_CLIENT_ID" $azureClientId
Set-GhSecret "AZURE_TENANT_ID" $azureTenantId
Set-GhSecret "AZURE_SUBSCRIPTION_ID" $azureSubscriptionId
Set-GhSecret "TF_ENCRYPTION_KEY" (Get-EnvValue @("TF_ENCRYPTION_KEY", "TF_VAR_password_encryption_key", "ENCRYPTION_KEY"))
Set-GhSecret "TF_ENCRYPTION_IV" (Get-EnvValue @("TF_ENCRYPTION_IV", "TF_VAR_password_encryption_initialization_vector", "ENCRYPTION_IV"))

Write-Host ""
Write-Host "GitHub Actions configuration complete."
Write-Host "Variables come from Terraform outputs; secrets come from Terraform outputs, Azure CLI account context, and loaded environment values."
if (-not $azureClientId) {
    Write-Warning "AZURE_CLIENT_ID was not set. Add the OIDC app/managed identity client id manually or rerun with AZURE_CLIENT_ID/ARM_CLIENT_ID set."
}
