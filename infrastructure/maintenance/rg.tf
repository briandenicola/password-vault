resource "azurerm_resource_group" "this" {
  name     = "${local.resource_name}_maintenance_functions_rg"
  location = local.location

  tags = {
    Application = var.tags
    Components  = "Azure Functions"
    Details     = "Maintenance Resource Group for ${local.resource_name} application"
    DeployedOn  = timestamp()
    Deployer    = data.azurerm_client_config.current.object_id
  }
}