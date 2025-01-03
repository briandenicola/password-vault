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