import {
  generateRandomStr,
  getFileThumbnailUrl,
  getFileTypeFromExtension
} from './utils';

type MockEventListener = (...args: any[]) => void;

class MockEventEmitter {
  _listeners: Record<string, MockEventListener[]> = {};

  on(event: string, listener: MockEventListener) {
    if (!this._listeners[event]) {
      this._listeners[event] = [];
    }

    if (!this._listeners[event].includes(listener)) {
      this._listeners[event].push(listener);
    }
  }

  off(event: string, listener: MockEventListener) {
    if (!this._listeners[event]) {
      return;
    }

    this._listeners[event] = this._listeners[event].filter(
      (l) => l !== listener
    );
  }

  emit(event: string, ...args: any[]) {
    if (this._listeners[event]) {
      this._listeners[event].forEach((listener) => {
        listener(...args);
      });
    }
  }
}

async function validateFileType(file: File, config: FileManagerConfig) {
  const fileType = file.type || getFileTypeFromExtension(file);
  const isValid =
    config.allowedFileTypes.length === 0 ||
    config.allowedFileTypes.includes(fileType) ||
    config.allowedFileTypes.some((allowedFileType) => {
      const pattern = new RegExp(allowedFileType);
      return pattern.test(file.type);
    });

  if (!isValid) {
    return 'File type is not supported';
  }
}

export type FileId = string;

export const FileStatusEnum = {
  ACCEPTED: 'accepted' as const,
  QUEUED: 'queued' as const,
  STARTED: 'started' as const,
  COMPLETE: 'complete' as const,
  FAILED: 'failed' as const,
  REJECTED: 'rejected' as const,
  CANCELLED: 'cancelled' as const,
  CANCELLING: 'cancelling' as const,
};

type ValueOf<T> = T extends Record<string, infer U> ? U : never;

export type FileStatus = ValueOf<typeof FileStatusEnum>;

export interface FileHandler {
  start: (file: File) => Promise<void>;
  cancel: () => void;
}

export interface FileInfo {
  id: FileId;
  name: string;
  size: number;
  type: string;
  status: FileStatus;
  progress: number;
  __handler?: FileHandler;
  __raw: File;
}

type FileManagerConfig = {
  allowedFileCount: number;
  allowedFileTypes: string[];
};

class FileManager extends MockEventEmitter {
  _files: Record<FileId, FileInfo> = {};
  _validators = [validateFileType];
  _thumbnailUrls: Record<FileId, string> = {};
  _allowedFileCount = 0;
  _config: FileManagerConfig = {
    allowedFileCount: -1,
    allowedFileTypes: [],
  };

  constructor(config: FileManagerConfig) {
    super();
    this._config = config;
    this._allowedFileCount = config.allowedFileCount;
  }

  reset() {
    for (let fileId in this._files) {
      this.removeFile(fileId);
    }
  }

  getAllowedFileCount() {
    return this._allowedFileCount;
  }

  setAllowedFileCount(count: number) {
    this._allowedFileCount = count;
  }

  getAllFileIds() {
    return Object.keys(this._files);
  }

  getFile(fileId: FileId) {
    return this._files[fileId];
  }

  getRawFile(fileId: FileId) {
    return this._files[fileId]?.__raw;
  }

  removeFile(fileId: FileId) {
    if (fileId in this._files) {
      delete this._files[fileId];
      delete this._thumbnailUrls[fileId];
      this.emit('removed', fileId);
    }
  }

  updateFile(fileId: FileId, updates: Partial<FileInfo>) {
    this._files[fileId] = {
      ...this._files[fileId],
      ...updates,
    };
    this.emit('changed', fileId, updates);
  }

  addFile(file: File) {
    if (!this.isFilledUp()) {
      this._processFile(file);
    }
  }

  isFilledUp() {
    return this._allowedFileCount === 0;
  }

  isEmpty() {
    return Object.keys(this._files).length === 0;
  }

  async _processFile(file: File) {
    const errors = await this._validate(file);
    if (!errors || errors.length === 0) {
      this._markAsAccepted(file);
    } else {
      this._markAsRejected(file, errors);
    }
  }

  async _validate(file: File) {
    const errors = await Promise.all(
      this._validators.map((validator) => validator(file, this._config))
    );
    return errors.filter((error) => !!error) as string[];
  }

