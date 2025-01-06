Infrastructure
============
* The infrastructure is deployed to Azure using Terraform.  
* The build process is kicked off using the command: `task up` command which kick start terraform.  
* Terraform will generate a random name that is used as the foundation for all the resources created in Azure.  The random name is generated using the `random_pet` and `random_integer` resources in Terraform.  This value should be saved as it is used throughout the deployment. The example name `airedale-60249` is used in the rest of the documents
* The infrastructure deploy can take up to 30 minutes to complete.
* The infrastructure is deployed to a single Azure region (defaults to `canadacentral`) and can be changed by updating the `DEFAULT_REGION` variable in the `Taskfile.yaml` file.
* The `task init` command also generates the AES Key and AES IV that are used to encrypt the secrets in the Key Vault.  These values are stored ENCRYPTION_KEY and ENCRYPTION_IV in the infrastructure/.env file.
* If `ADD_CUSTOM_DOMAIN` is set to `true` then VUE_APP_AAD_REDIRECT_URL value in src/passwordapp.ui/.env.production needs to be set before deploying the infrastructure.

### Infrastructure Components
# Steps
## :heavy_check_mark: Deploy Task Steps
> _**Note**: If terraform fails for any resaon, you can run these commands individually to retry the deployment._
- :one: `task init`     - Initializes Terraform
- :two: `task apply`    - Applies the Terraform plan to create the Azure infrastructure

<p align="right">(<a href="#infrastructure">back to top</a>)</p>

# Infrastructure Components
## Resource Groups
Name | Usage
------ | ----
Application Resource Group ("${app_name}_app_rg") | Main Application RG
Main Resource Group ("${app_name}_maintenance_rg") | Maintaince Application RG
<p align="right">(<a href="#infrastructure">back to top</a>)</p>

# Navigation
[Previous Section ⏪](./entra.md) ‖ [Return to Main Index 🏠](../README.md) ‖ [Next Section ⏩](./deploy.md)
<p align="right">(<a href="#infrastructure">back to top</a>)</p>