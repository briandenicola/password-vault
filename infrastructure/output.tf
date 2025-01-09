output "APP_NAME" {
    value = local.resource_name
    sensitive = false
}

output "APP_RESOURCE_GROUP" {
    value = azurerm_resource_group.this.name
    sensitive = false
}

output "SWA_NAME" {
    value = azurerm_static_web_app.this.name
    sensitive = false
}

output "STORAGE_ACCOUNT_NAME" {
    value = azurerm_storage_account.this.name
    sensitive = false
}

output "FUNCTION_NAME" {
    value = azurerm_linux_function_app.this.name
    sensitive = false
}

output "FUNCTION_URL" {
    value = "https://${azurerm_linux_function_app.this.default_hostname}"
    sensitive = false
}

output "AZURE_FUNCTION_HOST_KEY" {
    value = data.azurerm_function_app_host_keys.host_key.primary_key
    sensitive = true
}


output "APP_INSIGHTS_CONNECTION_STRING" {
    value = azurerm_application_insights.this.connection_string
    sensitive = true
}

output "MAINTENANCE_FUNCTION_NAME" {
    value = length(module.maintenance) > 0 ? module.maintenance[0].FUNCTION_NAME :  null
    sensitive = false
}

output "MAINTENANCE_STORAGE_ACCOUNT_NAME" {
    value = length(module.maintenance) > 0 ? module.maintenance[0].STORAGE_ACCOUNT_NAME :  null
    sensitive = false
}