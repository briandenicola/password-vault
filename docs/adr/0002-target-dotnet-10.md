# ADR-0002: Target .NET 10 for the API

- **Status:** Accepted
- **Date:** 2026-06-24

## Context

The Azure Functions API was on an older .NET. Staying on an unsupported runtime
is a security and maintenance liability, and newer crypto/JWT libraries assume a
current framework. The owner explicitly asked to target .NET 10.

## Decision

Target **.NET 10** across the API (`src/passwordapp.api`), test project
(`src/passwordapp.api.tests`, xUnit), and the devcontainer/CI. Use the Functions
isolated worker model with ASP.NET Core integration.

## Consequences

- Access to current `Microsoft.IdentityModel.*` and AES-GCM APIs.
- Supported runtime with security patches.
- **Open item:** `infrastructure/functions.tf` still sets `dotnet_version = "8.0"`;
  the deploy target must be bumped to match before shipping to Azure.
