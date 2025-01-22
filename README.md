# Introduction 
This project is a demo on how to use Azure Functions with HTTP Triggers, Cosmos DB, and a Vue.js Single Page Application (SPA) protected by Azure EntraID (Azure AD). It showcases how to build a secure, scalable, and serverless application with a modern front-end framework and cloud services.

[![Open in GitHub Codespaces](https://img.shields.io/static/v1?style=for-the-badge&label=GitHub+Codespaces&message=Open&color=brightgreen&logo=github)](https://codespaces.new/briandenicola/password-vault?quickstart=1)
[![Open in Dev Containers](https://img.shields.io/static/v1?style=for-the-badge&label=Dev%20Containers&message=Open&color=blue&logo=visualstudiocode)](https://vscode.dev/redirect?url=vscode://ms-vscode-remote.remote-containers/cloneInVolume?url=https://github.com/briandenicola/password-vault)  

## Required Tools
* A Posix compliant System. It could be one of the following:
    * [Github CodeSpaces](https://github.com/features/codespaces)
    * Azure Linux VM - Standard_B1s VM will work
    * Windows 11 with [Windows Subsystem for Linux](https://docs.microsoft.com/en-us/windows/wsl/install)
* [dotnet 8](https://dotnet.microsoft.com/download) - The .NET SDK
* [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli) - A tool for managing Azure resources
* [git](https://git-scm.com/) - The source control tool
* [Taskfile](https://taskfile.dev/#/) - A task runner for the shell
* [Terraform](https://www.terraform.io/) - A tool for building Azure infrastructure and infrastructure as code

### Optional Tools
* [Windows Terminal](https://aka.ms/terminal) - A better terminal for Windows
* [Zsh](https://ohmyz.sh/) - A better shell for Linux and Windows
    
> * **Note:** The Github Codespaces environment has all the tools pre-installed and configured.  You can use the following link to open the password-vault project in Github Codespaces: [Open in Github Codespaces](https://codespaces.new/briandenicola/password-vault?quickstart=1)
> * **Note:** [./.devcontainer/post-create.sh](./.devcontainer/post-create.sh) is a script that can be used to install the tools on a Linux VM. 

### Task
* The deployment of this application has been automated using [Taskfile](https://taskfile.dev/#/).  This was done instead of using a CI/CD pipeline to make it easier to understand the deployment process.  
* The application can also be deployed manually
* The Taskfile is a simple way to run commands and scripts in a consistent manner.  
* The [TaskFile](../TaskFile.yaml) definition is located in the root of the repository
* The Task file declares the default values that can be updated to suit specific requirements: 
    Name | Usage | Default Value
    ------ | ------ | ------
    TAG | Value used in Azure Tags | password-vault
    DEFAULT_REGION | Default region to deploy to | canadacentral
    COSMOSDB_FREE_TIER | Use the Cosmos DB free tier | false
    DEPLOY_MAINTENANCE | Deploy Azure  Functions for Keep Alives | false 
    ADD_CUSTOM_DOMAIN | Add a custom domain to Azure Static Web Apps |  false 
    APP_REQUIRES_AUTHENTICATION | Require authentication for the UI | true
    
* Running the `task` command without any options will run the default command. This will list all the available tasks.
    * `task up`                  : Builds complete environment
    * `task down`                : Destroys all Azure resources and cleans up Terraform
    * `task deploy-api`          : Builds and deploys the API to Azure Functions
    * `task deploy-maintenance`  : Deploys the maintenance function
    * `task deploy-ui`           : Builds and deploys the UI to Azure Static Web Apps
    * `task host-key`            : Gets the host key for the Azure Function
    * `task init`                : Initializes Terraform
    * `task plan`                : Creates a plan for Terraform

## Environment
* An Azure subscription. An MSDN subscription will work.
* An account with owner permission on the Azure subscription and Global Admin on the Azure AD tenant
* **Warning:** Follow this guide to configure [Terraform](https://learn.microsoft.com/en-us/azure/developer/terraform/get-started-cloud-shell-powershell?tabs=bash) with a Service Principal

## Navigation
[Return to Main Index 🏠](../README.md) ‖
[Next Section ⏩](./docs/entra.md)
<p align="right">(<a href="#prerequisites">back to top</a>)</p>
