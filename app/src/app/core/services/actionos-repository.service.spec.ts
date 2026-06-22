import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import {
  ActionosApiAttachmentDto,
  ActionosBootstrapDto,
  ActionosRepositoryService
} from './actionos-repository.service';

describe('ActionosRepositoryService org-free contracts', () => {
  let service: ActionosRepositoryService;
  let http: HttpTestingController;
  const base = environment.actionosApiUrl.replace(/\/$/, '');

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ActionosRepositoryService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });

    service = TestBed.inject(ActionosRepositoryService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('loads bootstrap globally without org query parameters', async () => {
    const promise = service.bootstrap();

    const request = http.expectOne(`${base}/api/actionos/bootstrap`);
    expect(request.request.method).toBe('GET');
    expect(request.request.params.has('orgGroupId')).toBeFalse();
    request.flush(emptyBootstrap());

    await expectAsync(promise).toBeResolved();
  });

  it('loads directory users from the global directory endpoint', async () => {
    const promise = service.getDirectoryUsers();

    const request = http.expectOne(`${base}/api/actionos/directory/users`);
    expect(request.request.method).toBe('GET');
    request.flush([]);

    await expectAsync(promise).toBeResolvedTo([]);
  });

  it('saves mail notification preferences globally for the current user', async () => {
    const promise = service.updateMailNotificationPreferences({ newTasks: false });

    const request = http.expectOne(`${base}/api/actionos/me/mail-notification-preferences`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ newTasks: false });
    request.flush({
      newTasks: false,
      overdueTasks: true,
      dueTodayTasks: true,
      meetingSummaries: true
    });

    await expectAsync(promise).toBeResolved();
  });

  it('creates tasks without sending orgGroupId', async () => {
    const promise = service.createTask({
      title: 'Follow up',
      customerId: 'local-1'
    });

    const request = http.expectOne(`${base}/api/actionos/tasks`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body.orgGroupId).toBeUndefined();
    expect(JSON.stringify(request.request.body)).not.toContain('orgGroupId');
    request.flush({ ...emptyTask(), title: 'Follow up', customerId: 'local-1' });

    await expectAsync(promise).toBeResolved();
  });

  it('uploads attachments without orgGroupId form data', async () => {
    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });
    const promise = service.uploadAttachment({
      entityType: 'Task',
      entityId: '42',
      file
    });

    const request = http.expectOne(`${base}/api/actionos/attachments/upload`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body instanceof FormData).toBeTrue();
    const body = request.request.body as FormData;
    expect(body.get('entityType')).toBe('Task');
    expect(body.get('entityId')).toBe('42');
    expect(body.has('orgGroupId')).toBeFalse();
    request.flush(emptyAttachment());

    await expectAsync(promise).toBeResolved();
  });
});

function emptyBootstrap(): ActionosBootstrapDto {
  return {
    access: null,
    users: [],
    customers: [],
    meetings: [],
    tasks: [],
    attachments: [],
    mailNotificationPrefs: {
      newTasks: true,
      overdueTasks: true,
      dueTodayTasks: true,
      meetingSummaries: true
    }
  };
}

function emptyTask() {
  return {
    id: 1,
    boardId: null,
    customerId: null,
    title: '',
    description: null,
    status: 'New',
    priority: 'Medium',
    sourceType: null,
    sourceMeetingId: null,
    waitingReason: null,
    treatmentNotes: null,
    openedByUserId: null,
    openedByUserName: null,
    assignedUserId: null,
    assignedUserName: null,
    dueDateUtc: null,
    completedAtUtc: null,
    createdAtUtc: '2026-06-22T00:00:00Z',
    updatedAtUtc: '2026-06-22T00:00:00Z',
    watchers: [],
    notes: [],
    checklistItems: [],
    activityNotes: [],
    notifications: []
  };
}

function emptyAttachment(): ActionosApiAttachmentDto {
  return {
    id: 1,
    entityType: 'Task',
    entityId: '42',
    fileName: 'hello.txt',
    mimeType: 'text/plain',
    sizeBytes: 5,
    storageUrl: 'mock://hello.txt',
    uploadedByUserId: 'tester',
    uploadedByUserName: 'Tester',
    uploadedAtUtc: '2026-06-22T00:00:00Z'
  };
}
