# Vault-next infrastructure

This directory is an additive Terraform root for the blue-green `vault-next` stack. It uses the same AzureRM backend storage account/container as the existing stack, but a distinct state key: `vault-next.tfstate`. Resources are named with a `vault-next-<random>` prefix and deploy into their own resource group, Cosmos account, `Passwords` and `VaultKeys` containers, Function App identities, Key Vault, storage account, and Static Web App.

## Stand-up flow

1. Authenticate with the deployment identity used for the existing infrastructure.
2. From this directory, initialize the isolated state:
   ```sh
   terraform init
   ```
3. Review variables. Defaults intentionally set `app_e2ee_enabled = true`, `production_ui_url = "vault.denicolafamily.com"`, and `webauthn_rp_id = "denicolafamily.com"` for the E2EE-native rebuild.
4. Plan/apply only when the operator is ready to create the parallel stack:
   ```sh
   terraform plan
   terraform apply
   ```

For offline validation only, use:

```sh
terraform fmt -recursive -check
terraform init -backend=false
terraform validate
```

## Cutover notes

Do not point `vault.denicolafamily.com` at this Static Web App until import, E2EE unlock testing, and parity verification are complete. When DNS is ready, set `add_custom_domain = true` so Terraform adds the Static Web App custom domain for `vault.denicolafamily.com`. Passkeys should use RP ID `denicolafamily.com` so credentials survive the final URL cutover.
