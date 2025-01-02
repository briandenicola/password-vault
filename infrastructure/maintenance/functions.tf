resource "azurerm_service_plan" "this" {
  name                = local.functions_host_plan_name
  resource_group_name = azurerm_resource_group.this.name
  location            = azurerm_resource_group.this.location
  os_type             = "Linux"
  sku_name            = "Y1"
}

resource "azurerm_linux_function_app" "this" {
  depends_on = [
    azurerm_role_assignment.storage_account_blob_owner,
    azurerm_role_assignment.storage_account_contributor
  ]
  name                          = local.functions_name
  resource_group_name           = azurerm_resource_group.this.name
  location                      = azurerm_resource_group.this.location
  service_plan_id               = azurerm_service_plan.this.id
  https_only                    = true
  enabled                       = true
  public_network_access_enabled = true

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.functions_identity.id]
  }

  storage_account_name            = azurerm_storage_account.this.name
  storage_uses_managed_identity   = true
  key_vault_reference_identity_id = azurerm_user_assigned_identity.functions_identity.id

  site_config {}
  app_settings = {
    # az functionapp config appsettings set -g ${RG} -n ${functionAppName} --settings cosmosdb="@Microsoft.KeyVault(SecretUri=${primaryConnectionStringSecretId})"
    # az functionapp config appsettings set -g ${RG} -n ${functionAppName} --settings AesKey="@Microsoft.KeyVault(SecretUri=${aesKeySecretId})"
    # az functionapp config appsettings set -g ${RG} -n ${functionAppName} --settings AesIV=$aesIV
    # az functionapp config appsettings set -g ${RG} -n ${functionAppName} --settings COSMOS_DATABASE_NAME="AccountPasswords"
    # az functionapp config appsettings set -g ${RG} -n ${functionAppName} --settings COSMOS_COLLECTION_NAME="Passwords"
    # az functionapp config appsettings set -g ${RG} -n ${functionAppName} --settings COSMOS_LEASENAME="leases"
    # az functionapp config appsettings set -g ${RG} -n ${functionAppName} --settings COSMOS_PARTITION_KEY="Passwords"
  }
}
