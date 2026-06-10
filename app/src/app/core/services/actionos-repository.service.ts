import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ActionosApiUserDto {
  userId: string;
  displayName: string;
  email: string;
  isActive?: boolean;
  azureObjectId?: string | null;
}

export interface ActionosApiClientSummaryDto {
  orgGroupId: string;
  displayName: string;
  description?: string | null;
}

export interface ActionosApiCustomerDto {
  id: string;
  orgGroupId: string;
  externalGroupId?: string | null;
  name: string;
  type: string;
  status: string;
  primaryContactName?: string | null;
  primaryContactEmail?: string | null;
  primaryContactPhone?: string | null;
  accountOwnerUserId?: string | null;
  accountOwnerDisplayName?: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface ActionosApiMeetingParticipantDto {
  id: number;
  isInternal: boolean;
  userId?: string | null;
  displayName: string;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
}

export interface ActionosApiMeetingNoteDto {
  id: number;
  meetingId: number;
  noteType: string;
  content: string;
  ownerUserId?: string | null;
  dueDateUtc?: string | null;
  convertedTaskId?: number | null;
  createdByUserId?: string | null;
  createdByUserName?: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface ActionosApiCustomerMeetingDto {
  id: number;
  orgGroupId: string;
  customerId: string;
  subject: string;
  meetingDateUtc: string;
  meetingLeaderUserId: string;
  meetingLeaderDisplayName?: string | null;
  goal?: string | null;
  summary?: string | null;
  publishedRecap?: string | null;
  nextMeetingDateUtc?: string | null;
  nextMeetingNotes?: string | null;
  status: string;
  createdAtUtc: string;
  updatedAtUtc: string;
  participants: ActionosApiMeetingParticipantDto[];
  notes: ActionosApiMeetingNoteDto[];
}

export interface ActionosApiTaskChecklistItemDto {
  id: number;
  label: string;
  isDone: boolean;
  sortOrder: number;
}

export interface ActionosApiTaskActivityNoteDto {
  id: number;
  noteType: string;
  content: string;
  authorUserId: string;
  authorUserName: string;
  createdAtUtc: string;
}

export interface ActionosApiTaskNotificationDto {
  id: number;
  eventType: string;
  channel: string;
  recipientUserId: string;
  sentAtUtc: string;
}

export interface ActionosApiTaskWatcherDto {
  id: number;
  taskId: number;
  userId: string;
  userDisplayName: string;
  createdAtUtc: string;
}

export interface ActionosApiTaskNoteDto {
  id: number;
  taskId: number;
  authorUserId: string;
  authorUserName: string;
  content: string;
  createdAtUtc: string;
}

export interface ActionosApiTaskDto {
  id: number;
  boardId?: number | null;
  orgGroupId: string;
  customerId?: string | null;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  sourceType?: string | null;
  sourceMeetingId?: number | null;
  waitingReason?: string | null;
  treatmentNotes?: string | null;
  openedByUserId?: string | null;
  openedByUserName?: string | null;
  assignedUserId?: string | null;
  assignedUserName?: string | null;
  dueDateUtc?: string | null;
  completedAtUtc?: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
  watchers: ActionosApiTaskWatcherDto[];
  notes: ActionosApiTaskNoteDto[];
  checklistItems: ActionosApiTaskChecklistItemDto[];
  activityNotes: ActionosApiTaskActivityNoteDto[];
  notifications: ActionosApiTaskNotificationDto[];
}

export interface ActionosApiAttachmentDto {
  id: number;
  orgGroupId: string;
  entityType: string;
  entityId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageUrl: string;
  uploadedByUserId: string;
  uploadedByUserName: string;
  uploadedAtUtc: string;
}

export interface ActionosBootstrapDto {
  orgGroupId: string;
  users: ActionosApiUserDto[];
  allowedOrgs: ActionosApiClientSummaryDto[];
  customers: ActionosApiCustomerDto[];
  meetings: ActionosApiCustomerMeetingDto[];
  tasks: ActionosApiTaskDto[];
  attachments: ActionosApiAttachmentDto[];
}

export interface CreateActionosCustomerRequest {
  orgGroupId: string;
  name: string;
  type: string;
  externalGroupId?: string | null;
  primaryContactName?: string | null;
  primaryContactEmail?: string | null;
  primaryContactPhone?: string | null;
  accountOwnerUserId?: string | null;
}

export interface UpdateActionosCustomerRequest {
  name?: string | null;
  type?: string | null;
  status?: string | null;
  externalGroupId?: string | null;
  primaryContactName?: string | null;
  primaryContactEmail?: string | null;
  primaryContactPhone?: string | null;
  accountOwnerUserId?: string | null;
}

export interface UpsertActionosMeetingParticipantRequest {
  isInternal: boolean;
  userId?: string | null;
  displayName: string;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
}

export interface CreateActionosCustomerMeetingRequest {
  subject: string;
  meetingDateUtc: string;
  meetingLeaderUserId: string;
  goal?: string | null;
  summary?: string | null;
  status?: string | null;
  participants: UpsertActionosMeetingParticipantRequest[];
}

export interface UpdateActionosCustomerMeetingRequest {
  subject?: string | null;
  meetingDateUtc?: string | null;
  meetingLeaderUserId?: string | null;
  goal?: string | null;
  summary?: string | null;
  publishedRecap?: string | null;
  nextMeetingDateUtc?: string | null;
  nextMeetingNotes?: string | null;
  status?: string | null;
  participants?: UpsertActionosMeetingParticipantRequest[] | null;
}

export interface CreateActionosCustomerMeetingNoteRequest {
  noteType: string;
  content: string;
  ownerUserId?: string | null;
  dueDateUtc?: string | null;
}

export interface UpdateActionosCustomerMeetingNoteRequest {
  noteType?: string | null;
  content?: string | null;
  ownerUserId?: string | null;
  dueDateUtc?: string | null;
}

export interface ConvertMeetingNoteToTaskRequest {
  title?: string | null;
  assignedUserId?: string | null;
  priority?: string | null;
  dueDateUtc?: string | null;
  waitingReason?: string | null;
}

export interface CreateActionosTaskChecklistItemRequest {
  label: string;
  isDone: boolean;
  sortOrder: number;
}

export interface CreateActionosTaskRequest {
  orgGroupId: string;
  boardId?: number | null;
  customerId?: string | null;
  title: string;
  description?: string | null;
  status?: string | null;
  priority?: string | null;
  sourceType?: string | null;
  sourceMeetingId?: number | null;
  waitingReason?: string | null;
  treatmentNotes?: string | null;
  assignedUserId?: string | null;
  dueDateUtc?: string | null;
  checklistItems?: CreateActionosTaskChecklistItemRequest[] | null;
}

export interface UpdateActionosTaskRequest {
  title?: string | null;
  description?: string | null;
  customerId?: string | null;
  status?: string | null;
  statusChangeReason?: string | null;
  priority?: string | null;
  waitingReason?: string | null;
  treatmentNotes?: string | null;
  assignedUserId?: string | null;
  dueDateUtc?: string | null;
}

export interface UpdateTaskChecklistItemRequest {
  label?: string | null;
  isDone?: boolean | null;
  sortOrder?: number | null;
}

export interface CreateActionosAttachmentRequest {
  orgGroupId: string;
  entityType: string;
  entityId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageUrl: string;
}

export interface UploadActionosAttachmentRequest {
  orgGroupId: string;
  entityType: string;
  entityId: string;
  file: File;
}

export interface ActionosTestEmailRequest {
  orgGroupId?: string | null;
}

export interface ActionosTestEmailResponse {
  delivered: boolean;
  recipientEmail: string;
  deliveredAtUtc: string;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ActionosRepositoryService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.actionosApiUrl.replace(/\/$/, '');

