module "maintenance" {
  depends_on = [azurerm_cosmosdb_account.this, azurerm_linux_function_app.this]
  count      = var.deploy_maintenance_infrastructure ? 1 : 0
  source     = "./maintenance"
  app_name   = local.resource_name
  region     = local.location
  tags       = var.tags
}
