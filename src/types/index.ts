export enum FileStatusEnum {
  ACCEPTED = 'accepted',
  QUEUED = 'queued',
  STARTED = 'started',
  COMPLETE = 'complete',
  FAILED = 'failed',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
  CANCELLING = 'cancelling',
}

export type FileStatus = `${FileStatusEnum}`;

export type FileId = string;

export interface InternalFile {
  id: FileId;
  name: string;
  size: number;
  type: string;
  category: string;
  status: FileStatus;
  progress: number;
  __handler?: FileHandler;
  __raw: File;
}

export interface FileHandler {
  start: (file: File) => Promise<unknown>;
  cancel: () => void;
}