  private traceMutation(label: string, method: string, path: string, payload?: unknown): void {
    // Keep production diagnostics searchable without exposing tokens or response bodies.
    // eslint-disable-next-line no-console
    console.info(`[ActionOS API] ${label}: ${method} ${path}`, payload ?? '');
  }

  async bootstrap(orgGroupId: string): Promise<ActionosBootstrapDto> {
    return await firstValueFrom(
      this.http.get<ActionosBootstrapDto>(
        `${this.base}/api/actionos/bootstrap`,
        { params: { orgGroupId } }
      )
    );
  }

  async getOrgUsers(orgGroupId: string): Promise<ActionosApiUserDto[]> {
    return await firstValueFrom(
      this.http.get<ActionosApiUserDto[]>(
        `${this.base}/api/actionos/orgs/${encodeURIComponent(orgGroupId)}/users`
      )
    );
  }

  async createCustomer(request: CreateActionosCustomerRequest): Promise<ActionosApiCustomerDto> {
    return await firstValueFrom(
      this.http.post<ActionosApiCustomerDto>(`${this.base}/api/actionos/customers`, request)
    );
  }

  async updateCustomer(customerId: string, request: UpdateActionosCustomerRequest): Promise<ActionosApiCustomerDto> {
    return await firstValueFrom(
      this.http.patch<ActionosApiCustomerDto>(`${this.base}/api/actionos/customers/${encodeURIComponent(customerId)}`, request)
    );
  }

