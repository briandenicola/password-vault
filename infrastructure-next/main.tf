resource "random_id" "this" {
  byte_length = 3
}

locals {
  location                  = var.region
  stack_slug                = "vault-next"
  name_suffix               = random_id.this.hex
  resource_name             = "${local.stack_slug}-${local.name_suffix}"
  static_webapp_name        = "${local.resource_name}-swa"
  storage_name              = "vaultnext${local.name_suffix}sa"
  cosmosdb_name             = "${local.resource_name}-cosmosdb"
  cosmosdb_database_name    = "AccountPasswords"
  cosmosdb_collections_name = "Passwords"
  cosmosdb_vaultkeys_name   = "VaultKeys"
  la_name                   = "${local.resource_name}-logs"
  ai_name                   = "${local.resource_name}-insights"
  functions_host_plan_name  = "${local.resource_name}-linux-hosting"
  functions_name            = "${local.resource_name}-functions"
  kv_name                   = "vaultnext${local.name_suffix}-kv"
  swa_regions               = ["westus2", "centralus", "eastus2", "westeurope", "eastasia"]
  static_webapp_location    = contains(local.swa_regions, local.location) ? local.location : "centralus"
  app_container_name        = "app"
}
