resource "azurerm_service_plan" "this" {
  name                = local.functions_host_plan_name
  resource_group_name = azurerm_resource_group.this.name
  location            = azurerm_resource_group.this.location
  os_type             = "Linux"
  sku_name            = "Y1"
}

resource "azurerm_user_assigned_identity" "functions_identity" {
  name                = "${local.functions_name}-identity"
  resource_group_name = azurerm_resource_group.this.name
  location            = azurerm_resource_group.this.location

}

resource "azurerm_linux_function_app" "this" {
  name                          = local.functions_name
  resource_group_name           = azurerm_resource_group.this.name
  location                      = azurerm_resource_group.this.location
  service_plan_id               = azurerm_service_plan.this.id
  https_only                    = true
  enabled                       = true
  public_network_access_enabled = true

  identity {
    type = "SystemAssigned, UserAssigned"
    identity_ids = [
      azurerm_user_assigned_identity.functions_identity.id
    ]
  }

  storage_account_name            = azurerm_storage_account.this.name
  storage_uses_managed_identity   = true
  key_vault_reference_identity_id = azurerm_user_assigned_identity.functions_identity.id

  site_config {
    application_stack {
      use_dotnet_isolated_runtime = true
      dotnet_version              = "8.0"
    }
  }

  app_settings = {
    AesKey                 = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.aes_encryption_key.id})",
    AesIV                  = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.aes_encryption_iv.id})",
    COSMOS_ACCOUNT_NAME    = azurerm_cosmosdb_account.this.name
    COSMOS_DATABASE_NAME   = "AccountPasswords"
    COSMOS_COLLECTION_NAME = "Passwords"
    COSMOS_LEASE_NAME      = "leases"
    COSMOS_PARTITION_KEY   = "Passwords"
  }
}

data "azurerm_function_app_host_keys" "host_key" {
  depends_on          = [azurerm_linux_function_app.this]
  name                = local.functions_name
  resource_group_name = azurerm_resource_group.this.name
}