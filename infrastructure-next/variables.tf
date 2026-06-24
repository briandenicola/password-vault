variable "region" {
  description = "Region to deploy vault-next resources to"
  default     = "southcentralus"
}

variable "tags" {
  description = "Application tag to apply to vault-next resources"
  default     = "Password Vault Next"
}

variable "enable_cosmosdb_free_tier" {
  description = "Enable the Cosmos DB free tier on the isolated vault-next account"
  default     = true
}

variable "add_custom_domain" {
  default     = false
  description = "Add vault.denicolafamily.com to the vault-next Static Web App after DNS is ready"
}

variable "production_ui_url" {
  description = "The eventual production custom domain for the vault-next Static Web App"
  default     = "vault.denicolafamily.com"
}

variable "webauthn_rp_id" {
  description = "WebAuthn relying-party ID for passkey PRF enrollment/unlock"
  default     = "denicolafamily.com"
}

variable "app_requires_authentication" {
  description = "Enable Entra token validation on the Azure Functions APIs"
  default     = true
}

variable "app_e2ee_enabled" {
  description = "Enable client-side E2EE vault-key endpoints for the E2EE-native vault-next stack"
  default     = true
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
