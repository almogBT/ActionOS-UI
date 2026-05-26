import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { CreateTaskInput, Priority, TaskItem, TaskStatus, ViewId } from '../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';

@Component({
  selector: 'app-boards',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './boards.component.html'
})
export class BoardsComponent {
  @Output() viewChange = new EventEmitter<ViewId>();

  readonly priorities: Priority[] = ['Low', 'Medium', 'High', 'Critical'];
  readonly boardViews: { id: 'table' | 'kanban' | 'calendar' | 'workload'; label: string }[] = [
    { id: 'table', label: 'Table' },
    { id: 'kanban', label: 'Kanban' },
    { id: 'calendar', label: 'Calendar' },
    { id: 'workload', label: 'Workload' }
  ];
  query = '';
  statusFilter: TaskStatus | 'All' = 'All';
  boardView: 'table' | 'kanban' | 'calendar' | 'workload' = 'table';
  selectedTemplateId = '';
  newTask: CreateTaskInput = this.getEmptyTask();

  constructor(public workspace: ActionosWorkspaceService) {}

  get filteredTasks(): TaskItem[] {
    const normalizedQuery = this.query.trim().toLowerCase();

    return this.workspace.tasks.filter(task => {
      const matchesSearch = !normalizedQuery
        || task.title.toLowerCase().includes(normalizedQuery)
        || task.board.toLowerCase().includes(normalizedQuery)
        || task.priority.toLowerCase().includes(normalizedQuery)
        || task.description.toLowerCase().includes(normalizedQuery);
      const matchesStatus = this.statusFilter === 'All' || task.status === this.statusFilter;

      return matchesSearch && matchesStatus;
    });
  }

  openView(view: ViewId): void {
    this.viewChange.emit(view);
  }

  filteredTasksByStatus(status: TaskStatus): TaskItem[] {
    return this.filteredTasks.filter(task => task.status === status);
  }

  tasksDueIn(bucket: 'today' | 'week' | 'later'): TaskItem[] {
    const today = this.workspace.todayIso;
    const week = this.workspace.dateAfter(7);

    if (bucket === 'today') {
      return this.filteredTasks.filter(task => task.dueDate <= today);
    }

    if (bucket === 'week') {
      return this.filteredTasks.filter(task => task.dueDate > today && task.dueDate <= week);
    }

    return this.filteredTasks.filter(task => task.dueDate > week);
  }

  tasksForMember(memberId: string): TaskItem[] {
    return this.filteredTasks.filter(task => task.assigneeIds.includes(memberId) && task.status !== 'Done');
  }

  addTask(): void {
    if (!this.newTask.title.trim()) {
      return;
    }

    this.workspace.addTask(this.newTask);
    this.newTask = this.getEmptyTask();
  }

  updateSingleAssignee(task: TaskItem, assigneeId: string): void {
    this.workspace.updateTask(task.id, { assigneeIds: assigneeId ? [assigneeId] : [] });
  }

  applyTemplate(): void {
    if (!this.selectedTemplateId) {
      return;
    }

    this.workspace.applyTemplate(this.selectedTemplateId);
    this.selectedTemplateId = '';
  }

  private getEmptyTask(): CreateTaskInput {
    return {
      title: '',
      description: '',
      board: 'ActionOS Core',
      priority: 'Medium',
      dueDate: '2026-05-30',
      assigneeId: this.workspace?.currentUserId ?? 'u1'
    };
  }
}
