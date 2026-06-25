resource "azurerm_service_plan" "this" {
  name                = local.functions_host_plan_name
  resource_group_name = azurerm_resource_group.this.name
  location            = azurerm_resource_group.this.location
  os_type             = "Linux"
  sku_name            = "FC1"
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
  runtime_name                  = "python"
  runtime_version               = "3.11"
  maximum_instance_count        = 10
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
    VAULT_HEALTH_URL                      = "https://${var.app_name}-functions.azurewebsites.net/api/passwords/healthz"
    VAULT_API_AUTH_ENABLED                = var.app_requires_authentication
    VAULT_APP_ID_URL                      = "https://${var.app_name}-functions.azurewebsites.net (PLACEHOLDER)"
    APPLICATIONINSIGHTS_CONNECTION_STRING = "@Microsoft.KeyVault(SecretUri=${data.azurerm_key_vault_secret.appinsights_connection_string.id})"
    APPINSIGHTS_INSTRUMENTATIONKEY        = "@Microsoft.KeyVault(SecretUri=${data.azurerm_key_vault_secret.appinsights_key.id})"
  }
}