  async promoteProspect(customerId: string, externalGroupId: string): Promise<ActionosApiCustomerDto> {
    return await firstValueFrom(
      this.http.post<ActionosApiCustomerDto>(
        `${this.base}/api/actionos/customers/${encodeURIComponent(customerId)}/promote`,
        { externalGroupId }
      )
    );
  }

  async createCustomerMeeting(customerId: string, request: CreateActionosCustomerMeetingRequest): Promise<ActionosApiCustomerMeetingDto> {
    const path = `/api/actionos/customers/${encodeURIComponent(customerId)}/meetings`;
    this.traceMutation('createCustomerMeeting', 'POST', path, request);
    return await firstValueFrom(
      this.http.post<ActionosApiCustomerMeetingDto>(
        `${this.base}${path}`,
        request
      )
    );
  }

  async updateCustomerMeeting(meetingId: number, request: UpdateActionosCustomerMeetingRequest): Promise<ActionosApiCustomerMeetingDto> {
    const path = `/api/actionos/customers/meetings/${meetingId}`;
    this.traceMutation('updateCustomerMeeting', 'PATCH', path, request);
    return await firstValueFrom(
      this.http.patch<ActionosApiCustomerMeetingDto>(`${this.base}${path}`, request)
    );
  }

  async createCustomerMeetingNote(meetingId: number, request: CreateActionosCustomerMeetingNoteRequest): Promise<ActionosApiMeetingNoteDto> {
    const path = `/api/actionos/meetings/${meetingId}/notes`;
    this.traceMutation('createCustomerMeetingNote', 'POST', path, request);
    return await firstValueFrom(
      this.http.post<ActionosApiMeetingNoteDto>(
        `${this.base}${path}`,
        request
      )
    );
  }

  async updateCustomerMeetingNote(
    meetingId: number,
    noteId: number,
    request: UpdateActionosCustomerMeetingNoteRequest
  ): Promise<ActionosApiMeetingNoteDto> {
    const path = `/api/actionos/meetings/${meetingId}/notes/${noteId}`;
    this.traceMutation('updateCustomerMeetingNote', 'PATCH', path, request);
    return await firstValueFrom(
      this.http.patch<ActionosApiMeetingNoteDto>(
        `${this.base}${path}`,
        request
      )
    );
  }

  async deleteCustomerMeetingNote(meetingId: number, noteId: number): Promise<void> {
    const path = `/api/actionos/meetings/${meetingId}/notes/${noteId}`;
    this.traceMutation('deleteCustomerMeetingNote', 'DELETE', path);
    await firstValueFrom(
      this.http.delete(`${this.base}${path}`)
    );
  }

  async convertMeetingNoteToTask(
    meetingId: number,
    noteId: number,
    request: ConvertMeetingNoteToTaskRequest
  ): Promise<ActionosApiTaskDto> {
    return await firstValueFrom(
      this.http.post<ActionosApiTaskDto>(
        `${this.base}/api/actionos/meetings/${meetingId}/notes/${noteId}/convert-to-task`,
        request
      )
    );
  }

  async createTask(request: CreateActionosTaskRequest): Promise<ActionosApiTaskDto> {
    return await firstValueFrom(
      this.http.post<ActionosApiTaskDto>(`${this.base}/api/actionos/tasks`, request)
    );
  }

  async updateTask(taskId: number, request: UpdateActionosTaskRequest): Promise<ActionosApiTaskDto> {
    return await firstValueFrom(
      this.http.patch<ActionosApiTaskDto>(`${this.base}/api/actionos/tasks/${taskId}`, request)
    );
  }

