import { EventEmitter } from './event-emitter';
import { FileManager, FileManagerEvent } from './file-manager';
import { FileHandler, FileId, FileStatusEnum, InternalFile } from './types';

interface CreateHandlerFnHooks {
  onProgress: (uploaded: number, total: number) => void;
  onCancel: () => void;
}

export type CreateHandlerFn = (hooks: CreateHandlerFnHooks) => FileHandler;

export type FileUploaderConfig = Partial<{
  allowedConcurrentUpload: number;
  allowedFileCount: number;
  maxAllowedFileSize: number;
  minAllowedFileSize: number;
  allowedFileTypes: string[];
  multiple: boolean;
  autoUpload: boolean;
  createHandler: CreateHandlerFn;
}>;

const defaultConfig = {
  allowedConcurrentUpload: 3,
  allowedFileCount: -1,
  maxAllowedFileSize: -1,
  minAllowedFileSize: -1,
  allowedFileTypes: [],
  multiple: true,
  autoUpload: false,
};

type Uploads = {
  queued: FileId[];
  active: FileId[];
  completed: FileId[];
  failed: FileId[];
};

export enum FileUploaderEvent {
  QUEUED = 'queued',
  UPLOAD_STARTED = 'upload_started',
  UPLOAD_CANCELLED = 'upload_cancelled',
  UPLOAD_SUCCESSFUL = 'upload_successful',
  UPLOAD_FAILED = 'upload_failed',
  UPLOAD_PROGRESS = 'progress',
  REJECTED = 'rejected',
  STATUS_CHANGE = 'statusChange',
  REMOVED = 'removed',
  ALL_COMPLETE = 'all_complete',
  TOTAL_PROGRESS = 'total_progress',
  CANCEL_ALL = 'cancel_all',
  LIMIT_REACHED = 'limit_reached',
  LIMIT_EXCEEDED = 'limit_exceeded',
}

export class FileUploader extends EventEmitter {
  private fileManager: FileManager;
  private config: FileUploaderConfig = {};
  private fileProgress: Record<FileId, [number, number]> = {};

  private uploads: Uploads = {
    queued: [],
    active: [],
    completed: [],
    failed: [],
  };

  private totalProgress = { uploaded: 0, total: 0 };

  constructor(config: FileUploaderConfig) {
    super();

    this.config = { ...defaultConfig, ...config };

    this.fileManager = new FileManager({
      allowedFileCount: this.config.allowedFileCount || -1,
      allowedFileTypes: this.config.allowedFileTypes || [],
      maxAllowedFileSize: this.config.maxAllowedFileSize || -1,
      minAllowedFileSize: this.config.minAllowedFileSize || -1,
    });

    this.fileManager.on(
      FileManagerEvent.ACCEPTED,
      this.onFileAccepted.bind(this)
    );
    this.fileManager.on(
      FileManagerEvent.REJECTED,
      this.onFileRejected.bind(this)
    );
    this.fileManager.on(
      FileManagerEvent.REMOVED,
      this.onFileRemoved.bind(this)
    );
    this.fileManager.on(
      FileManagerEvent.CHANGED,
      this.onFileChanged.bind(this)
    );
  }

  private onFileAccepted(file: InternalFile) {
    this.markAsQueued(file.id);
    this.updateTotalProgress(file.id, 0, file.size);

    if (this.config.autoUpload) {
      this.attemptUpload();
    }
  }

  private attemptUpload(propagate = true) {
    if (this.canUpload() || !propagate) {
      const nextFileId = this.uploads.queued.shift();

      if (nextFileId) {
        void this.doUpload(nextFileId);

        if (propagate) {
          this.attemptUpload();
        }
      }
    }
  }

  private canUpload() {
    return (
      this.uploads.queued.length > 0 &&
      this.uploads.active.length < (this.config.allowedConcurrentUpload || 1)
    );
  }

  private async doUpload(fileId: FileId) {
    if (!this.config.createHandler) {
      throw new Error('createHandler not set in config');
    }

    const handler = this.config.createHandler({
      onProgress: (uploaded, total) => {
        this.fileManager.updateFile(fileId, { progress: uploaded / total });
        this.updateTotalProgress(fileId, uploaded, total);
      },
      onCancel: () => {
        this.markAsCancelled(fileId);
        this.checkIfIsAllComplete();
      },
    });

    this.markAsStarted(fileId, handler);

    try {
      const rawFile = this.fileManager.getRawFile(fileId);
      const response = await handler.start(rawFile);
      this.markAsComplete(fileId, response);
    } catch (e: any) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (!e.cancelled) {
        this.markAsFailed(fileId, e);
      }
    }

