resource "azurerm_storage_account" "this" {
  name                     = local.storage_name
  resource_group_name      = azurerm_resource_group.this.name
  location                 = azurerm_resource_group.this.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  account_kind             = "StorageV2"
}

resource "azurerm_storage_container" "apps_container" {
  name                  = local.app_container_name
  storage_account_id    = azurerm_storage_account.this.id
  container_access_type = "private"
}