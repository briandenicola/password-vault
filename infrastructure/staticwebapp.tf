resource "azurerm_static_web_app" "this" {
  name                = local.static_webapp_name
  resource_group_name = azurerm_resource_group.this.name
  location            = local.static_webapp_location
  sku_size            = "Free"
  sku_tier            = "Free"

}
