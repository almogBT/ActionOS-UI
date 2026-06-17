/**
 * Shared styles for the customer meeting form and its section sub-components.
 *
 * Extracted verbatim from the original monolithic `customer-meeting-form.component.ts`
 * so the form could be split into focused child components without duplicating CSS
 * in source. Angular's emulated view encapsulation scopes these selectors to each
 * component that applies them, so the constant can be reused by every section
 * component safely. Base classes used here but NOT defined (`.panel`,
 * `.field-control`, `.primary-action`, `.ghost-action`, `.status-chip`, `.eyebrow`,
 * `.muted`, `.empty-state`) are global app styles and intentionally not redefined.
 */
export const MEETING_FORM_STYLES = `
    :host {
      display: block;
      min-width: 0;
    }
    .panel-header h3 { margin: 0; }
    .panel-header small.muted { display: block; margin-top: 4px; }
    .section-head { margin: 14px 0 10px; }
    .section-head h4 { margin: 0; }

    /* Progress stepper */
    .phase-stepper {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 14px;
      padding: 6px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--bg-elevated);
      overflow-x: auto;
    }
    .phase-step {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border: 0;
      background: transparent;
      color: var(--muted);
      padding: 6px 14px;
      border-radius: 999px;
      cursor: pointer;
      white-space: nowrap;
      font-size: 13px;
      font-weight: 600;
      transition: background 150ms ease, color 150ms ease;
    }
    .phase-step:disabled { cursor: not-allowed; opacity: 0.55; }
    .phase-step.active {
      background: var(--accent-soft);
      color: var(--accent-strong);
    }
    .phase-dot {
      display: inline-grid;
      place-items: center;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      border: 1px solid currentColor;
      font-size: 12px;
      font-weight: 700;
    }
    .phase-step.active .phase-dot {
      background: var(--accent-strong);
      color: #fff;
      border-color: var(--accent-strong);
    }
    .phase-line {
      flex: 1;
      min-width: 16px;
      height: 2px;
      border-radius: 2px;
      background: var(--line);
      transition: background 150ms ease;
    }
    .phase-line.filled { background: var(--accent); }

    /* Notes / Summary tab toggle */
    .work-header { align-items: flex-start; }
    .tab-toggle {
      display: inline-flex;
      gap: 4px;
      padding: 4px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--bg-canvas);
      flex-shrink: 0;
    }
    .tab-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: 0;
      background: transparent;
      color: var(--muted);
      padding: 7px 16px;
      border-radius: 999px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
      transition: background 150ms ease, color 150ms ease;
    }
    .tab-btn.active {
      background: var(--bg-elevated);
      color: var(--ink);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
    }
    .tab-count {
      display: inline-grid;
      place-items: center;
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      border-radius: 999px;
      background: var(--accent-soft);
      color: var(--accent-strong);
      font-size: 11px;
      font-weight: 700;
    }
    .capture-tab { display: grid; gap: 12px; margin-top: 12px; }
    .summary-publish-row {
      display: flex;
      align-items: center;
      gap: 14px;
      flex-wrap: wrap;
      margin-top: 4px;
    }
    .summary-publish-row p { margin: 0; flex: 1; min-width: 200px; }

    /* Sticky bottom action bar */
    .action-bar {
      position: sticky;
      bottom: 0;
      z-index: 5;
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 16px;
      padding: 12px 16px;
      border: 1px solid var(--line);
      border-radius: 14px;
      background: var(--bg-elevated);
      box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.18);
    }
    .action-bar-spacer { flex: 1; }
    .plan-layout {
      display: grid;
      grid-template-columns: minmax(0, 1.35fr) minmax(260px, 0.65fr);
      gap: 14px;
      align-items: start;
    }
    .form-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
    }
    .field-control.wide { grid-column: 1 / -1; }
    .participant-dropdown {
      position: relative;
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--bg-elevated);
    }
    .participant-dropdown-trigger {
      min-height: 40px;
      padding: 8px 12px;
      display: flex;
      align-items: center;
      cursor: pointer;
      user-select: none;
    }
    .participant-dropdown-trigger::-webkit-details-marker { display: none; }
    .participant-summary-text,
    .participant-placeholder {
      display: block;
      width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 14px;
      line-height: 1.3;
    }
    .participant-placeholder { color: var(--muted); }
    /* Floats over the form instead of pushing the drawer content down. */
    .participant-dropdown-menu {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      right: 0;
      z-index: 30;
      display: grid;
      gap: 6px;
      max-height: 280px;
      overflow-y: auto;
      overflow-x: hidden;
      border: 1px solid var(--line);
      border-radius: 10px;
      box-shadow: var(--shadow);
      padding: 8px;
      background: var(--bg-elevated);
    }
    .participant-search {
      width: 100%;
      min-height: 34px;
      padding: 0 10px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--bg-elevated);
      color: var(--ink);
    }
    .participant-option {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 8px;
      border-radius: 8px;
      cursor: pointer;
    }
    .participant-option input {
      width: 18px;
      height: 18px;
      min-height: 18px;
      padding: 0;
      margin: 0;
      flex: 0 0 auto;
    }
    .participant-empty {
      padding: 6px 8px;
      color: var(--muted);
      font-size: 12px;
    }
    .participant-menu-footer {
      display: grid;
      gap: 6px;
      margin-top: 4px;
      padding-top: 8px;
      border-top: 1px dashed var(--line);
    }
    .participant-menu-footer:empty {
      display: none;
    }
    .prospect-form {
      display: grid;
      gap: 8px;
      padding: 12px;
      border: 1px dashed var(--border-subtle);
      border-radius: 10px;
      background: var(--bg-canvas);
      margin-top: 8px;
    }
    .dup-warning {
      border: 1px solid #d9a400;
      background: rgba(217, 164, 0, 0.10);
      border-radius: 10px;
      padding: 8px 10px;
    }
    .dup-warning-title { color: #8a6d00; font-size: 12px; }
    .dup-warning-text { margin: 4px 0 6px; font-size: 11px; color: var(--text-secondary); }
    .dup-warning-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
    .dup-match {
      width: 100%;
      text-align: start;
      display: flex;
      align-items: baseline;
      gap: 8px;
      background: var(--bg-elevated);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 6px 10px;
      cursor: pointer;
      color: inherit;
      font: inherit;
    }
    .dup-match:hover { border-color: var(--accent); }
    .dup-match-name { font-weight: 600; }
    .dup-match small { color: var(--text-secondary); font-size: 11px; }
    .warn-action { background: #d9a400; border-color: #d9a400; }
    .prospect-form-title {
      font-size: 12px;
      text-transform: uppercase;
      color: var(--muted);
    }
    .prospect-form-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    /* Sits inside the narrow customer-participants dropdown menu, so it stacks. */
    .customer-add-row {
      display: grid;
      grid-template-columns: 1fr;
      gap: 6px;
      margin-top: 4px;
      padding: 10px;
      border: 1px dashed var(--line);
      border-radius: 10px;
      background: var(--bg-canvas);
    }
    .add-participant-toggle {
      justify-self: start;
    }
    .selected-participants {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 8px;
    }
    .selected-participant {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 28px;
      padding: 0 10px;
      border-radius: 999px;
      border: 1px solid var(--line);
      background: var(--bg-elevated);
      font-size: 12px;
    }
    .selected-participant button {
      border: 0;
      background: transparent;
      color: var(--muted);
      padding: 0;
      line-height: 1;
      min-height: 0;
      cursor: pointer;
      opacity: 0;
      transition: opacity 150ms ease;
    }
    .selected-participant:hover button {
      opacity: 1;
    }
    .prep-sidebar {
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--bg-elevated);
      padding: 10px;
      display: grid;
      gap: 10px;
      align-content: start;
      position: sticky;
      top: 10px;
      max-height: calc(100vh - 120px);
      overflow-y: auto;
    }
    .prep-sidebar h5 { margin: 0; font-size: 14px; position: sticky; top: 0; background: var(--bg-elevated); padding-bottom: 4px; z-index: 1; }
    .prep-block { display: grid; gap: 6px; }
    .prep-block strong { font-size: 12px; text-transform: uppercase; color: var(--muted); }
    .prep-block ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 6px;
    }
    .prep-block li {
      display: grid;
      gap: 4px;
      padding: 8px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--bg-canvas);
      font-size: 13px;
      line-height: 1.3;
    }
    .meeting-setup-summary {
      position: sticky;
      top: 10px;
      z-index: 2;
      margin-top: 12px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--bg-elevated);
      padding: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }
    .summary-copy {
      display: grid;
      gap: 4px;
    }
    .summary-copy small { color: var(--muted); }
    .run-panel { overflow: hidden; }
    .capture-shell {
      display: grid;
      gap: 10px;
      padding: 12px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--surface-strong);
    }
    .capture-type-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .capture-chip {
      border: 1px solid var(--line);
      background: var(--bg-elevated);
      border-radius: 999px;
      padding: 4px 14px;
      min-height: 34px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      color: var(--ink);
      font-weight: 600;
    }
    .capture-chip.active {
      border-color: var(--accent-strong);
      background: var(--accent-soft);
      box-shadow: inset 0 0 0 1px var(--accent);
    }
    .composer-control input {
      min-height: 46px;
      font-size: 16px;
      font-weight: 600;
    }
    .capture-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 10px;
      align-items: end;
    }
    .capture-actions-row {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
    }
    .action-hint { margin: 8px 0 0; color: var(--warning); }
    .notes-list { display: flex; flex-direction: column; gap: 0.75rem; margin-top: 1rem; }
    .note-row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 0.75rem;
      align-items: start;
      padding: 0.75rem;
      background: rgba(255,255,255,0.03);
      border-radius: 0.5rem;
      border: 1px solid rgba(255,255,255,0.05);
    }
    .note-content p { margin: 0; }
    .note-content .muted {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
      font-size: 0.8rem;
      margin-top: 0.25rem;
      color: var(--muted);
    }
    .note-linked {
      margin-top: 6px;
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .note-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      align-items: flex-start;
      gap: 6px;
    }
    .note-attachments {
      grid-column: 1 / -1;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 6px;
    }
    .note-attach-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 999px;
      border: 1px solid var(--line);
      background: var(--bg-elevated);
      font-size: 12px;
    }
    .note-attach-chip button {
      border: none;
      background: transparent;
      cursor: pointer;
      color: var(--muted);
      font-size: 14px;
      padding: 0;
      line-height: 1;
      min-height: 0;
    }
    .note-attach-chip button:disabled {
      cursor: not-allowed;
      opacity: 0.45;
    }
    .note-edit-grid {
      display: grid;
      grid-template-columns: minmax(0, 170px) minmax(0, 1fr);
      gap: 8px;
    }
    .ghost-action.danger {
      border-color: rgba(192, 57, 43, 0.32);
      color: var(--danger);
    }
    .ghost-action.active {
      border-color: var(--accent-strong);
      color: var(--accent-strong);
      background: var(--accent-soft);
    }
    .task-filter-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .empty-state.compact-empty {
      display: grid;
      gap: 4px;
      justify-items: center;
      text-align: center;
    }
    .linked-task-list {
      display: grid;
      gap: 8px;
    }
    .meeting-review-checklist {
      margin-top: 12px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--surface-strong);
      padding: 10px 12px;
      display: grid;
      gap: 6px;
    }
    .meeting-review-checklist strong {
      font-size: 12px;
      text-transform: uppercase;
      color: var(--muted);
    }
    .meeting-review-checklist ul {
      margin: 0;
      padding-left: 18px;
      display: grid;
      gap: 4px;
      font-size: 13px;
    }
    .meeting-review-checklist li.warn {
      color: var(--warning);
      font-weight: 700;
    }
    .meeting-review-checklist li.blocking {
      color: var(--danger);
      font-weight: 700;
    }
    .blocking-note {
      font-size: 11px;
      font-weight: 400;
      opacity: 0.8;
    }
    .checklist-link { cursor: pointer; }
    .checklist-link:hover { text-decoration: underline dotted; }
    .checklist-hint {
      font-size: 11px;
      font-weight: 400;
      opacity: 0.65;
      margin-left: 4px;
    }
    .char-counter {
      font-size: 11px;
      text-align: right;
      display: block;
      margin-top: 2px;
    }
    .linked-chip { background: var(--olive-soft); color: var(--olive); }
    .recap-preview {
      margin: 0;
      padding: 14px;
      background: var(--surface-strong);
      border: 1px solid var(--line);
      border-radius: 10px;
      font-family: ui-monospace, SFMono-Regular, "Cascadia Mono", Menlo, Consolas, monospace;
      font-size: 13px;
      white-space: pre-wrap;
      line-height: 1.5;
      max-height: 360px;
      overflow-y: auto;
    }
    .linked-task-card {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--bg-elevated);
      overflow: hidden;
    }
    .linked-task-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      padding: 10px;
      background: var(--bg-elevated);
    }
    .linked-task-title-btn {
      flex: 1;
      display: grid;
      gap: 2px;
      border: none;
      background: var(--bg-elevated);
      color: var(--ink);
      text-align: left;
      cursor: pointer;
      padding: 4px 0;
      min-width: 0;
    }
    .linked-task-title-btn:hover { background: var(--bg-hover); border-radius: 6px; }
    .linked-task-title-btn strong { display: block; }
    .linked-task-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }
    .progress-toggle { font-size: 11px; }
    .progression-notes-panel {
      border-top: 1px solid var(--line);
      padding: 10px;
      background: var(--surface-strong);
      display: grid;
      gap: 8px;
    }
    .progression-note-row {
      display: grid;
      gap: 2px;
      padding: 8px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--bg-elevated);
    }
    .progression-note-row p { margin: 0; font-size: 13px; }
    .progression-empty { padding: 4px 0; }
    .progression-add-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
    }
    a.ghost-action {
      display: inline-flex;
      align-items: center;
      text-decoration: none;
    }
    @media (max-width: 980px) {
      .plan-layout { grid-template-columns: 1fr; }
    }
    @media (max-width: 720px) {
      .form-grid { grid-template-columns: 1fr; }
      .customer-add-row { grid-template-columns: 1fr; }
      .note-row { grid-template-columns: 1fr; }
      .meeting-setup-summary { flex-direction: column; align-items: flex-start; }
      .capture-grid { grid-template-columns: 1fr; }
      .note-edit-grid { grid-template-columns: 1fr; }
    }
`;
