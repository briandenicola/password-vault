data "azurerm_key_vault" "this" {
  name                = local.kv_name
  resource_group_name = local.app_rg_name
}

data "azurerm_key_vault_secret" "appinsights_connection_string" {
  name         = "appinsights-connection-string"
  key_vault_id = data.azurerm_key_vault.this.id
}

data "azurerm_key_vault_secret" "appinsights_key" {
  name         = "appinsights-instrumentation-key"
  key_vault_id = data.azurerm_key_vault.this.id
}
