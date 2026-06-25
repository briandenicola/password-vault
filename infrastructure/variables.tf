variable "region" {
  description = "Region to deploy resources to"
  default     = "southcentralus"
}

variable "tags" {
  description = "Tags to apply to Resource Group"
}

variable "enable_cosmosdb_free_tier" {
  description = "Opt in to the Azure Cosmos DB free tier for the account. Azure allows only one free-tier Cosmos account per subscription, and this is only intended for new accounts."
  type        = bool
  default     = false
}

variable "deploy_maintenance_infrastructure" {
  default = false
}

variable "password_encryption_key" {
  description = "Password Encryption Key (legacy v1 + HKDF root for v2; pass via TF_VAR_password_encryption_key, never on the CLI)"
  sensitive   = true
}

variable "password_encryption_initialization_vector" {
  description = "Password Encryption Initialization Vector (legacy v1 only; pass via TF_VAR_password_encryption_initialization_vector, never on the CLI)"
  sensitive   = true
}

variable "add_custom_domain" {
  default     = false
  description = "Add custom domain to the Static Web App"
}

variable "production_ui_url" {
  description = "The Custom Domain for the Static Web App"
}

variable "app_requires_authentication" {
  description = "Enable Entra token validation on the Azure Functions APIs (AC-2: triggers are Anonymous, so this is fail-closed and defaults ON; set false only for a dev environment)"
  default     = true
}

variable "app_e2ee_enabled" {
  description = "OFF-4 Phase 2: enable the client-side-encryption (E2EE) vault-key endpoints. Default off until passkey enrollment/unlock ships; mirrors the UI VUE_APP_E2EE flag."
  default     = false
}

variable "aad_tenant_id" {
  description = "Entra (Azure AD) tenant id used to validate API bearer tokens (AC-1)"
  default     = ""
}

variable "aad_audience" {
  description = "Accepted audience(s) for API bearer tokens, comma-separated (e.g. api://password-vault)"
  default     = ""
}

variable "aad_allowed_oids" {
  description = "Optional comma-separated allowlist of caller object-ids. Empty relies on Enterprise App group assignment."
  default     = ""
}
