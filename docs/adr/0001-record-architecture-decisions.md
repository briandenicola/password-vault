# ADR-0001: Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-06-24

## Context

This vault was built years ago and is now being modernized. Several
non-obvious choices (crypto format, framework, auth model) have been made and
more are coming. Without a record, future contributors (human or AI agents)
will re-litigate settled questions or accidentally undo them.

## Decision

Keep lightweight ADRs in `docs/adr/`, one decision per file, using the Nygard
template. Record only decisions that are **hard to reverse** or that someone
would otherwise re-debate. Pair them with a short [`constitution.md`](../constitution.md)
of durable principles. Keep both concise.

## Consequences

- New contributors get the "why" quickly; agents have stable guardrails.
- Small ongoing cost: a one-page ADR per significant decision.
- ADRs are immutable once Accepted — to change course, add a new ADR that
  supersedes the old one rather than editing history.