    this.checkIfIsAllComplete();
  }

  private checkIfIsAllComplete() {
    if (this.isComplete()) {
      this.emit(FileUploaderEvent.TOTAL_PROGRESS, 1);
      this.emit(FileUploaderEvent.ALL_COMPLETE);
    } else if (this.config.autoUpload) {
      this.attemptUpload();
    }
  }

  private updateTotalProgress(fileId: FileId, uploaded: number, total: number) {
    if (!this.fileProgress[fileId]) {
      this.fileProgress[fileId] = [Math.max(uploaded, 0), total];
      this.totalProgress.total += total;
    }

    const prevFileProgress = this.fileProgress[fileId];

    if (uploaded === -1) {
      this.totalProgress.uploaded -= prevFileProgress[0];
      this.totalProgress.total -= prevFileProgress[1];
      delete this.fileProgress[fileId];
    } else {
      const update = uploaded - prevFileProgress[0];
      this.totalProgress.uploaded += update;
      // this._totalProgress.total -= prevFileProgress[1];
      // this._totalProgress.total += total;
      this.fileProgress[fileId] = [uploaded, total];
    }

    const progress =
      this.totalProgress.uploaded / Math.max(this.totalProgress.total, 1);

    this.emit(FileUploaderEvent.TOTAL_PROGRESS, progress);
  }

  private markAsQueued(fileId: FileId) {
    this.uploads.queued.push(fileId);

    this.fileManager.updateFile(fileId, {
      status: FileStatusEnum.QUEUED,
      progress: 0,
    });

    this.emit(FileUploaderEvent.QUEUED, fileId);
  }

  private markAsCancelled(fileId: FileId) {
    if (!this.isCompleted(fileId)) {
      const allowedFileCount = this.getAllowedFileCount();
      if (allowedFileCount !== -1) {
        this.setAllowedFileCount(allowedFileCount + 1);
      }
    }

    this.updateTotalProgress(fileId, -1, -1);
    this.fileManager.removeFile(fileId);
    this.emit(FileUploaderEvent.UPLOAD_CANCELLED, fileId);
  }

  private markAsStarted(fileId: FileId, handler: FileHandler) {
    this.uploads.active.push(fileId);
    this.fileManager.updateFile(fileId, {
      __handler: handler,
      status: FileStatusEnum.STARTED,
      progress: 0,
    });
    this.emit(FileUploaderEvent.UPLOAD_STARTED, fileId);
  }

  private markAsComplete(fileId: FileId, response: any) {
    this.uploads.active.splice(this.uploads.active.indexOf(fileId), 1);
    this.uploads.completed.push(fileId);
    this.fileManager.updateFile(fileId, {
      status: FileStatusEnum.COMPLETE,
      progress: 1,
    });
    this.emit(FileUploaderEvent.UPLOAD_SUCCESSFUL, fileId, response);
  }

  private markAsFailed(fileId: FileId, error: Error) {
    this.uploads.active.splice(this.uploads.active.indexOf(fileId), 1);
    this.uploads.failed.push(fileId);
    this.fileManager.updateFile(fileId, {
      status: FileStatusEnum.FAILED,
      progress: 0,
    });
    this.emit(FileUploaderEvent.UPLOAD_FAILED, fileId, error);
  }

  private onFileRejected(file: File, reasons: string[]) {
    this.emit(FileUploaderEvent.REJECTED, file, reasons);
  }

  private onFileRemoved(fileId: FileId) {
    const uploads = this.uploads;
    if (this.isQueued(fileId)) {
      uploads.queued.splice(uploads.queued.indexOf(fileId), 1);
    } else if (this.isActive(fileId)) {
      uploads.active.splice(uploads.active.indexOf(fileId), 1);
    } else if (this.isCompleted(fileId)) {
      uploads.completed.splice(uploads.completed.indexOf(fileId), 1);
    } else if (this.isFailed(fileId)) {
      uploads.failed.splice(uploads.failed.indexOf(fileId), 1);
    }
    this.emit(FileUploaderEvent.REMOVED, fileId);
  }

  private onFileChanged(fileId: FileId, changes: Partial<InternalFile>) {
    if (changes.status) {
      this.emit(FileUploaderEvent.STATUS_CHANGE, fileId, changes.status);
    }

    if (changes.progress !== undefined) {
      this.emit(FileUploaderEvent.UPLOAD_PROGRESS, fileId, changes.progress);
    }
  }

  getConfigValue<T extends keyof FileUploaderConfig>(
    key: T
  ): FileUploaderConfig[T] {
    return this.config[key];
  }

  getAllowedFileCount() {
    return this.fileManager.getAllowedFileCount();
  }

  setAllowedFileCount(count: number) {
    this.fileManager.setAllowedFileCount(count);
  }

  addFiles(files: File[]) {
    if (!this.config.multiple && !this.fileManager.isEmpty()) {
      this.fileManager.reset();
    }

    if (this.canTakeFiles(files.length)) {
      files.forEach((file) => void this.fileManager.addFile(file));
    } else {
      this.maybeLimitReachedOrExceeded(files);
    }
  }

  addFile(file: File) {
    if (!this.config.multiple && !this.fileManager.isEmpty()) {
      this.fileManager.reset();
    }

    if (this.canTakeFiles()) {
      void this.fileManager.addFile(file);
    } else {
      this.maybeLimitReachedOrExceeded([file]);
    }
  }

  private canTakeFiles(amount = 1) {
    if (!this.config.multiple && (amount > 1 || !this.fileManager.isEmpty())) {
      return false;
    }

    const allowedFileCount = this.getAllowedFileCount();

    if (allowedFileCount === -1) {
      return true;
    } else {
      return allowedFileCount - amount >= 0;
    }
  }

  private maybeLimitReachedOrExceeded(files: File[]) {
    const allowedFileCount = this.getAllowedFileCount();
    if (!this.config.multiple || allowedFileCount === 0) {
      this.emit(FileUploaderEvent.LIMIT_REACHED);
    } else if (allowedFileCount - files.length < 0) {
      this.emit(FileUploaderEvent.LIMIT_EXCEEDED, allowedFileCount, files);
    }
  }

  removeFile(fileId: FileId) {
    if (this.isActive(fileId)) {
      this.cancel(fileId);
    }

    this.fileManager.removeFile(fileId);
  }

  start(fileId: FileId) {
    if (!this.isCompleted(fileId)) {
      if (this.isQueued(fileId)) {
        this.uploads.queued.splice(this.uploads.queued.indexOf(fileId), 1);
        this.uploads.queued.unshift(fileId);
        this.attemptUpload(false);
      } else if (this.isFailed(fileId)) {
        this.retry(fileId);
      }
    }
  }

  startAll() {
    this.attemptUpload();
  }

  cancelAll() {
    const fileIds = this.fileManager.getAllFileIds();

    fileIds.forEach((fileId) => {
      if (!this.isActive(fileId)) {
        this.markAsCancelled(fileId);
      } else {
        const file = this.fileManager.getFile(fileId);

        if (file.__handler) {
          file.__handler.cancel();
        }
      }
    });

    this.emit(FileUploaderEvent.CANCEL_ALL);
  }

  cancel(fileId: FileId) {
    if (!this.isActive(fileId)) {
      this.markAsCancelled(fileId);
      this.checkIfIsAllComplete();
    } else {
      const file = this.fileManager.getFile(fileId);

      if (file.__handler) {
        file.__handler.cancel();
      }
    }
  }

  retry(fileId: FileId) {
    if (this.isFailed(fileId)) {
      // remove file from failed
      this.uploads.failed.splice(this.uploads.failed.indexOf(fileId), 1);
      // put file in front of the queue and attempt upload
      this.uploads.queued.unshift(fileId);
      this.attemptUpload();
    }
  }

  hasStarted() {
    return (
      this.uploads.active.length > 0 ||
      this.uploads.completed.length > 0 ||
      this.uploads.failed.length > 0
    );
  }

  isRetryable(fileId: FileId) {
    return this.isFailed(fileId);
  }

  isCancellable(fileId: FileId) {
    return this.isQueued(fileId) || this.isActive(fileId);
  }

  private isQueued(fileId: FileId) {
    return this.uploads.queued.includes(fileId);
  }

  private isActive(fileId: FileId) {
    return this.uploads.active.includes(fileId);
  }

  private isCompleted(fileId: FileId) {
    return this.uploads.completed.includes(fileId);
  }

  private isFailed(fileId: FileId) {
    return this.uploads.failed.includes(fileId);
  }

  getFile(fileId: FileId) {
    return this.fileManager.getFile(fileId);
  }

  removeAllFiles() {
    const fileIds = this.fileManager.getAllFileIds();
    fileIds.forEach((fileId) => this.removeFile(fileId));
  }

  isComplete(fileId?: FileId) {
    if (!fileId) {
      return (
        this.uploads.queued.length === 0 &&
        this.uploads.active.length === 0 &&
        this.uploads.failed.length === 0 &&
        this.uploads.completed.length > 0
      );
    }

    return this.uploads.completed.includes(fileId);
  }

  getQueuedFileCount() {
    return this.uploads.queued.length;
  }

  getUploadedFileCount() {
    return this.uploads.completed.length;
  }

  getUploadingFileCount() {
    return this.uploads.active.length;
  }

  getFailedFileCount() {
    return this.uploads.failed.length;
  }

  getMostRecentActiveFileId() {
    if (this.uploads.active.length > 0) {
      return this.uploads.active[this.uploads.active.length - 1];
    } else if (this.uploads.completed.length > 0) {
      return this.uploads.completed[this.uploads.completed.length - 1];
    } else if (this.uploads.failed.length > 0) {
      return this.uploads.failed[this.uploads.failed.length - 1];
    } else {
      return this.uploads.queued[0];
    }
  }

  getTotalProgress() {
    return this.totalProgress.uploaded / this.totalProgress.total;
  }

  reset() {
    for (const fileId in this.fileProgress) {
      delete this.fileProgress[fileId];
    }

    this.totalProgress.uploaded = 0;
    this.totalProgress.total = 1;
    this.fileManager.reset();
  }

  async drawThumbnail(fileId: FileId, imgEl: HTMLImageElement, size: number) {
    const thumbnailUrl = await this.fileManager.getThumbnailUrl(fileId, size);
    imgEl.src = thumbnailUrl;
  }

  getThumbnailUrl(fileId: FileId, size: number) {
    return this.fileManager.getThumbnailUrl(fileId, size);
  }

  getEagerThumbnailUrl(fileId: FileId) {
    return this.fileManager.getEagerThumbnailUrl(fileId);
  }
}
