```markdown
# frontend-to-workflow Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches the core development patterns and conventions used in the `frontend-to-workflow` TypeScript codebase. It covers file organization, import/export styles, code style, and testing patterns, providing practical examples to help you contribute effectively.

## Coding Conventions

### File Naming
- Use **camelCase** for file names.
  - Example: `userProfile.ts`, `dataFetcher.ts`

### Import Style
- Use **relative imports** for referencing other modules.
  - Example:
    ```typescript
    import { fetchData } from './dataFetcher';
    ```

### Export Style
- Use **named exports** for all exported members.
  - Example:
    ```typescript
    // In userProfile.ts
    export function getUserProfile(id: string) { ... }
    ```

### Commit Patterns
- Commit messages are **freeform** (no strict prefixes).
- Average commit message length: ~38 characters.
  - Example: `fix user profile loading bug`

## Workflows

_No specific workflows were detected in this repository._

## Testing Patterns

- **Framework:** Not explicitly detected.
- **Test File Pattern:** Files containing tests follow the `*.test.*` naming convention.
  - Example: `userProfile.test.ts`
- Test files are typically placed alongside the code they test or in a dedicated test directory.

## Commands
| Command | Purpose |
|---------|---------|
| _(none detected)_ | No custom workflow commands are defined in this repository. |
```