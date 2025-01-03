data "azurerm_application_insights" "this" {
  name                          = local.ai_name
  resource_group_name           = local.app_rg_name
}