  async _markAsAccepted(file: File) {
    const processedFile: FileInfo = {
      id: generateRandomStr(),
      name: file.name,
      size: file.size,
      type: file.type,
      status: 'accepted',
      progress: 0,
      __raw: file,
    };

    if (this._allowedFileCount > 0) {
      this._allowedFileCount--;
    }

    // add accepted file to accepted files queue
    this._files[processedFile.id] = processedFile;
    // notify processing completion
    this.emit('accepted', processedFile);
  }

  _markAsRejected(file: File, reasons: string[]) {
    this.emit('rejected', file, reasons);
  }

  async getThumbnailUrl(fileId: FileId, maxSize: number) {
    let thumbnailUrl = this._thumbnailUrls[fileId];

    if (!thumbnailUrl) {
      thumbnailUrl = await getFileThumbnailUrl(
        this.getRawFile(fileId),
        maxSize
      );
    }

    return thumbnailUrl;
  }

  getEagerThumbnailUrl(fileId: FileId, maxSize: number) {
    return this._thumbnailUrls[fileId];
  }
}

interface CreateHandlerFnHooks {
  onProgress: (uploaded: number, total: number) => void;
  onCancel: () => void;
}

type CreateHandlerFn = (hooks: CreateHandlerFnHooks) => FileHandler;

