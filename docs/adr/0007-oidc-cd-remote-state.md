# ADR-0007: OIDC-only CD with remote Terraform state

- **Status:** Accepted
- **Date:** 2026-06-24

## Context

Deploys were manual (`Taskfile.yaml`) against local Terraform state. To make
deploys repeatable and reviewable (`CD-2`/`CD-3`/`CD-4`) we needed CI/CD that
touches live Azure **without** storing long-lived credentials, and shared state
so plan/apply is consistent across machines and the pipeline.

## Decision

- **Authenticate with Entra OIDC federated credentials** (`azure/login`,
  `ARM_USE_OIDC`) — no service-principal password or publish profile is stored
  as a secret (`CD-3`).
- **Move Terraform state to an `azurerm` backend** (`providers.tf`,
  `denicolafamily/state`, `use_oidc`) (`CD-4`).
- **Workflows call the same `task` targets used locally** (`CD-7`) so there is
  no drift: `infra.yml` runs `task plan` on PR and `task apply` on `main`;
  `deploy.yml` runs `task deploy-*`. Every apply/deploy runs in a **`production`
  GitHub Environment** that requires reviewer approval.
- **Keep secrets off the command line** (`CD-5`): the encryption key/IV are
  `sensitive` Terraform vars sourced via `TF_VAR_*` env.

## Consequences

- No stored cloud credentials; access is short-lived per workflow run.
- Local dev now needs `az login` + access to the state storage account; the
  first run may require `terraform init -migrate-state`.
- Nothing deploys until the operator wires the federated credential, repo
  secrets, and the `production` Environment — a deliberate, fail-safe gate.
- Local and pipeline deploys cannot diverge because both go through `task`.
