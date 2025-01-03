resource "azurerm_key_vault_secret" "aes_encryption_key" {
  depends_on = [ 
    azurerm_role_assignment.deployer_kv_access
  ]
  name         = "encryption-key"
  value        = var.password_encryption_key
  key_vault_id = azurerm_key_vault.this.id
}

resource "azurerm_key_vault_secret" "aes_encryption_iv" {
  depends_on = [ 
    azurerm_role_assignment.deployer_kv_access
  ]  
  name         = "initialization-vector"
  value        = var.password_encryption_initialization_vector
  key_vault_id = azurerm_key_vault.this.id
}

resource "azurerm_key_vault_secret" "host_key" {
  depends_on = [ 
    azurerm_role_assignment.deployer_kv_access
  ]  
  name         = "host-key"
  value        = data.azurerm_function_app_host_keys.host_key.primary_key
  key_vault_id = azurerm_key_vault.this.id
}

resource "azurerm_key_vault_secret" "cosmosdb_connection_string" {
  depends_on = [ 
    azurerm_role_assignment.deployer_kv_access
  ]  
  name         = "cosmosdb-connection-string"
  value        = azurerm_cosmosdb_account.this.primary_sql_connection_string 
  key_vault_id = azurerm_key_vault.this.id
}

resource "azurerm_key_vault_secret" "appinsights_connection_string" {
  depends_on = [ 
    azurerm_role_assignment.deployer_kv_access
  ]  
  name         = "appinsights-connection-string"
  value        = azurerm_application_insights.this.connection_string 
  key_vault_id = azurerm_key_vault.this.id
}

resource "azurerm_key_vault_secret" "appinsights_key" {
  depends_on = [ 
    azurerm_role_assignment.deployer_kv_access
  ]  
  name         = "appinsights-instrumentation-key"
  value        = azurerm_application_insights.this.instrumentation_key
  key_vault_id = azurerm_key_vault.this.id
}