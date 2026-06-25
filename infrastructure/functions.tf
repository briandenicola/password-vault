resource "azurerm_service_plan" "this" {
  name                = local.functions_host_plan_name
  resource_group_name = azurerm_resource_group.this.name
  location            = azurerm_resource_group.this.location
  os_type             = "Linux"
  sku_name            = "FC1"
}

resource "azurerm_user_assigned_identity" "functions_identity" {
  name                = "${local.functions_name}-identity"
  resource_group_name = azurerm_resource_group.this.name
  location            = azurerm_resource_group.this.location

}

resource "azurerm_function_app_flex_consumption" "this" {
  lifecycle {
    ignore_changes = [
      tags
    ]
  }
  name                          = local.functions_name
  resource_group_name           = azurerm_resource_group.this.name
  location                      = azurerm_resource_group.this.location
  service_plan_id               = azurerm_service_plan.this.id
  https_only                    = true
  enabled                       = true
  public_network_access_enabled = true
  runtime_name                  = "dotnet-isolated"
  runtime_version               = "10.0"
  maximum_instance_count        = 50
  instance_memory_in_mb         = 2048

  storage_container_type      = "blobContainer"
  storage_container_endpoint  = "${azurerm_storage_account.this.primary_blob_endpoint}${azurerm_storage_container.apps_container.name}"
  storage_authentication_type = "StorageAccountConnectionString"
  storage_access_key          = azurerm_storage_account.this.primary_access_key

  identity {
    type = "SystemAssigned, UserAssigned"
    identity_ids = [
      azurerm_user_assigned_identity.functions_identity.id
    ]
  }

  site_config {
    use_32_bit_worker = false
  }

  app_settings = {
    AesKey                                = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.aes_encryption_key.id})",
    AesIV                                 = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.aes_encryption_iv.id})",
    CosmosDB                              = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.cosmosdb_connection_string.id})",
    COSMOS_DATABASE_NAME                  = "AccountPasswords"
    COSMOS_COLLECTION_NAME                = "Passwords"
    COSMOS_PARTITION_KEY                  = "Passwords"
    COSMOS_KEY_COLLECTION_NAME            = local.cosmosdb_vaultkeys_name
    COSMOS_KEY_PARTITION_KEY              = "VaultKeys"
    E2EE_ENABLED                          = var.app_e2ee_enabled ? "true" : "false"
    AUTH_ENABLED                          = var.app_requires_authentication ? "true" : "false"
    AAD_TENANT_ID                         = var.aad_tenant_id
    AAD_AUDIENCE                          = var.aad_audience
    AAD_ALLOWED_OIDS                      = var.aad_allowed_oids
    BACKUP_STORAGE_ACCOUNT_NAME           = azurerm_storage_account.this.name
    BACKUP_STORAGE_CONTAINER_NAME         = azurerm_storage_container.vault_backups.name
    BACKUP_TIMER_SCHEDULE                 = "0 */15 * * * *"
    APPLICATIONINSIGHTS_CONNECTION_STRING = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.appinsights_connection_string.id})"
    APPINSIGHTS_INSTRUMENTATIONKEY        = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.appinsights_key.id})"
  }
}
