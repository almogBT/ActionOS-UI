import { BoardTemplate, NavItem } from '../models/actionos.models';

export const ACTIONOS_NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Home', shortcut: 'H', section: 'main' },
  { id: 'meetings', label: 'Meetings', shortcut: 'N', section: 'main' },
  { id: 'tasks', label: 'Tasks', shortcut: 'K', section: 'main' },
  { id: 'my-work', label: 'My Work', shortcut: 'M', section: 'work' },
  { id: 'boards', label: 'Boards', shortcut: 'B', section: 'work' }
];

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
