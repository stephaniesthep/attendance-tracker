# Development Guidelines

## Framework & Routing
- **React Router v7**: Use React Router v7, which functions identically to Remix v2
  - Import from `react-router` instead of `remix`
  - Use `data()` function instead of the deprecated `json()` function
- **Routing System**: Uses `remix-flat-routes` library for file-based routing
  - Route files are located in `src/routes/` folder


## Development Environment
- **Terminal**: Use Git Bash commands (Windows environment)
  - Do NOT use Windows Command Prompt or PowerShell commands
- **Package Manager**: Use `npm` exclusively

## Code Quality & Standards
- **TypeScript**: Always generate proper types using type inference
  - NEVER use `any` type
- **Variable Declaration**:
  - Use `const` for variables that won't be reassigned
  - Use `let` for variables that will be reassigned
  - NEVER use `var`
- **Comments**: Add explanatory comments for complex logic to help other developers

## Server Utilities & Database
- **Result Pattern**: Use success/failure pattern from `~/shared/utils` for exported server utility functions
  - DO NOT use this pattern in route loader/action functions
- **Prisma ORM**:
  - Always use `select` instead of `include` in queries
  - Transform nullable fields to `undefined` instead of `null`
  - Import types from `@prisma/client`

## Chat Behavior
- **Code Generation**: Only generate code when explicitly requested
- **File Suggestions**: When suggesting new files, include a comment indicating workspace placement

## UI Components & Styling
- **shadcn/UI**: Prefer shadcn/UI components over custom elements
- **Component Variants**: Use component variants for styling instead of manual `className` styling
- **Motion Library**: Use `motion/react` instead of `framer-motion` (identical API)



## Forms & Navigation
- **Form Buttons**: Always specify `type="submit"` or `type="button"`
- **Form Submission**: Use `onSubmit` event, not `onClick` on submit buttons
- **Navigation**: Use `Link` component from `react-router`, not anchor tags

## Validation & Error Handling
- **Error Handling Strategy**:
  1. **redirectWithToast**: For system errors, API failures, database errors, or successful operations
  2. **Action errors**: For business rule violations, quota limits, or permission issues (keeps form data intact)
  3. **Root-level form errors**: For form-wide validation or authentication issues
  - **Key principle**: Use action errors when users need to see the form with their data to make corrections; use redirectWithToast for system errors or completed operations

## Command Execution
- **Pre-execution**: Always summarize changes before running terminal commands
Do not ask me to run commands such as pnpm run dev, as most likely I am already running it.

## Documentations

- **Documentation**: Follow the conventions outlined in `docs/` folder
  - Use Markdown format for documentation files
  - Keep documentation up-to-date with code changes
  - Place the documentation to the appropriate folder in `docs/` if unsure place it under `docs/planning/`