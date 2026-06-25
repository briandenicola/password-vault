# Introduction 
This repository demonstrates the integration of Azure Functions with HTTP Triggers, Cosmos DB, and a Vue.js Single Page Application (SPA) secured by Azure EntraID (Azure AD). It illustrates the construction of a secure, scalable, and serverless application using modern front-end frameworks and cloud services.

[![Open in GitHub Codespaces](https://img.shields.io/static/v1?style=for-the-badge&label=GitHub+Codespaces&message=Open&color=brightgreen&logo=github)](https://codespaces.new/briandenicola/password-vault?quickstart=1)
[![Open in Dev Containers](https://img.shields.io/static/v1?style=for-the-badge&label=Dev%20Containers&message=Open&color=blue&logo=visualstudiocode)](https://vscode.dev/redirect?url=vscode://ms-vscode-remote.remote-containers/cloneInVolume?url=https://github.com/briandenicola/password-vault)  

## Prerequisites
* A POSIX-compliant system, such as:
    * [GitHub Codespaces](https://github.com/features/codespaces)
    * Azure Linux VM (Standard_B1s VM recommended)
    * Windows 11 with [Windows Subsystem for Linux](https://docs.microsoft.com/en-us/windows/wsl/install)
* [.NET 10 SDK](https://dotnet.microsoft.com/download)
* [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli)
* [Git](https://git-scm.com/)
* [Taskfile](https://taskfile.dev/#/)
* [Terraform](https://www.terraform.io/)

### Optional Tools
* [Windows Terminal](https://aka.ms/terminal)
* [Zsh](https://ohmyz.sh/)
    
> **Note:** GitHub Codespaces comes pre-configured with all necessary tools. Use this [link](https://codespaces.new/briandenicola/password-vault?quickstart=1) to open the project in GitHub Codespaces.
> **Note:** The script [./.devcontainer/post-create.sh](./.devcontainer/post-create.sh) can be used to install the tools on a Linux VM.

## Task Automation
Deployment is automated using [Taskfile](https://taskfile.dev/#/), simplifying the deployment process without a CI/CD pipeline. The Taskfile provides a consistent way to execute commands and scripts.

### Taskfile Commands
* `task up`                  : Builds the complete environment
* `task down`                : Destroys all Azure resources and cleans up Terraform
* `task cors`                : Adds the UI origins to the Azure Functions CORS allow-list
* `task entra:configure`     : Creates or updates the Entra app registrations after infrastructure exists
* `task github:configure`    : Creates or updates GitHub Actions variables/secrets from Terraform outputs
* `task test-api`            : Hits the API health endpoint to validate a deployment
* `task migrate:verify`      : Reports any undecryptable vault secrets (read-only)
* `task migrate:apply`       : Re-encrypts legacy `v1` secrets to `v2` (AES-GCM); backs up first
* `task init`                : Initializes Terraform
* `task plan`                : Creates a Terraform plan

Code deployment is handled by GitHub Actions (`.github/workflows/deploy.yml`), not local Taskfile targets.

### Taskfile Configuration
The [TaskFile](../TaskFile.yaml) is located in the root of the repository and includes default values that can be customized:
| Name | Usage | Default Value |
|------|-------|---------------|
| TAG | Value used in Azure Tags | Password Vault on Azure Functions |
| DEFAULT_REGION | Default region to deploy to | southcentralus |
| COSMOSDB_FREE_TIER | Enable Cosmos DB free tier for new accounts. Set `COSMOSDB_FREE_TIER=false` to opt out. Azure allows only one free-tier Cosmos account per subscription. | true |
| DEPLOY_MAINTENANCE | Deploy Azure Functions for Keep Alives | false |
| ADD_CUSTOM_DOMAIN | Add a custom domain to Azure Static Web Apps | false |
| APP_REQUIRES_AUTHENTICATION | Require authentication for the UI | true |

## Environment Setup
* An Azure subscription (MSDN subscription is sufficient)
* An account with owner permissions on the Azure subscription and Global Admin on the Azure AD tenant
* **Warning:** Follow this [guide](https://learn.microsoft.com/en-us/azure/developer/terraform/get-started-cloud-shell-powershell?tabs=bash) to configure Terraform with a Service Principal.

## Project Governance
* [Constitution](./docs/constitution.md) — durable principles and working agreements.
* [Architecture Decision Records](./docs/adr/README.md) — why key choices were made.

## Navigation
[Return to Main Index 🏠](../README.md) ‖
[Next Section ⏩](./docs/entra.md)
<p align="right">(<a href="#prerequisites">back to top</a>)</p>
