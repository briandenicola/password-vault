resource "azurerm_key_vault_secret" "aes_encryption_key" {
  name         = "encryption-key"
  value        = var.password_encryption_key
  key_vault_id = azurerm_key_vault.this.id
}

resource "azurerm_key_vault_secret" "aes_encryption_iv" {
  name         = "initialization-vector"
  value        = var.password_encryption_initialization_vector
  key_vault_id = azurerm_key_vault.this.id
}

resource "azurerm_key_vault_secret" "host_key" {
  name         = "host-key"
  value        = data.azurerm_function_app_host_keys.host_key.primary_key
  key_vault_id = azurerm_key_vault.this.id
}

resource "azurerm_key_vault_secret" "cosmosdb_connection_string" {
  name         = "cosmosdb-connection-string"
  value        = azurerm_cosmosdb_account.this.primary_sql_connection_string 
  key_vault_id = azurerm_key_vault.this.id
}