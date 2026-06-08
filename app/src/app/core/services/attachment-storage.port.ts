import { Attachment, AttachmentEntityType } from '../models/actionos.models';

/**
 * Attachment storage boundary.
 *
 * Future Fritz/Azure implementation: reuse the SharePoint upload pattern already
 * in FritzCustomersApi (api/meeting/* endpoints). HomePage_Server proxies the
 * upload and returns a SharePoint URL.
 *
 * This local adapter only stages attachment metadata in-memory. A real binary
 * storage provider (SharePoint/Blob/S3) should supply a durable storage URL.
 */
export interface AttachmentStoragePort {
  list(entityType: AttachmentEntityType, entityId: string): Attachment[];
  getById(id: string): Attachment | undefined;
  upload(
    file: File,
    entityType: AttachmentEntityType,
    entityId: string,
    uploadedByEmployeeId: string,
  ): Promise<Attachment>;
  clone(sourceId: string, entityType: AttachmentEntityType, entityId: string): Attachment | null;
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

  getById(id: string): Attachment | undefined {
    return this.state.attachments.find(a => a.id === id);
  }

  clone(sourceId: string, entityType: AttachmentEntityType, entityId: string): Attachment | null {
    const source = this.getById(sourceId);
    if (!source) {
      return null;
    }
    const copy: Attachment = {
      ...source,
      id: this.idFactory(),
      linkedEntityType: entityType,
      linkedEntityId: entityId,
      uploadedAt: this.now()
    };
    this.state.attachments.push(copy);
    this.save();
    return copy;
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
      url: this.createObjectUrl(file) ?? `pending://${id}`,
      linkedEntityType: entityType,
      linkedEntityId: entityId,
      uploadedAt: this.now(),
      uploadedByEmployeeId,
    };
    this.state.attachments.push(attachment);
    this.save();
    return attachment;
  }

  private createObjectUrl(file: File): string | null {
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
      return null;
    }

    return URL.createObjectURL(file);
  }

  remove(id: string): void {
    const index = this.state.attachments.findIndex((a) => a.id === id);
    if (index !== -1) {
      this.state.attachments.splice(index, 1);
      this.save();
    }
  }
}
