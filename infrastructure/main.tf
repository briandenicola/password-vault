resource "random_id" "this" {
  byte_length = 2
}

resource "random_pet" "this" {
  length    = 1
  separator = ""
}

locals {
  location                  = var.region
  swa_regions               = ["westus2", "centralus", "eastus2", "westeurope", "eastasia"]
  resource_name             = "${random_pet.this.id}-${random_id.this.dec}"
  static_webapp_name        = "${local.resource_name}-swa"
  storage_name              = "${replace(local.resource_name, "-", "")}sa"
  cosmosdb_name             = "${local.resource_name}-cosmosdb"
  cosmosdb_database_name    = "AccountPasswords"
  cosmosdb_collections_name = "Passwords"
  la_name                   = "${local.resource_name}-logs"
  ai_name                   = "${local.resource_name}-insights"
  functions_host_plan_name  = "${local.resource_name}-linux-hosting"
  functions_name            = "${local.resource_name}-functions"
  kv_name                   = "${replace(local.resource_name, "-", "")}-keyvault"
  authorized_ip_ranges      = "${chomp(data.http.myip.response_body)}/32"
  static_webapp_location    = contains(local.swa_regions, local.location) ? local.location : "centralus"
  tenant_id                 = data.azurerm_client_config.current.tenant_id
  local_host                = "http://localhost"
  app_container_name        = "app"
}

resource "azurerm_resource_group" "this" {
  name     = "${local.resource_name}_rg"
  location = local.location

  tags = {
    Application = var.tags
    Components  = "Azure Static Web Pages; CosmosDB; Azure Functions; Key Vault"
    DeployedOn  = timestamp()
    Deployer    = data.azurerm_client_config.current.object_id
  }
}
