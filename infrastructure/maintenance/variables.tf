variable "region" {
  description = "Region to deploy resources to"
  default     =  "southcentralus"
}

variable "tags" {
  description = "Tags to apply to Resource Group"
}

variable "app_name" {
  description = "Name of the application"
}

variable "app_requires_authentication" {
  description = "Enable Authentication for the Azure Functions APIs"
}