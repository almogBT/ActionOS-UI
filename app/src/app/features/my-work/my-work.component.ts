import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { MeetingTask, MyWorkTab, Priority, TaskItem, ViewId } from '../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';

@Component({
  selector: 'app-my-work',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './my-work.component.html'
})
export class MyWorkComponent {
  @Output() viewChange = new EventEmitter<ViewId>();

  readonly tabs: { id: MyWorkTab; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'upcoming', label: 'Upcoming' },
    { id: 'watched', label: 'Watched' },
    { id: 'blocked', label: 'Blocked' }
  ];
  readonly priorities: Priority[] = ['Low', 'Medium', 'High', 'Critical'];

  activeTab: MyWorkTab = 'today';
  commentText = '';

  constructor(public workspace: ActionosWorkspaceService) {}

  get displayedTasks(): TaskItem[] {
    return this.workspace.myWorkTasks(this.activeTab);
  }

  get displayedMeetingTasks(): MeetingTask[] {
    return this.workspace.myWorkMeetingTasks(this.activeTab);
  }

  openMeetingTask(task: MeetingTask): void {
    this.workspace.selectMeetingTask(task);
  }

  openView(view: ViewId): void {
    this.viewChange.emit(view);
  }

  setTab(tab: MyWorkTab): void {
    this.activeTab = tab;
  }

  updateSingleAssignee(task: TaskItem, assigneeId: string): void {
    this.workspace.updateTask(task.id, { assigneeIds: assigneeId ? [assigneeId] : [] });
  }

  toggleWatcher(task: TaskItem, memberId: string, checked: boolean): void {
    const watcherIds = checked
      ? Array.from(new Set([...task.watcherIds, memberId]))
      : task.watcherIds.filter(id => id !== memberId);

    this.workspace.updateTask(task.id, { watcherIds });
  }

  addComment(task: TaskItem): void {
    this.workspace.addTaskComment(task, this.commentText);
    this.commentText = '';
  }
}
