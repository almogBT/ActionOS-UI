import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActionosI18nService } from '../../core/i18n/actionos-i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import {
  Customer, CustomerMeeting, Member, TaskStatus, Task, Priority, ViewId } from '../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';
import { SearchableSelectComponent, SelectOption } from '../../shared/searchable-select/searchable-select.component';

export type BoardEntityType = 'client' | 'member';

@Component({
  selector: 'app-boards',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, SearchableSelectComponent],
  templateUrl: './boards.component.html',
  styleUrl: './boards.component.scss'
})
export class BoardsComponent {
  @Output() viewChange = new EventEmitter<ViewId>();

  readonly priorities: Priority[] = ['Low', 'Medium', 'High', 'Critical'];

  entityType: BoardEntityType = 'client';
  selectedClientId = '';
  selectedMemberId = '';
  boardSearch = '';
  memberStatusFilter: TaskStatus | 'All' = 'All';

  constructor(public workspace: ActionosWorkspaceService, private i18n: ActionosI18nService) {
    const clients = workspace.customers;
    if (clients.length) {
      this.selectedClientId = clients[0].id;
    }
    const members = workspace.members;
    if (members.length) {
      this.selectedMemberId = members[0].id;
    }
  }

  get selectedClient(): Customer | null {
    return this.workspace.customers.find(c => c.id === this.selectedClientId) ?? null;
  }

  get selectedMember(): Member | null {
    return this.workspace.members.find(m => m.id === this.selectedMemberId) ?? null;
  }

  get boardTypeOptions(): SelectOption[] {
    return [
      { value: 'client', label: this.i18n.translate('boards.clientBoard') },
      { value: 'member', label: this.i18n.translate('boards.memberBoard') }
    ];
  }

  get clientSelectOptions(): SelectOption[] {
    return this.workspace.customers.map(c => ({ value: c.id, label: c.name }));
  }

  get memberSelectOptions(): SelectOption[] {
    return this.workspace.members.map(m => ({ value: m.id, label: m.name }));
  }

  get memberStatusFilterOptions(): SelectOption[] {
    return [
      { value: 'All', label: this.i18n.translate('noteType.all') },
      ...this.workspace.statuses.map(s => ({
        value: s, label: this.i18n.translate('status.' + this.workspace.statusClass(s))
      }))
    ];
  }

  get taskStatusOptions(): SelectOption[] {
    return this.workspace.statuses.map(s => ({
      value: s, label: this.i18n.translate('status.' + this.workspace.statusClass(s))
    }));
  }

  get priorityOptions(): SelectOption[] {
    return this.priorities.map(p => ({
      value: p, label: this.i18n.translate('priority.' + this.workspace.statusClass(p))
    }));
  }

  // ── Client board ─────────────────────────────────────────────────────

  get clientMeetings(): CustomerMeeting[] {
    if (!this.selectedClientId) return [];
    const meetings = this.workspace.customerMeetingsByCustomer(this.selectedClientId)
      .slice()
      .sort((a, b) => b.meetingDate.localeCompare(a.meetingDate));
    if (!this.boardSearch) return meetings;
    const q = this.boardSearch.toLowerCase();
    return meetings.filter(m =>
      m.subject.toLowerCase().includes(q) ||
      m.status.toLowerCase().includes(q) ||
      this.workspace.employeeName(m.meetingLeaderEmployeeId).toLowerCase().includes(q)
    );
  }

