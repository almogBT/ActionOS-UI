import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import {
  MeetingTask,
  MeetingTaskStatus,
  Priority,
  TaskItem
} from '../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';

@Component({
  selector: 'app-task-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './task-drawer.component.html'
})
export class TaskDrawerComponent {
  readonly priorities: Priority[] = ['Low', 'Medium', 'High', 'Critical'];

  checklistText = '';
  commentText = '';

  constructor(public workspace: ActionosWorkspaceService) {}

  // ─── Board task (legacy) ──────────────────────────────────────────

  updateSingleAssignee(task: TaskItem, assigneeId: string): void {
    this.workspace.updateTask(task.id, { assigneeIds: assigneeId ? [assigneeId] : [] });
  }

  toggleWatcher(task: TaskItem, memberId: string, checked: boolean): void {
    const watcherIds = checked
      ? Array.from(new Set([...task.watcherIds, memberId]))
      : task.watcherIds.filter(id => id !== memberId);

    this.workspace.updateTask(task.id, { watcherIds });
  }

  addChecklistItem(task: TaskItem): void {
    this.workspace.addChecklistItem(task, this.checklistText);
    this.checklistText = '';
  }

  addComment(task: TaskItem): void {
    this.workspace.addTaskComment(task, this.commentText);
    this.commentText = '';
  }

  // ─── Meeting task (v3) ────────────────────────────────────────────

  updateMeetingTaskField<K extends keyof MeetingTask>(
    task: MeetingTask,
    field: K,
    value: MeetingTask[K]
  ): void {
    this.workspace.updateMeetingTask(task.id, { [field]: value } as Partial<MeetingTask>);
  }

  updateMeetingTaskStatus(task: MeetingTask, status: MeetingTaskStatus): void {
    this.workspace.updateMeetingTask(task.id, { status });
  }
}
