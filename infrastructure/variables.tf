variable "region" {
  description = "Region to deploy resources to"
  default     =  "southcentralus"
}

variable "tags" {
  description = "Tags to apply to Resource Group"
}

variable "enable_cosmosdb_free_tier" {
  description = "CosmosDB SKU"
  default     = true
}

variable "deploy_maintenance_infrastructure" {
  default     = false
}

variable "password_encryption_key" {
  description = "Password Encryption Key"
}

variable "password_encryption_initialization_vector" {
  description = "Password Encryption Initialization Vector"
}

variable "add_custom_domain" {
  default = false
  description = "Add custom domain to the Static Web App"
}

variable "production_ui_url" {
  description = "The Custom Domain for the Static Web App"
}

variable "app_requires_authentication" {
  description = "Enable Authentication for the Azure Functions APIs"
  default     = false
}
