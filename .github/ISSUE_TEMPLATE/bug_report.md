---
name: Bug report
about: Something isn't working as expected
title: '[Bug] '
labels: bug
assignees: ''
---

## Bug Description

A clear description of the bug.

## Reproduction

```typescript
import { render } from 'pretext-pdf'

const pdf = await render({
  content: [
    // minimal reproduction here
  ]
})
```

## Expected Behavior

What you expected to happen.

## Actual Behavior

What actually happened. Include the full error message and stack trace.

## Environment

- **pretext-pdf version**:
- **Node.js version** (`node -v`):
- **OS**:
- **Platform**: (Node.js / Browser)

## Additional Context

- PDF output (if applicable): attach the generated `.pdf` file
- Screenshot of the visual issue (if applicable)
