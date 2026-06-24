data "azurerm_client_config" "current" {}
data "azurerm_subscription" "current" {}

resource "random_uuid" "cosmos_data_contributor_system" {}
resource "random_uuid" "cosmos_data_contributor_user" {}
