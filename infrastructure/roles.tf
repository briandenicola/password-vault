resource "azurerm_role_assignment" "deployer_kv_access" {
  scope                = azurerm_key_vault.this.id
  role_definition_name = "Key Vault Administrator"
  principal_id         = data.azurerm_client_config.current.object_id
}

resource "azurerm_role_assignment" "storage_account_contributor" {
  scope                            = azurerm_storage_account.this.id
  role_definition_name             = "Storage Account Contributor"
  principal_id                     = azurerm_linux_function_app.this.identity[0].principal_id
  skip_service_principal_aad_check = true
}

resource "azurerm_role_assignment" "storage_account_blob_owner" {
  scope                            = azurerm_storage_account.this.id
  role_definition_name             = "Storage Blob Data Owner"
  principal_id                     = azurerm_linux_function_app.this.identity[0].principal_id
  skip_service_principal_aad_check = true
}

resource "azurerm_role_assignment" "key_vault_secrets_user" {
  scope                            = azurerm_key_vault.this.id
  role_definition_name             = "Key Vault Secrets User"
  principal_id                     = azurerm_user_assigned_identity.functions_identity.principal_id
  skip_service_principal_aad_check = true
}

resource "azurerm_role_assignment" "key_vault_secrets_user_system" {
  scope                            = azurerm_key_vault.this.id
  role_definition_name             = "Key Vault Secrets User"
  principal_id                     = azurerm_linux_function_app.this.identity[0].principal_id
  skip_service_principal_aad_check = true
}

# resource "azurerm_role_assignment" "cosmosdb_account_reader" {
#   scope                = azurerm_cosmosdb_account.this.id
#   role_definition_name = "Cosmos DB Account Reader Role"
#   principal_id         = azurerm_linux_function_app.this.identity[0].principal_id
# }

# resource "azurerm_cosmosdb_sql_role_assignment" "cosmosdb_data_user" {
#   depends_on          = [azurerm_linux_function_app.this, azurerm_cosmosdb_account.this]
#   name                = random_uuid.guid.result
#   resource_group_name = azurerm_resource_group.this.name
#   account_name        = azurerm_cosmosdb_account.this.name
#   role_definition_id  = "${azurerm_cosmosdb_account.this.id}/sqlRoleDefinitions/00000000-0000-0000-0000-000000000002"
#   principal_id        = azurerm_linux_function_app.this.identity[0].principal_id
#   scope               = azurerm_cosmosdb_account.this.id
# }