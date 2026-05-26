import { Attachment, AttachmentEntityType } from '../models/actionos.models';

/**
 * Attachment storage boundary.
 *
 * Future Fritz/Azure implementation: reuse the SharePoint upload pattern already
 * in FritzCustomersApi (api/meeting/* endpoints). HomePage_Server proxies the
 * upload and returns a SharePoint URL.
 *
 * In v3 the mock adapter creates a fake URL ("mock://<id>") — there is no real
 * file storage, so the URL is not openable. The UI surfaces this with a
 * "Attachments (mock)" hint.
 */
export interface AttachmentStoragePort {
  list(entityType: AttachmentEntityType, entityId: string): Attachment[];
  upload(
    file: File,
    entityType: AttachmentEntityType,
    entityId: string,
    uploadedByEmployeeId: string,
  ): Promise<Attachment>;
  remove(id: string): void;
}

interface AttachmentState {
  attachments: Attachment[];
}

export class InMemoryAttachmentStorage implements AttachmentStoragePort {
  constructor(
    private readonly state: AttachmentState,
    private readonly save: () => void,
    private readonly idFactory: () => string,
    private readonly now: () => string,
  ) {}

  list(entityType: AttachmentEntityType, entityId: string): Attachment[] {
    return this.state.attachments.filter(
      (a) => a.linkedEntityType === entityType && a.linkedEntityId === entityId,
    );
  }

  async upload(
    file: File,
    entityType: AttachmentEntityType,
    entityId: string,
    uploadedByEmployeeId: string,
  ): Promise<Attachment> {
    const id = this.idFactory();
    const attachment: Attachment = {
      id,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      url: `mock://${id}`,
      linkedEntityType: entityType,
      linkedEntityId: entityId,
      uploadedAt: this.now(),
      uploadedByEmployeeId,
    };
    this.state.attachments.push(attachment);
    this.save();
    return attachment;
  }

  remove(id: string): void {
    const index = this.state.attachments.findIndex((a) => a.id === id);
    if (index !== -1) {
      this.state.attachments.splice(index, 1);
      this.save();
    }
  }
}
