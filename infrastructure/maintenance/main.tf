locals {
  location                  = var.region
  resource_name             = var.app_name
  storage_name              = "${replace(local.resource_name, "-", "")}sb"
  functions_host_plan_name  = "${local.resource_name}-linux-maintenance-hosting"
  functions_name            = "${local.resource_name}-maintenance-functions"
}


