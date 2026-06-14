import { BoardTemplate, NavItem, ViewId } from '../models/actionos.models';

/**
 * Feature visibility switches — the single source of truth for hiding a feature
 * WITHOUT deleting it. Flip a flag to `false` to hide the feature everywhere; flip
 * it back to `true` to fully restore it. The components, views and data paths stay
 * intact, so there is no regression risk and nothing to re-implement.
 *
 * Gate UI off these flags (via `VISIBLE_NAV_ITEMS` / `isViewEnabled()` / a template
 * `*ngIf`) rather than commenting code out.
 */
export const ACTIONOS_FEATURES = {
  /** Task priority — the priority chip/column and every priority-driven
   *  control (sort-by-priority, bulk set-priority, group-by-priority, the
   *  creation-form selector). Flip to `false` to hide priority everywhere;
   *  the `Task.priority` data and code paths stay intact. */
  taskPriority: false,
  /** Task checklist / steps — the checklist progress bar, the expandable
   *  interactive step list and the add-step controls, in the task form and the
   *  shared task table. Flip to `false` to hide checklists everywhere; the
   *  `Task.checklist` data and code paths stay intact. */
  taskChecklist: false,
  /** Task "Activity" panel in the task form — the comments box + comment list
   *  and the watchers block, plus its step in the progress stepper. Flip to
   *  `false` to hide the whole panel; comments/watchers data and code paths
   *  stay intact. */
  taskActivity: false,
  /** "My Work" landing page and its nav tab. */
  myWork: false,
  /** "Boards" — the client board page — and its nav tab. */
  boards: false,
  /** Bottom quick-action bar (Plan meeting · Quick capture · New meeting). */
  quickActionBar: false,
  /** "Needs your attention" carousel on the Meetings page. */
  meetingsAttentionRail: false,
  /** Header theme (light/dark) toggle button. */
  headerThemeButton: false,
  /** Header notifications (bell) button + popover. */
  headerNotifications: false,
  /** Header user chip (avatar + name + menu). The Settings gear stays, and the
   *  signed-in user is visible in the unified system, so this is redundant here. */
  headerUserMenu: false
} as const;

export const ACTIONOS_NAV_ITEMS: NavItem[] = [
  // My Work is the landing view (the former Home page was merged into it).
  { id: 'my-work', label: 'My Work', shortcut: 'M', section: 'main' },
  { id: 'meetings', label: 'Meetings', shortcut: 'N', section: 'main' },
  { id: 'tasks', label: 'Tasks', shortcut: 'K', section: 'main' },
  { id: 'boards', label: 'Boards', shortcut: 'B', section: 'work' }
];

/** Maps a view to the feature flag that governs it (views absent here always show). */
const NAV_FEATURE_GATE: Partial<Record<ViewId, keyof typeof ACTIONOS_FEATURES>> = {
  'my-work': 'myWork',
  boards: 'boards'
};

/** True when a view is currently allowed to be shown (its flag is on, or ungated). */
export function isViewEnabled(view: ViewId): boolean {
  const gate = NAV_FEATURE_GATE[view];
  return gate ? ACTIONOS_FEATURES[gate] : true;
}

/** Nav items the current feature flags allow — what the header should render. */
export const VISIBLE_NAV_ITEMS: NavItem[] = ACTIONOS_NAV_ITEMS.filter(item => isViewEnabled(item.id));

/** Landing / fallback view: the first visible primary nav item. */
export const DEFAULT_VIEW: ViewId = VISIBLE_NAV_ITEMS[0]?.id ?? 'meetings';

export const ACTIONOS_BOARD_TEMPLATES: BoardTemplate[] = [
  {
    id: 'template-project',
    name: 'Project launch',
    description: 'Kickoff, delivery, risk, and launch follow-up.',
    board: 'Project Launch',
    tasks: [
      { title: 'Confirm launch owner', description: 'Name the person accountable for launch coordination.', board: 'Project Launch', priority: 'High', dueDate: '2026-06-03' },
      { title: 'Prepare project risk list', description: 'Capture top risks and mitigation owners.', board: 'Project Launch', priority: 'Medium', dueDate: '2026-06-04' },
      { title: 'Run launch review meeting', description: 'Review go/no-go status with stakeholders.', board: 'Project Launch', priority: 'High', dueDate: '2026-06-06' }
    ]
  },
  {
    id: 'template-meeting',
    name: 'Meeting follow-up',
    description: 'Standard board for recurring meeting actions.',
    board: 'Meeting Follow-up',
    tasks: [
      { title: 'Collect unresolved actions', description: 'Bring open actions from the previous meeting.', board: 'Meeting Follow-up', priority: 'High', dueDate: '2026-05-30' },
      { title: 'Publish decisions summary', description: 'Share decisions and owners after the meeting.', board: 'Meeting Follow-up', priority: 'Medium', dueDate: '2026-05-31' }
    ]
  },
  {
    id: 'template-customer',
    name: 'Customer onboarding',
    description: 'A lightweight onboarding checklist for new customers.',
    board: 'Customer Onboarding',
    tasks: [
      { title: 'Create customer workspace', description: 'Set up initial workspace and access.', board: 'Customer Onboarding', priority: 'High', dueDate: '2026-06-03' },
      { title: 'Schedule onboarding meeting', description: 'Book first customer onboarding sync.', board: 'Customer Onboarding', priority: 'Medium', dueDate: '2026-06-05' },
      { title: 'Confirm success criteria', description: 'Capture goals and handoff expectations.', board: 'Customer Onboarding', priority: 'High', dueDate: '2026-06-07' }
    ]
  },
  {
    id: 'template-bug',
    name: 'Bug tracker',
    description: 'Triage, reproduce, fix, and verify defects.',
    board: 'Bug Tracker',
    tasks: [
      { title: 'Triage incoming bug', description: 'Confirm priority and owner.', board: 'Bug Tracker', priority: 'High', dueDate: '2026-05-31' },
      { title: 'Reproduce issue', description: 'Record steps and expected behavior.', board: 'Bug Tracker', priority: 'Medium', dueDate: '2026-06-01' },
      { title: 'Verify fix', description: 'Retest after implementation.', board: 'Bug Tracker', priority: 'Medium', dueDate: '2026-06-04' }
    ]
  }
];
