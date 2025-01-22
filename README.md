# Introduction 
This repository demonstrates the integration of Azure Functions with HTTP Triggers, Cosmos DB, and a Vue.js Single Page Application (SPA) secured by Azure EntraID (Azure AD). It illustrates the construction of a secure, scalable, and serverless application using modern front-end frameworks and cloud services.

[![Open in GitHub Codespaces](https://img.shields.io/static/v1?style=for-the-badge&label=GitHub+Codespaces&message=Open&color=brightgreen&logo=github)](https://codespaces.new/briandenicola/password-vault?quickstart=1)
[![Open in Dev Containers](https://img.shields.io/static/v1?style=for-the-badge&label=Dev%20Containers&message=Open&color=blue&logo=visualstudiocode)](https://vscode.dev/redirect?url=vscode://ms-vscode-remote.remote-containers/cloneInVolume?url=https://github.com/briandenicola/password-vault)  

## Prerequisites
* A POSIX-compliant system, such as:
    * [GitHub Codespaces](https://github.com/features/codespaces)
    * Azure Linux VM (Standard_B1s VM recommended)
    * Windows 11 with [Windows Subsystem for Linux](https://docs.microsoft.com/en-us/windows/wsl/install)
* [.NET 8 SDK](https://dotnet.microsoft.com/download)
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
* `task deploy-api`          : Builds and deploys the API to Azure Functions
* `task deploy-maintenance`  : Deploys the maintenance function
* `task deploy-ui`           : Builds and deploys the UI to Azure Static Web Apps
* `task host-key`            : Retrieves the host key for the Azure Function
* `task init`                : Initializes Terraform
* `task plan`                : Creates a Terraform plan

### Taskfile Configuration
The [TaskFile](../TaskFile.yaml) is located in the root of the repository and includes default values that can be customized:
| Name | Usage | Default Value |
|------|-------|---------------|
| TAG | Value used in Azure Tags | password-vault |
| DEFAULT_REGION | Default region to deploy to | canadacentral |
| COSMOSDB_FREE_TIER | Use the Cosmos DB free tier | false |
| DEPLOY_MAINTENANCE | Deploy Azure Functions for Keep Alives | false |
| ADD_CUSTOM_DOMAIN | Add a custom domain to Azure Static Web Apps | false |
| APP_REQUIRES_AUTHENTICATION | Require authentication for the UI | true |

## Environment Setup
* An Azure subscription (MSDN subscription is sufficient)
* An account with owner permissions on the Azure subscription and Global Admin on the Azure AD tenant
* **Warning:** Follow this [guide](https://learn.microsoft.com/en-us/azure/developer/terraform/get-started-cloud-shell-powershell?tabs=bash) to configure Terraform with a Service Principal.

## Navigation
[Return to Main Index 🏠](../README.md) ‖
[Next Section ⏩](./docs/entra.md)
<p align="right">(<a href="#prerequisites">back to top</a>)</p>
