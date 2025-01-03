resource "azurerm_service_plan" "this" {
  name                = local.functions_host_plan_name
  resource_group_name = azurerm_resource_group.this.name
  location            = azurerm_resource_group.this.location
  os_type             = "Linux"
  sku_name            = "Y1"
}

resource "azurerm_linux_function_app" "this" {
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
      python_version = "3.11"
    }
  }
  app_settings = {
    VAULT_HEALTH_URL                      = "https://${var.app_name}-functions.azurewebsites.net/api/passwords/healthz"
    WEBSITE_RUN_FROM_PACKAGE              = "${azurerm_storage_account.this.primary_blob_endpoint}${local.app_container_name}/maintenance.zip"
    APPLICATIONINSIGHTS_CONNECTION_STRING  = "@Microsoft.KeyVault(SecretUri=${data.azurerm_key_vault_secret.appinsights_connection_string.id})"
    APPINSIGHTS_INSTRUMENTATIONKEY         = "@Microsoft.KeyVault(SecretUri=${data.azurerm_key_vault_secret.appinsights_key.id})" 
  }
}