  async sendTestEmail(request: ActionosTestEmailRequest): Promise<ActionosTestEmailResponse> {
    return await firstValueFrom(
      this.http.post<ActionosTestEmailResponse>(
        `${this.base}/api/actionos/notifications/test-email`,
        request
      )
    );
  }

  async deleteTask(taskId: number): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${this.base}/api/actionos/tasks/${taskId}`)
    );
  }

  async addTaskWatcher(taskId: number, userId: string): Promise<ActionosApiTaskDto> {
    return await firstValueFrom(
      this.http.post<ActionosApiTaskDto>(
        `${this.base}/api/actionos/tasks/${taskId}/watchers`,
        { userId }
      )
    );
  }

  async removeTaskWatcher(taskId: number, userId: string): Promise<ActionosApiTaskDto> {
    return await firstValueFrom(
      this.http.delete<ActionosApiTaskDto>(
        `${this.base}/api/actionos/tasks/${taskId}/watchers/${encodeURIComponent(userId)}`
      )
    );
  }

  async addTaskNote(taskId: number, content: string): Promise<ActionosApiTaskNoteDto> {
    return await firstValueFrom(
      this.http.post<ActionosApiTaskNoteDto>(
        `${this.base}/api/actionos/tasks/${taskId}/notes`,
        { content }
      )
    );
  }

  async addTaskActivityNote(taskId: number, noteType: string, content: string): Promise<ActionosApiTaskActivityNoteDto> {
    return await firstValueFrom(
      this.http.post<ActionosApiTaskActivityNoteDto>(
        `${this.base}/api/actionos/tasks/${taskId}/activity-notes`,
        { noteType, content }
      )
    );
  }

  async addTaskChecklistItem(taskId: number, label: string, isDone: boolean): Promise<ActionosApiTaskChecklistItemDto> {
    return await firstValueFrom(
      this.http.post<ActionosApiTaskChecklistItemDto>(
        `${this.base}/api/actionos/tasks/${taskId}/checklist`,
        { label, isDone }
      )
    );
  }

  async updateTaskChecklistItem(
    taskId: number,
    checklistItemId: number,
    request: UpdateTaskChecklistItemRequest
  ): Promise<ActionosApiTaskChecklistItemDto> {
    return await firstValueFrom(
      this.http.patch<ActionosApiTaskChecklistItemDto>(
        `${this.base}/api/actionos/tasks/${taskId}/checklist/${checklistItemId}`,
        request
      )
    );
  }

  async deleteTaskChecklistItem(taskId: number, checklistItemId: number): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${this.base}/api/actionos/tasks/${taskId}/checklist/${checklistItemId}`)
    );
  }

  async getAttachments(orgGroupId: string, entityType?: string, entityId?: string): Promise<ActionosApiAttachmentDto[]> {
    let params = new HttpParams().set('orgGroupId', orgGroupId);
    if (entityType) {
      params = params.set('entityType', entityType);
    }
    if (entityId) {
      params = params.set('entityId', entityId);
    }

    return await firstValueFrom(
      this.http.get<ActionosApiAttachmentDto[]>(`${this.base}/api/actionos/attachments`, { params })
    );
  }

  async createAttachment(request: CreateActionosAttachmentRequest): Promise<ActionosApiAttachmentDto> {
    return await firstValueFrom(
      this.http.post<ActionosApiAttachmentDto>(`${this.base}/api/actionos/attachments`, request)
    );
  }

  async uploadAttachment(request: UploadActionosAttachmentRequest): Promise<ActionosApiAttachmentDto> {
    const form = new FormData();
    form.set('orgGroupId', request.orgGroupId);
    form.set('entityType', request.entityType);
    form.set('entityId', request.entityId);
    form.set('file', request.file, request.file.name);

    return await firstValueFrom(
      this.http.post<ActionosApiAttachmentDto>(`${this.base}/api/actionos/attachments/upload`, form)
    );
  }

  async downloadAttachment(attachmentId: number): Promise<Blob> {
    return await firstValueFrom(
      this.http.get(`${this.base}/api/actionos/attachments/${attachmentId}/download`, {
        responseType: 'blob'
      })
    );
  }

  async deleteAttachment(attachmentId: number): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${this.base}/api/actionos/attachments/${attachmentId}`)
    );
  }
}
