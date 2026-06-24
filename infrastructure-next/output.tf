output "APP_NAME" {
  value     = local.resource_name
  sensitive = false
}

output "APP_RESOURCE_GROUP" {
  value     = azurerm_resource_group.this.name
  sensitive = false
}

output "SWA_NAME" {
  value     = azurerm_static_web_app.this.name
  sensitive = false
}

output "SWA_DEFAULT_URL" {
  value     = "https://${azurerm_static_web_app.this.default_host_name}"
  sensitive = false
}

output "SWA_CUSTOM_DOMAIN" {
  value     = var.production_ui_url
  sensitive = false
}

output "WEBAUTHN_RP_ID" {
  value     = var.webauthn_rp_id
  sensitive = false
}

output "STORAGE_ACCOUNT_NAME" {
  value     = azurerm_storage_account.this.name
  sensitive = false
}

output "FUNCTION_NAME" {
  value     = azurerm_linux_function_app.this.name
  sensitive = false
}

output "FUNCTION_URL" {
  value     = "https://${azurerm_linux_function_app.this.default_hostname}"
  sensitive = false
}

output "AZURE_FUNCTION_HOST_KEY" {
  value     = data.azurerm_function_app_host_keys.host_key.primary_key
  sensitive = true
}

output "APP_INSIGHTS_CONNECTION_STRING" {
  value     = azurerm_application_insights.this.connection_string
  sensitive = true
}

output "COSMOSDB_ACCOUNT_NAME" {
  value     = azurerm_cosmosdb_account.this.name
  sensitive = false
}

output "COSMOSDB_CONNECTION_STRING" {
  value     = azurerm_cosmosdb_account.this.primary_sql_connection_string
  sensitive = true
}
