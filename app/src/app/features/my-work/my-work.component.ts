import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { CustomerMeeting, MeetingNote, Task, ViewId } from '../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';
import { InboxComponent } from '../inbox/inbox.component';

export type MeetingFilter = 'upcoming' | 'led' | 'past';
export type TaskFilter = 'mine' | 'delegated' | 'all-involved';

@Component({
  selector: 'app-my-work',
  standalone: true,
  imports: [CommonModule, TranslatePipe, InboxComponent],
  templateUrl: './my-work.component.html',
  styleUrl: './my-work.component.scss'
})
export class MyWorkComponent {
  @Output() viewChange = new EventEmitter<ViewId>();

  readonly workspace = inject(ActionosWorkspaceService);

  readonly activeTab = signal<'inbox' | 'tasks' | 'meetings'>('inbox');

  meetingFilter: MeetingFilter = 'upcoming';
  taskFilter: TaskFilter = 'mine';

  readonly meetingFilterOptions: { id: MeetingFilter; labelKey: string }[] = [
    { id: 'upcoming', labelKey: 'myWork.meetings.upcoming' },
    { id: 'led',      labelKey: 'myWork.meetings.led' },
    { id: 'past',     labelKey: 'myWork.meetings.past' }
  ];

  readonly taskFilterOptions: { id: TaskFilter; labelKey: string }[] = [
    { id: 'mine',         labelKey: 'myWork.tasks.mine' },
    { id: 'delegated',    labelKey: 'myWork.tasks.delegated' },
    { id: 'all-involved', labelKey: 'myWork.tasks.allInvolved' }
  ];

  // ── Meetings ────────────────────────────────────────────────────────────────

  get myMeetings(): CustomerMeeting[] {
    const empId = this.workspace.currentEmployeeId;
    const all = this.workspace.customerMeetings;
    const isMine = (m: CustomerMeeting) =>
      m.meetingLeaderEmployeeId === empId || m.internalParticipantEmployeeIds.includes(empId);

    switch (this.meetingFilter) {
      case 'upcoming': return all.filter(m => isMine(m) && m.status !== 'Closed');
      case 'led':      return all.filter(m => m.meetingLeaderEmployeeId === empId && m.status !== 'Closed');
      case 'past':     return all.filter(m => isMine(m) && m.status === 'Closed');
      default:         return [];
    }
  }

  isMeetingLed(m: CustomerMeeting): boolean {
    return m.meetingLeaderEmployeeId === this.workspace.currentEmployeeId;
  }

  meetingTaskCount(m: CustomerMeeting): number {
    return this.workspace.meetingTasksByMeeting(m.id).length;
  }

  meetingActionItems(m: CustomerMeeting): MeetingNote[] {
    return m.notes.filter(n => n.type === 'action' && !n.convertedTaskId);
  }

  // ── Tasks ───────────────────────────────────────────────────────────────────

  get myFilteredTasks(): Task[] {
    const empId = this.workspace.currentEmployeeId;
    const active = this.workspace.meetingTasks.filter(
      t => t.status !== 'Done' && t.status !== 'Cancelled'
    );

    switch (this.taskFilter) {
      case 'mine':
        return active.filter(t => t.assignedToEmployeeId === empId);
      case 'delegated':
        return active.filter(t => t.openedByEmployeeId === empId && t.assignedToEmployeeId !== empId);
      case 'all-involved':
        return active.filter(t => t.assignedToEmployeeId === empId || t.openedByEmployeeId === empId);
      default:
        return [];
    }
  }

  get myGroupedTasks(): Array<{ id: string; labelKey: string; tasks: Task[]; isDanger: boolean }> {
    const tasks   = this.myFilteredTasks;
    const today   = this.workspace.todayIso;
    const weekEnd = this.workspace.dateAfter(7);

    const overdue  = tasks.filter(t => !!t.dueDate && t.dueDate < today);
    const dueToday = tasks.filter(t => !!t.dueDate && t.dueDate === today);
    const thisWeek = tasks.filter(t => !!t.dueDate && t.dueDate > today && t.dueDate <= weekEnd);
    const later    = tasks.filter(t => !t.dueDate  || t.dueDate > weekEnd);

    const groups: Array<{ id: string; labelKey: string; tasks: Task[]; isDanger: boolean }> = [];
    if (overdue.length)  groups.push({ id: 'overdue',  labelKey: 'myWork.groups.overdue',  tasks: overdue,  isDanger: true  });
    if (dueToday.length) groups.push({ id: 'today',    labelKey: 'myWork.groups.today',    tasks: dueToday, isDanger: false });
    if (thisWeek.length) groups.push({ id: 'thisWeek', labelKey: 'myWork.groups.thisWeek', tasks: thisWeek, isDanger: false });
    if (later.length)    groups.push({ id: 'later',    labelKey: 'myWork.groups.later',    tasks: later,    isDanger: false });
    return groups;
  }

  get hasMyTasks(): boolean {
    return this.myGroupedTasks.length > 0;
  }

  isOverdue(task: Task): boolean {
    return !!task.dueDate && task.dueDate < this.workspace.todayIso && task.status !== 'Done';
  }

  isHighPriority(task: Task): boolean {
    const cls = this.workspace.statusClass(task.priority);
    return cls === 'high' || cls === 'critical';
  }

  taskContext(task: Task): string {
    return task.source === 'meeting'
      ? (this.workspace.customer(task.customerId)?.name ?? '')
      : task.board;
  }

  getInitials(name: string): string {
    return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  openMeetingTask(task: Task): void {
    this.workspace.selectMeetingTask(task);
  }

  // ── Navigation ──────────────────────────────────────────────────────────────

  openView(view: ViewId): void {
    this.viewChange.emit(view);
  }

  openMeetingInView(m: CustomerMeeting): void {
    this.workspace.openMeetingDrawer(m.id);
  }
}
