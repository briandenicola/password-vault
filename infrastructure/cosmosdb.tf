resource "azurerm_cosmosdb_account" "this" {
  name                       = local.cosmosdb_name
  location                   = azurerm_resource_group.this.location
  resource_group_name        = azurerm_resource_group.this.name
  offer_type                 = "Standard"
  kind                       = "GlobalDocumentDB"
  free_tier_enabled          = var.enable_cosmosdb_free_tier
  automatic_failover_enabled = true

  identity {
    type         = "SystemAssigned"
  }

  consistency_policy {
    consistency_level = "Session"
  }

  geo_location {
    location          =  azurerm_resource_group.this.location
    failover_priority = 0
  }
}

resource "azurerm_cosmosdb_sql_database" "this" {
  depends_on          = [azurerm_cosmosdb_account.this]
  name                = local.cosmosdb_database_name
  resource_group_name = azurerm_resource_group.this.name
  account_name        = azurerm_cosmosdb_account.this.name
  throughput          = 400
}

resource "azurerm_cosmosdb_sql_container" "this" {
  depends_on          = [
    azurerm_cosmosdb_sql_database.this
  ]
  name                = local.cosmosdb_collections_name
  resource_group_name = azurerm_resource_group.this.name
  account_name        = azurerm_cosmosdb_account.this.name
  database_name       = azurerm_cosmosdb_sql_database.this.name
  partition_key_paths = ["/PartitionKey"]
  throughput          = 400
}