type FileUploaderConfig = Partial<{
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

export class FileUploader extends MockEventEmitter {
  _fileManager: FileManager;
  _config: FileUploaderConfig = {};
  _uploads: Uploads = {
    queued: [],
    active: [],
    completed: [],
    failed: [],
  };
  _fileProgress: Record<FileId, [number, number]> = {};
  _totalProgress = {
    uploaded: 0,
    total: 0,
  };

  constructor(config: FileUploaderConfig) {
    super();
    this._config = {
      ...defaultConfig,
      ...config,
    };
    this._fileManager = new FileManager({
      allowedFileCount: this._config.allowedFileCount || -1,
      allowedFileTypes: this._config.allowedFileTypes || [],
    });
    this._fileManager.on('accepted', this._onFileAccepted.bind(this));
    this._fileManager.on('rejected', this._onFileRejected.bind(this));
    this._fileManager.on('removed', this._onFileRemoved.bind(this));
    this._fileManager.on('changed', this._onFileChanged.bind(this));
  }

  _onFileAccepted(file: FileInfo) {
    this._uploads.queued.push(file.id);
    this._fileManager.updateFile(file.id, {
      status: FileStatusEnum.QUEUED,
      progress: 0,
    });
    this.emit('queued', file.id);
    this._updateTotalProgress(file.id, 0, file.size);

    if (this._config.autoUpload) {
      this._attemptUpload();
    }
  }

  _attemptUpload() {
    if (this._canUpload()) {
      const nextFileId = this._uploads.queued.shift();
      this._doUpload(nextFileId!);
      this._attemptUpload();
    }
  }

  _canUpload() {
    return (
      this._uploads.queued.length > 0 &&
      this._uploads.active.length < this._config.allowedConcurrentUpload!
    );
  }

  async _doUpload(fileId: FileId) {
    if (!this._config.createHandler) {
      throw new Error('createHandler not set in config');
    }

    const handler = this._config.createHandler({
      onProgress: (uploaded, total) => {
        this._fileManager.updateFile(fileId, { progress: uploaded / total });
        this._updateTotalProgress(fileId, uploaded, total);
      },
      onCancel: () => {
        this._markAsCancelled(fileId);
        this._checkIfIsAllComplete();
      },
    });

    this._markAsStarted(fileId, handler);

    try {
      const rawFile = this._fileManager.getRawFile(fileId);
      const response = await handler.start(rawFile);
      this._markAsComplete(fileId, response);
    } catch (e) {
      if (!e.cancelled) {
        this._markAsFailed(fileId, e);
      }
    }

    this._checkIfIsAllComplete();
  }

  _checkIfIsAllComplete() {
    if (this.isComplete()) {
      this.emit('total_progress', 1);
      this.emit('all_complete');
    } else {
      this._attemptUpload();
    }
  }

  _updateTotalProgress(fileId: FileId, uploaded: number, total: number) {
    if (!this._fileProgress[fileId]) {
      this._fileProgress[fileId] = [Math.max(uploaded, 0), total];
      this._totalProgress.total += total;
    }

    const prevFileProgress = this._fileProgress[fileId];

    if (uploaded === -1) {
      this._totalProgress.uploaded -= prevFileProgress[0];
      this._totalProgress.total -= prevFileProgress[1];
      delete this._fileProgress[fileId];
    } else {
      const update = uploaded - prevFileProgress[0];
      this._totalProgress.uploaded += update;
      // this._totalProgress.total -= prevFileProgress[1];
      // this._totalProgress.total += total;
      this._fileProgress[fileId] = [uploaded, total];
    }

    const progress =
      this._totalProgress.uploaded / Math.max(this._totalProgress.total, 1);

    this.emit('total_progress', progress);
  }

  _markAsCancelled(fileId: FileId) {
    if (!this._isCompleted(fileId)) {
      const allowedFileCount = this.getAllowedFileCount();
      if (allowedFileCount !== -1) {
        this.setAllowedFileCount(allowedFileCount + 1);
      }
    }

    this._updateTotalProgress(fileId, -1, -1);
    this._fileManager.removeFile(fileId);
    this.emit('upload_cancelled', fileId);
  }

  _markAsStarted(fileId: FileId, handler: FileHandler) {
    this._uploads.active.push(fileId);
    this._fileManager.updateFile(fileId, {
      __handler: handler,
      status: FileStatusEnum.STARTED,
      progress: 0,
    });
    this.emit('upload_started', fileId);
  }

  _markAsComplete(fileId: FileId, response: any) {
    this._uploads.active.splice(this._uploads.active.indexOf(fileId), 1);
    this._uploads.completed.push(fileId);
    this._fileManager.updateFile(fileId, {
      status: FileStatusEnum.COMPLETE,
      progress: 1,
    });
    this.emit('upload_successful', fileId, response);
  }

  _markAsFailed(fileId: FileId, error: Error) {
    this._uploads.active.splice(this._uploads.active.indexOf(fileId), 1);
    this._uploads.failed.push(fileId);
    this._fileManager.updateFile(fileId, {
      status: FileStatusEnum.FAILED,
      progress: 0,
    });
    this.emit('upload_failed', fileId, error);
  }

  _onFileRejected(file: File, reasons: string[]) {
    this.emit('rejected', file, reasons);
  }

  _onFileRemoved(fileId: FileId) {
    const uploads = this._uploads;
    if (this._isQueued(fileId)) {
      uploads.queued.splice(uploads.queued.indexOf(fileId), 1);
    } else if (this._isActive(fileId)) {
      uploads.active.splice(uploads.active.indexOf(fileId), 1);
    } else if (this._isCompleted(fileId)) {
      uploads.completed.splice(uploads.completed.indexOf(fileId), 1);
    } else if (this._isFailed(fileId)) {
      uploads.failed.splice(uploads.failed.indexOf(fileId), 1);
    }
    this.emit('removed', fileId);
  }

  _onFileChanged(fileId: FileId, changes: Partial<FileInfo>) {
    if (changes['status']) {
      this.emit('statusChange', fileId, changes['status']);
    }

    if (changes['progress'] !== undefined) {
      this.emit('progress', fileId, changes['progress']);
    }
  }

  getConfigValue(key: keyof FileUploaderConfig) {
    return this._config[key];
  }

  getAllowedFileCount() {
    return this._fileManager.getAllowedFileCount();
  }

  setAllowedFileCount(count: number) {
    this._fileManager.setAllowedFileCount(count);
  }

  addFiles(files: File[]) {
    if (!this._config.multiple && !this._fileManager.isEmpty()) {
      this._fileManager.reset();
    }

    if (this._canTakeFiles(files.length)) {
      files.forEach((file) => this._fileManager.addFile(file));
    } else {
      this._maybeLimitReachedOrExceeded(files);
    }
  }

  addFile(file: File) {
    if (!this._config.multiple && !this._fileManager.isEmpty()) {
      this._fileManager.reset();
    }

    if (this._canTakeFiles()) {
      this._fileManager.addFile(file);
    } else {
      this._maybeLimitReachedOrExceeded([file]);
    }
  }

  _canTakeFiles(amount: number = 1) {
    if (
      !this._config.multiple &&
      (amount > 1 || !this._fileManager.isEmpty())
    ) {
      return false;
    }

    const allowedFileCount = this.getAllowedFileCount();
    if (allowedFileCount === -1) {
      return true;
    } else {
      return allowedFileCount - amount >= 0;
    }
  }

  _maybeLimitReachedOrExceeded(files: File[]) {
    const allowedFileCount = this.getAllowedFileCount();
    if (!this._config.multiple || allowedFileCount === 0) {
      this.emit('limit_reached');
    } else if (allowedFileCount - files.length < 0) {
      this.emit('limit_exceeded', allowedFileCount, files);
    }
  }

  removeFile(fileId: FileId) {
    if (this._isActive(fileId)) {
      this.cancel(fileId);
    }

    this._fileManager.removeFile(fileId);
  }

  start(fileId: FileId) {
    if (!this._isCompleted(fileId)) {
      if (this._isQueued(fileId)) {
        this._uploads.queued.splice(this._uploads.queued.indexOf(fileId), 1);
        this._uploads.queued.unshift(fileId);
        this._attemptUpload();
      } else if (this._isFailed(fileId)) {
        this.retry(fileId);
      }
    }
  }

  startAll() {
    this._attemptUpload();
  }

  cancelAll() {
    const fileIds = this._fileManager.getAllFileIds();
    fileIds.forEach((fileId) => {
      if (!this._isActive(fileId)) {
        this._markAsCancelled(fileId);
      } else {
        this._fileManager.getFile(fileId).__handler!.cancel();
      }
    });
    this.emit('cancel_all');
  }

  cancel(fileId: FileId) {
    if (!this._isActive(fileId)) {
      this._markAsCancelled(fileId);
      this._checkIfIsAllComplete();
    } else {
      this._fileManager.getFile(fileId).__handler!.cancel();
    }
  }

  retry(fileId: FileId) {
    if (this._isFailed(fileId)) {
      // remove file from failed
      this._uploads.failed.splice(this._uploads.failed.indexOf(fileId), 1);
      // put file in front of the queue and attempt upload
      this._uploads.queued.unshift(fileId);
      this._attemptUpload();
    }
  }

  hasStarted() {
    return (
      this._uploads.active.length > 0 ||
      this._uploads.completed.length > 0 ||
      this._uploads.failed.length > 0
    );
  }

  isRetryable(fileId: FileId) {
    return this._isFailed(fileId);
  }

  isCancellable(fileId: FileId) {
    return this._isQueued(fileId) || this._isActive(fileId);
  }

  _isQueued(fileId: FileId) {
    return this._uploads.queued.includes(fileId);
  }

  _isActive(fileId: FileId) {
    return this._uploads.active.includes(fileId);
  }

  _isCompleted(fileId: FileId) {
    return this._uploads.completed.includes(fileId);
  }

  _isFailed(fileId: FileId) {
    return this._uploads.failed.includes(fileId);
  }

  getFile(fileId: FileId) {
    return this._fileManager.getFile(fileId);
  }

  removeAllFiles() {
    const fileIds = this._fileManager.getAllFileIds();
    fileIds.forEach((fileId) => this.removeFile(fileId));
  }

  isComplete(fileId?: FileId) {
    if (!fileId) {
      return (
        this._uploads.queued.length === 0 &&
        this._uploads.active.length === 0 &&
        this._uploads.failed.length === 0 &&
        this._uploads.completed.length > 0
      );
    }

    return this._uploads.completed.includes(fileId);
  }

  getQueuedFileCount() {
    return this._uploads.queued.length;
  }

  getUploadedFileCount() {
    return this._uploads.completed.length;
  }

  getUploadingFileCount() {
    return this._uploads.active.length;
  }

  getFailedFileCount() {
    return this._uploads.failed.length;
  }

  getMostRecentActiveFileId() {
    if (this._uploads.active.length > 0) {
      return this._uploads.active[this._uploads.active.length - 1];
    } else if (this._uploads.completed.length > 0) {
      return this._uploads.completed[this._uploads.completed.length - 1];
    } else if (this._uploads.failed.length > 0) {
      return this._uploads.failed[this._uploads.failed.length - 1];
    } else {
      return this._uploads.queued[0];
    }
  }

  getTotalProgress() {
    return this._totalProgress.uploaded / this._totalProgress.total;
  }

  reset() {
    for (let fileId in this._fileProgress) {
      delete this._fileProgress[fileId];
    }

    this._totalProgress.uploaded = 0;
    this._totalProgress.total = 1;
    this._fileManager.reset();
  }

  async drawThumbnail(fileId: FileId, imgEl: HTMLImageElement, size: number) {
    const thumbnailUrl = await this._fileManager.getThumbnailUrl(fileId, size);
    imgEl.src = thumbnailUrl;
  }

  getThumbnailUrl(fileId: FileId, size: number) {
    return this._fileManager.getThumbnailUrl(fileId, size);
  }

  getEagerThumbnailUrl(fileId: FileId, size: number) {
    return this._fileManager.getEagerThumbnailUrl(fileId, size);
  }
}

type DropZoneHooks = {
  onOver: (event: DragEvent) => void;
  onEnter: (event: DragEvent) => void;
  onLeave: (event: DragEvent) => void;
  onActualLeave: (event: DragEvent) => void;
  onFiles: (files: File[]) => void;
  onError: (e: Error) => void;
};

const defaultHooks = {
  onOver: () => {},
  onEnter: () => {},
  onLeave: () => {},
  onActualLeave: () => {},
  onFiles: () => {},
  onError: () => {},
};

export class DropZone {
  _disposers: Record<string, () => void> = {};
  _element: Element;
  _hooks: DropZoneHooks;
  _disabled = false;

  constructor(element: Element, hooks: Partial<DropZoneHooks>) {
    this._element = element;
    this._hooks = Object.assign({}, defaultHooks, hooks);

    if (this._element) {
      this._attachEvents();
    }
  }

  _attachEvents() {
    if (this._element) {
      this._attachEvent('dragover', (e) => {
        e.stopPropagation();
        e.preventDefault();

        if (!e.dataTransfer) {
          return;
        }

        const effect = e.dataTransfer.effectAllowed;

        if (effect === 'move' || effect === 'linkMove') {
          e.dataTransfer.dropEffect = 'move';
        } else {
          e.dataTransfer.dropEffect = 'copy';
        }

        this._hooks.onOver(e);
      });

      this._attachEvent('dragenter', (e) => {
        if (!this._disabled) {
          this._hooks.onEnter(e);
        }
      });

      this._attachEvent('dragleave', (e) => {
        e.stopPropagation();
        this._hooks.onLeave(e);
        const relatedTarget = document.elementFromPoint(e.clientX, e.clientY);
        if (!this._isElementDescendant(relatedTarget)) {
          this._hooks.onActualLeave(e);
        }
      });

      this._attachEvent('drop', (e) => {
        if (!this._disabled) {
          e.stopPropagation();
          e.preventDefault();

          if (!e.dataTransfer) {
            return;
          }

          this._processDroppedItems(Array.from(e.dataTransfer.items)).then(
            (files) => {
              this._hooks.onFiles(files);
            },
            (e) => {
              this._hooks.onError(e);
            }
          );
        }
      });
    }
  }

  _attachEvent(eventName: string, handler: (e: DragEvent) => void) {
    if (this._disposers[eventName]) {
      this._disposers[eventName]();
    }
    this._element.addEventListener(
      eventName,
      handler.bind(this) as EventListener
    );
    this._disposers[eventName] = () =>
      this._element.removeEventListener(
        eventName,
        handler.bind(this) as EventListener
      );
  }

  async _processDroppedItems(items: DataTransferItem[]) {
    return new Promise<File[]>((resolve, reject) => {
      const files: File[] = [];
      const traversalPromises: Promise<void>[] = [];

      items.forEach((item) => {
        const entry = item.webkitGetAsEntry();
        if (entry) {
          traversalPromises.push(this._traverseFileTree(entry, files));
        } else {
          traversalPromises.push(Promise.resolve());
        }
      });

      Promise.all(traversalPromises).then(() => resolve(files), reject);
    });
  }

  async _traverseFileTree(entry: any, files: File[]) {
    const self = this;
    return new Promise<void>((resolve, reject) => {
      if (entry.isFile) {
        entry.file((file: File) => {
          files.push(file);
          resolve();
        }, reject);
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        let allEntries: any[] = [];
        (function readEntries() {
          // calls readEntries() until callback returns an empty array
          reader.readEntries((entries: any[]) => {
            if (entries.length > 0) {
              allEntries = allEntries.concat(entries);
              setTimeout(() => readEntries(), 0);
            } else {
              Promise.all(
                allEntries.map((entry) => self._traverseFileTree(entry, files))
              ).then(() => resolve(), reject);
            }
          }, reject);
        })();
      }
    });
  }

  dispose() {
    Object.values(this._disposers).forEach((disposer) => disposer());
  }

  _isElementDescendant(descendant: Element | null) {
    if (!descendant) {
      return false;
    }
    if (this._element === descendant) {
      return true;
    }
    if (this._element.contains) {
      return this._element.contains(descendant);
    } else {
      return !!(descendant.compareDocumentPosition(this._element) & 8);
    }
  }
}