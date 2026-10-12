# Codex Project Init Workflow

## Purpose

This document defines how Codex should work when initializing a new application from this default Electron starter.

The goal is to keep new projects:
- consistent
- modular
- TDD-first for application logic
- free from unnecessary refactors

This file is the workflow contract for project initialization. It should be used together with module task prompts.

## Starter Summary

This starter provides:
- modular Electron architecture
- typed config system
- typed IPC boundary
- preload safety through explicit APIs
- optional i18n
- optional auto-update
- optional app protection
- optional licensing
- optional database
- structured logging
- scaffold/init support

Core stack:
- Electron
- React
- TypeScript
- Tailwind CSS
- Vite

## Core Rules For Codex

- Work module by module.
- Split work into small sequential tasks.
- Satisfy the task DoD before moving forward.
- Do not perform unrelated refactors.
- Do not end tasks with explanatory implementation summaries.
- Only implement the requested task.
- Run or update minimal logic tests for stability.
- Preserve secure Electron architecture boundaries.
- Prefer typed contracts over ad-hoc patterns.
- Prefer config-driven behavior over scattered conditionals.
- Commit and push after each completed module.

## New Project Initialization Workflow

Recommended order when starting a new app from this starter:

1. Inspect the starter structure.
2. Initialize project metadata and placeholders.
3. Confirm the config defaults for the new application.
4. Confirm which modules are enabled and which remain disabled.
5. Preserve development-mode rules.
6. Preserve production-only feature gating.
7. Continue module by module.

Codex must not start by editing many unrelated files before metadata, config scope, and enabled modules are aligned.

## Project Metadata Checklist

When initializing a new project, Codex should update:
- app name
- display name
- package name
- app id
- description
- author, if required
- repository references, if required
- icons and placeholder assets, if applicable
- config defaults specific to the new application

Primary starter-owned targets usually include:
- `package.json`
- `electron-builder.json`
- `config/base.ts`
- README and project docs when requested

## Module Selection Workflow

Codex must identify the module set for the new project:
- i18n
- autoUpdate
- appProtection
- licensing
- database
- logging

Rules:
- enabled modules should be configured cleanly
- disabled modules should remain cleanly disabled
- disabled modules should not be partially removed in a chaotic way
- if a module is out of scope, keep it intact and gated by config

## Development Mode Rules

Development mode must remain fast and unblocked.

Required rules:
- licensing must remain OFF in development
- appProtection must remain OFF in development

Additional rules:
- do not force production-only enforcement into dev flow
- keep typed preload APIs intact
- do not expose unsafe raw renderer access
- do not break the Electron boundary model

## Production Mode Rules

Production-only features are prepared before build.

Codex must:
- respect config-driven activation
- respect build-time env overrides when used
- keep production-only features out of the normal development flow

Typical production-controlled features:
- autoUpdate
- appProtection
- licensing

## TDD Rules

This ecosystem uses TDD for application logic.

Codex must:
- write or update unit tests for logic changes
- avoid heavy UI testing unless strictly necessary
- avoid E2E unless strictly necessary

Expected logic layers to test include:
- config resolution
- module enablement
- licensing policies
- update state mapping
- repositories
- services
- helpers

## File And Architecture Safety Rules

Codex must preserve:
- typed config structure
- module registry patterns
- typed IPC boundaries
- preload safety
- main and renderer separation

Database rule:
- database access must stay in Electron main process
- renderer access must happen through typed IPC only

## Recommended Execution Order

1. Initialize project metadata.
2. Update config and enabled features.
3. Run baseline tests.
4. Implement or refine modules one by one.
5. Add or update logic tests.
6. Commit and push per module.
7. Update README and project docs when required.

## Commit Strategy

Each module should end with:
- validation
- commit
- push

Commit messages should be:
- clear
- module-oriented
- scoped to the task that was completed

## What Codex Must Avoid

- unrelated refactors
- broad rewrites without task scope
- mixing multiple modules in one uncontrolled patch
- bypassing typed IPC
- direct database access from renderer
- enabling licensing in development
- enabling appProtection in development
- adding unnecessary UI tests
- adding unnecessary E2E tests
- ending with explanatory summaries instead of just implementing

## Definition Of Done Template

Use this template for future module tasks:

- requested scope is implemented
- architecture boundaries are preserved
- minimal logic tests are added or updated when needed
- tests for affected logic pass
- app still builds or runs when applicable
- no unrelated refactors were introduced

## Suggested Prompt Usage

Use this document as the workflow contract for Codex behavior during project initialization.

Use module task prompts as the implementation units that define:
- the current scope
- the current requirements
- the current DoD

Codex should follow this document for workflow discipline and use module prompts for task-by-task execution.
