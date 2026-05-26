# Complete App Execution Plan

Date: 2026-05-25

This plan turns the ActionOS prototype into a complete local-first MVP that can be tested, improved, and then connected to real backend services.

## Target

Build ActionOS as a complete testable MVP before backend integration.

The MVP should let a user:

- Use the app across refreshes without losing data.
- Create tasks.
- Search and filter board work.
- Update task status and checklist progress.
- Add meeting notes, decisions, blockers, and actions.
- Convert meeting actions into tasks.
- See assigned work in My Work.
- Add/invite members in a mock workspace.
- Reset demo data when needed.

## Why Local-First

Local-first keeps the product loop fast.

We can test the user experience and improve the workflow before committing to:

- Database schema.
- API shape.
- Authentication integration.
- HomePage hosting.
- FritzControl and Servitz cross-links.

## Milestone 1: Complete Local MVP

Goal:

Make the standalone app feel complete enough for hands-on testing.

Scope:

- Local storage persistence.
- Reset demo data.
- Task creation.
- Board search.
- Board status filter.
- Task status editing.
- Checklist editing.
- Meeting output creation.
- Meeting action conversion.
- Mock member invitation.

Success:

- A user can refresh the browser and keep changes.
- A user can test the whole work loop without backend setup.

## Milestone 2: Usability Pass

Goal:

Improve the daily-use experience after testing the local MVP.

Scope:

- Better empty states.
- Inline validation messages.
- Clearer conversion feedback.
- Better mobile layout.
- Better task detail panel.
- Cleaner board filters.
- Basic keyboard-friendly flow.

Success:

- The app feels understandable without explanation.
- The main workflow is fast enough for repeated use.

## Milestone 3: Data Contracts

Goal:

Prepare for real backend work without rewriting the frontend.

Scope:

- Convert local service methods into API-shaped methods.
- Add DTO files.
- Separate state facade from persistence implementation.
- Add environment-level configuration.
- Prepare API endpoint mapping.

Success:

- Local persistence can later be replaced with HTTP services.

## Milestone 4: ActionOS API

Goal:

Persist ActionOS data outside the browser.

Scope:

- Workspace endpoints.
- Member endpoints.
- Board endpoints.
- Item endpoints.
- Meeting endpoints.
- Comment/activity endpoints later.

Success:

- Data survives across users and devices.

## Milestone 5: HomePage Host Integration

Goal:

Open ActionOS from the unified HomePage system.

Scope:

- Register ActionOS as external module.
- Receive token, language, selected org, module slug, and environment by postMessage.
- Validate access against HomePage server.
- Map host user into ActionOS user context.
- Add host adapter services.

Success:

- ActionOS runs standalone and inside HomePage.

## Current Execution Slice

Start with Milestone 1.

Implementation order:

1. Add local storage persistence.
2. Add reset demo data.
3. Add task creation.
4. Add board search and status filtering.
5. Add mock member invitation.
6. Update release/testing docs.
7. Run production build.

