module "maintenance" {
  depends_on                  = [azurerm_cosmosdb_account.this, azurerm_function_app_flex_consumption.this]
  count                       = var.deploy_maintenance_infrastructure ? 1 : 0
  source                      = "./maintenance"
  app_name                    = local.resource_name
  region                      = local.location
  app_requires_authentication = var.app_requires_authentication
  tags                        = var.tags
}
