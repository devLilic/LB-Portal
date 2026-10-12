# Development Workflow

## Core Rules

- Build the starter module by module.
- Within each module, work in small sequential tasks.
- Do not move to the next task until the current task meets its Definition of Done.
- Avoid unrelated refactors while implementing a task.
- Prefer explicit file boundaries and typed contracts over ad-hoc wiring.
- Prefer config-driven behavior when introducing optional functionality.

## TDD Expectations

- Use TDD for application logic.
- Start logic work by adding or updating a focused unit test when practical.
- Keep tests small, deterministic, and close to the logic they verify.
- Place unit tests under `tests/unit/`.
- Use `npm test` or `npm run test:unit` as the default validation path for logic.

## Testing Scope

- Prioritize unit tests for logic modules.
- Keep UI tests minimal and add them only when they are strictly necessary.
- Avoid E2E coverage unless there is no lower-cost way to protect the behavior.
- Do not introduce UI-heavy test infrastructure for simple logic changes.

## Task Execution

- Keep each task narrow and implementation-focused.
- Define the expected outcome before changing code.
- Verify the task with the minimum useful test coverage.
- Preserve existing behavior unless the task explicitly changes it.

## Definition of Done

- The requested task behavior is implemented.
- Relevant unit tests pass, or existing tests are updated safely.
- The app still builds or runs when the task affects runtime wiring.
- No accidental functionality loss is introduced.
- No unnecessary refactor is bundled into the task.

## Module Completion

- Finish all planned tasks for the module before closing it.
- Create one clear commit at the end of the module.
- Push the completed module changes to GitHub.
- Keep commit messages specific to the module outcome.