  get clientAllTasks(): Task[] {
    if (!this.selectedClientId) return [];
    const id = this.selectedClientId;
    const combined = this.workspace.meetingTasksByCustomer(id);
    if (!this.boardSearch) return combined;
    const q = this.boardSearch.toLowerCase();
    return combined.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.status.toLowerCase().includes(q) ||
      this.workspace.employeeName(t.assignedToEmployeeId).toLowerCase().includes(q)
    );
  }

  get clientMeetingCount(): number {
    if (!this.selectedClientId) return 0;
    return this.workspace.customerMeetingsByCustomer(this.selectedClientId).length;
  }

  get clientTotalTaskCount(): number {
    if (!this.selectedClientId) return 0;
    return this.workspace.meetingTasksByCustomer(this.selectedClientId).length;
  }

  get clientOpenTaskCount(): number {
    if (!this.selectedClientId) return 0;
    return this.workspace.meetingTasksByCustomer(this.selectedClientId)
      .filter(t => this.workspace.isOpenMeetingTaskStatus(t.status)).length;
  }

  meetingTaskCountFor(meetingId: string): number {
    return this.workspace.meetingTasksByMeeting(meetingId).length;
  }

  // ── Member board ─────────────────────────────────────────────────────

  get memberTasks(): Task[] {
    return [];
  }

  get memberMeetingTasks(): Task[] {
    if (!this.selectedMemberId) return [];
    const base = this.memberMeetingBaseTasks(this.selectedMemberId);
    const byStatus = this.memberStatusFilter === 'All'
      ? base
      : base.filter(t => this.meetingMatchesStatusFilter(t.status, this.memberStatusFilter));
    if (!this.boardSearch) return byStatus;
    const q = this.boardSearch.toLowerCase();
    return byStatus.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.status.toLowerCase().includes(q) ||
      (this.workspace.customer(t.customerId)?.name?.toLowerCase().includes(q) ?? false)
    );
  }

  get memberTotalCount(): number {
    if (!this.selectedMemberId) return 0;
    return this.memberMeetingBaseTasks(this.selectedMemberId).length;
  }

  get memberOpenCount(): number {
    if (!this.selectedMemberId) return 0;
    return this.memberMeetingBaseTasks(this.selectedMemberId)
      .filter(t => this.workspace.isOpenMeetingTaskStatus(t.status)).length;
  }

  get memberBlockedCount(): number {
    if (!this.selectedMemberId) return 0;
    return this.memberMeetingBaseTasks(this.selectedMemberId).filter(
      t => t.status === 'Waiting For Customer' || t.status === 'Waiting For Internal'
    ).length;
  }

  // ── HUD popup ────────────────────────────────────────────────────────

  hudPopup: 'meetings' | 'total-tasks' | 'open-tasks' | 'blocked' | null = null;

  toggleHudPopup(type: 'meetings' | 'total-tasks' | 'open-tasks' | 'blocked'): void {
    this.hudPopup = this.hudPopup === type ? null : type;
  }

  get hudPopupLabel(): string {
    switch (this.hudPopup) {
      case 'meetings':    return this.i18n.translate('boards.meetings');
      case 'total-tasks': return this.i18n.translate('boards.totalTasks');
      case 'open-tasks':  return this.i18n.translate('boards.openTasks');
      case 'blocked':     return this.i18n.translate('boards.blocked');
      default:            return '';
    }
  }

  get hudPopupMeetings(): CustomerMeeting[] {
    if (!this.selectedClientId) return [];
    return this.workspace.customerMeetingsByCustomer(this.selectedClientId)
      .slice().sort((a, b) => b.meetingDate.localeCompare(a.meetingDate));
  }

  get hudPopupTasks(): Task[] {
    if (this.entityType === 'client') {
      if (!this.selectedClientId) return [];
      const id = this.selectedClientId;
      const all = this.workspace.meetingTasksByCustomer(id);
      if (this.hudPopup === 'open-tasks') return all.filter(t =>
        this.workspace.isOpenMeetingTaskStatus(t.status)
      );
      return all;
    }
    const all = this.allMemberTasksForHud;
    if (this.hudPopup === 'open-tasks') return all.filter(t => t.status !== 'Done' && t.status !== 'Cancelled');
    if (this.hudPopup === 'blocked') return all.filter(t =>
      !!t.blockedBy || t.status === 'Waiting' || t.status === 'Waiting For Customer' || t.status === 'Waiting For Internal'
    );
    return all;
  }

  private get allMemberTasksForHud(): Task[] {
    if (!this.selectedMemberId) return [];
    const id = this.selectedMemberId;
    return this.memberMeetingBaseTasks(id);
  }

  openHudTask(task: Task): void {
    this.workspace.selectMeetingTask(task);
    this.hudPopup = null;
  }

  // ── Navigation ────────────────────────────────────────────────────────

  openView(view: ViewId): void {
    this.viewChange.emit(view);
  }

  onEntityTypeChange(): void {
    this.boardSearch = '';
    this.memberStatusFilter = 'All';
    this.hudPopup = null;
  }

  openMeetingTask(task: Task): void {
    this.workspace.selectMeetingTask(task);
  }

  private meetingMatchesStatusFilter(
    meetingStatus: TaskStatus,
    filter: TaskStatus | 'All'
  ): boolean {
    if (filter === 'All') return true;
    if (meetingStatus === filter) return true;
    if (filter === 'Done') return meetingStatus === 'Done';
    if (filter === 'Waiting') {
      return meetingStatus === 'Waiting For Customer' || meetingStatus === 'Waiting For Internal';
    }
    if (filter === 'In Progress') return meetingStatus === 'In Progress';
    if (filter === 'Planned') return meetingStatus === 'Sent To Owner';
    if (filter === 'Inbox') return meetingStatus === 'New';
    return true;
  }

  private memberMeetingBaseTasks(memberId: string): Task[] {
    const employeeId = this.workspace.employeeIdForMember(memberId);
    if (!employeeId) {
      return [];
    }
    return this.workspace.meetingTasks.filter(t =>
      t.assignedToEmployeeId === employeeId || t.openedByEmployeeId === employeeId
    );
  }
}
