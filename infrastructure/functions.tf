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
    use_32_bit_worker = false
    application_stack {
      use_dotnet_isolated_runtime = true
      dotnet_version              = "8.0"
    }
    cors  {
      allowed_origins     = [
        "https://${azurerm_static_web_app.this.default_host_name}"
      ]
      support_credentials = false
    }
  }


  app_settings = {
    AesKey                                 = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.aes_encryption_key.id})",
    AesIV                                  = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.aes_encryption_iv.id})",
    CosmosDB                               = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.cosmosdb_connection_string.id})",
    COSMOS_DATABASE_NAME                   = "AccountPasswords"
    COSMOS_COLLECTION_NAME                 = "Passwords"
    COSMOS_PARTITION_KEY                   = "Passwords"
    WEBSITE_USE_PLACEHOLDER_DOTNETISOLATED = 1
    WEBSITE_RUN_FROM_PACKAGE               = "${azurerm_storage_account.this.primary_blob_endpoint}${local.app_container_name}/vault.zip"
    APPLICATIONINSIGHTS_CONNECTION_STRING  = azurerm_application_insights.this.connection_string
    APPINSIGHTS_INSTRUMENTATIONKEY         = azurerm_application_insights.this.instrumentation_key
  }
}

data "azurerm_function_app_host_keys" "host_key" {
  depends_on          = [azurerm_linux_function_app.this]
  name                = local.functions_name
  resource_group_name = azurerm_resource_group.this.name
}
