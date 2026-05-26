# ActionOS App

Standalone Angular 18 prototype for ActionOS.

## Current Prototype

This first build uses mock data and proves the core workflow:

- Workspace home.
- My Work.
- Board table.
- Board kanban.
- Meeting detail.
- Meeting action conversion.
- Member list.

## Source Structure

```text
src/app/
  core/
    mock-data/
    models/
    services/
  features/
    boards/
    meetings/
    members/
    my-work/
    workspace-home/
```

The root `AppComponent` now owns only the app shell and active screen selection. Mock data and shared workflow behavior live in `ActionosWorkspaceService`.

## Local Persistence

The prototype stores test data in browser `localStorage` under:

```text
actionos.local-state.v2
```

Use the `Reset demo` button in the top bar to restore the initial mock data.

The storage implementation sits behind `ActionosPersistencePort`, so a future HTTP repository can replace local storage without rewriting the screens.

## Run Locally

```powershell
npm install
npm run start -- --port 4305 --host 127.0.0.1
```

Then open:

```text
http://127.0.0.1:4305/
```

## Build

```powershell
npm run build
```
