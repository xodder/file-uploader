import React from 'react';
import generateRandomStr from './utils/generate-random-str';
import getFileThumbnailUrl from './utils/get-file-thumbnail-url';
import getFileTypeFromExtension from './utils/get-file-type-from-extension';
import useConstant from './utils/use-constant';
import useRerender from './utils/use-rerender';

type MockEventListener = (...args: any[]) => any;

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

  off(event: string, listener?: MockEventListener) {
    if (!this._listeners[event] || !listener) {
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

function newID() {
  return generateRandomStr(8);
}

function validateFileType(file: File, config: FileManagerConfig) {
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
  start: (file: File) => Promise<unknown>;
  cancel: () => void;
}

export interface FileX {
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
  _files: Record<FileId, FileX> = {};
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
    for (const fileId in this._files) {
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

  updateFile(fileId: FileId, updates: Partial<FileX>) {
    this._files[fileId] = {
      ...this._files[fileId],
      ...updates,
    };
    this.emit('changed', fileId, updates);
  }

  async addFile(file: File) {
    if (!this.isFilledUp()) {
      await this._processFile(file);
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

  _markAsAccepted(file: File) {
    const processedFile: FileX = {
      id: newID(),
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

  getEagerThumbnailUrl(fileId: FileId) {
    return this._thumbnailUrls[fileId];
  }
}

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

class FileUploader extends MockEventEmitter {
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

  _onFileAccepted(file: FileX) {
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

      if (nextFileId) {
        void this._doUpload(nextFileId);
      }

      this._attemptUpload();
    }
  }

  _canUpload() {
    return (
      this._uploads.queued.length > 0 &&
      this._uploads.active.length < (this._config.allowedConcurrentUpload || 1)
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
    } catch (e: any) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
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

  _onFileChanged(fileId: FileId, changes: Partial<FileX>) {
    if (changes['status']) {
      this.emit('statusChange', fileId, changes['status']);
    }

    if (changes['progress'] !== undefined) {
      this.emit('progress', fileId, changes['progress']);
    }
  }

  getConfigValue<T extends keyof FileUploaderConfig>(
    key: T
  ): FileUploaderConfig[T] {
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
      files.forEach((file) => void this._fileManager.addFile(file));
    } else {
      this._maybeLimitReachedOrExceeded(files);
    }
  }

  addFile(file: File) {
    if (!this._config.multiple && !this._fileManager.isEmpty()) {
      this._fileManager.reset();
    }

    if (this._canTakeFiles()) {
      void this._fileManager.addFile(file);
    } else {
      this._maybeLimitReachedOrExceeded([file]);
    }
  }

  _canTakeFiles(amount = 1) {
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
        const file = this._fileManager.getFile(fileId);

        if (file.__handler) {
          file.__handler.cancel();
        }
      }
    });

    this.emit('cancel_all');
  }

  cancel(fileId: FileId) {
    if (!this._isActive(fileId)) {
      this._markAsCancelled(fileId);
      this._checkIfIsAllComplete();
    } else {
      const file = this._fileManager.getFile(fileId);

      if (file.__handler) {
        file.__handler.cancel();
      }
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
    for (const fileId in this._fileProgress) {
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

  getEagerThumbnailUrl(fileId: FileId) {
    return this._fileManager.getEagerThumbnailUrl(fileId);
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
  onOver: () => void 0,
  onEnter: () => void 0,
  onLeave: () => void 0,
  onActualLeave: () => void 0,
  onFiles: () => void 0,
  onError: () => void 0,
};

class DropZone {
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

    const _handler = handler.bind(this) as EventListener;

    this._element.addEventListener(eventName, _handler);

    this._disposers[eventName] = () =>
      this._element.removeEventListener(eventName, _handler);
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

  async _traverseFileTree(entry: FileSystemEntry, files: File[]) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    return new Promise<void>((resolve, reject) => {
      if (entry.isFile) {
        const entry_ = entry as FileSystemFileEntry;

        entry_.file((file: File) => {
          files.push(file);
          resolve();
        }, reject);
      } else if (entry.isDirectory) {
        const entry_ = entry as FileSystemDirectoryEntry;
        const reader = entry_.createReader();

        let allEntries: any[] = [];
        (function readEntries() {
          // calls readEntries() until callback returns an empty array
          reader.readEntries((entries) => {
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

type FileUploaderContextValue = {
  ref: FileUploader;
  fileIds: FileId[];
};

const FileUploaderContext = React.createContext<any>({});

type FileUploaderProviderProps = React.PropsWithChildren<{
  options: FileUploaderConfig;
}>;

export function FileUploaderProvider({
  children,
  options,
}: FileUploaderProviderProps) {
  const uploader = useConstant(() => new FileUploader(options));
  const fileIds = useUploaderFileIds(uploader);

  const value = {
    ref: uploader,
    fileIds,
  };

  return (
    <FileUploaderContext.Provider value={value}>
      {children}
    </FileUploaderContext.Provider>
  );
}

function useUploaderFileIds(uploaderRef: FileUploader) {
  const [fileIds, setFileIds] = React.useState<FileId[]>([]);

  React.useEffect(() => {
    const onFileQueued = (fileId: FileId) =>
      setFileIds((prev) => [...prev, fileId]);
    uploaderRef.on('queued', onFileQueued);
    return () => uploaderRef.off('queued', onFileQueued);
  }, [uploaderRef]);

  React.useEffect(() => {
    const onFileQueued = (fileId: FileId) =>
      setFileIds((prev) => prev.filter((id) => id !== fileId));
    uploaderRef.on('removed', onFileQueued);
    return () => uploaderRef.off('removed', onFileQueued);
  }, [uploaderRef]);

  return fileIds;
}

export function useFileUploaderContext() {
  const context = React.useContext(FileUploaderContext);
  if (!context) {
    throw new Error(
      'useFileUploaderContext can only be within a FileUploaderProvider'
    );
  }
  return context as FileUploaderContextValue;
}

export function useFileUploaderRef() {
  return useFileUploaderContext().ref;
}

export function useFileUploaderFileIds() {
  return useFileUploaderContext().fileIds;
}

export function useFileUploaderData() {
  const rerender = useRerender();
  const { ref, fileIds } = useFileUploaderContext();

  useFileUploaderEvent({
    onStatusChanged: () => {
      rerender();
    },
  });

  return {
    status: {
      started: ref.hasStarted(),
      done: ref.hasStarted() && ref.isComplete(),
    },
    fileIds,
    currentFileId: ref.getMostRecentActiveFileId(),
    activeFileCount: ref.getUploadingFileCount(),
    completedFileCount: ref.getUploadedFileCount(),
    totalFileCount: fileIds.length,
  };
}

export function useFileStatus(fileId?: FileId) {
  const uploaderRef = useFileUploaderRef();
  const rerender = useRerender();
  const file = fileId ? uploaderRef.getFile(fileId) : undefined;

  useFileUploaderEvent({
    onStatusChanged: (affectedFileId: FileId) => {
      if (affectedFileId === fileId || !fileId) {
        rerender();
      }
    },
  });

  return file?.status;
}

export function useFileName(fileId: FileId) {
  const uploaderRef = useFileUploaderRef();
  const file = uploaderRef.getFile(fileId);
  return file?.name;
}

export function useFileProgress(fileId: FileId) {
  const uploaderRef = useFileUploaderRef();
  const [progress, setProgress] = React.useState(() => {
    return uploaderRef.getFile(fileId)?.progress || 0;
  });

  useFileUploaderEvent({
    onUploadProgress: (affectedFileId, value) => {
      if (affectedFileId === fileId) {
        setProgress(value);
      }
    },
  });

  return progress;
}

export function useOverallProgress() {
  const uploaderRef = useFileUploaderRef();
  const [progress, setProgress] = React.useState(() => {
    return uploaderRef.getTotalProgress();
  });

  useFileUploaderEvent({
    onTotalProgress: (value) => {
      setProgress(value);
    },
  });

  return progress;
}

export function useFileThumbnailUrl(fileId: FileId, size: number) {
  const uploaderRef = useFileUploaderRef();
  const mountedRef = React.useRef(false);
  const [thumbnailUrl, setThumbnailUrl] = React.useState<string>(
    uploaderRef.getEagerThumbnailUrl(fileId) || ''
  );

  React.useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  React.useEffect(() => {
    uploaderRef
      .getThumbnailUrl(fileId, size)
      .then((url) => {
        if (mountedRef.current) {
          setThumbnailUrl(url);
        }
      })
      .catch(() => void 0);
  }, [fileId, size, thumbnailUrl, uploaderRef]);

  return thumbnailUrl;
}

export function useIsUploadCancelable(fileId?: FileId) {
  const uploaderRef = useFileUploaderRef();
  const status = useFileStatus(fileId);

  if (!fileId) {
    return !uploaderRef.isComplete();
  }

  return [
    FileStatusEnum.QUEUED,
    FileStatusEnum.STARTED,
    FileStatusEnum.FAILED,
  ].includes(status as any);
}

export function useIsUploadStartable(fileId?: FileId) {
  const uploaderRef = useFileUploaderRef();
  const status = useFileStatus(fileId);
  if (!fileId) {
    return !uploaderRef.hasStarted();
  }
  return [FileStatusEnum.QUEUED, FileStatusEnum.FAILED].includes(status as any);
}

export function useIsUploadRetryable(fileId: FileId) {
  const status = useFileStatus(fileId);
  return status === FileStatusEnum.FAILED;
}

export function useFileUploaderDropZone(
  elementRef: React.RefObject<Element | null>
) {
  const dropzoneRef = React.useRef<DropZone | null>();
  const uploaderRef = useFileUploaderRef();
  const [active, setActive] = React.useState(false);

  React.useEffect(() => {
    if (elementRef.current && !dropzoneRef.current) {
      dropzoneRef.current = new DropZone(elementRef.current, {
        onEnter: () => {
          setActive(true);
        },
        onActualLeave: () => {
          setActive(false);
        },
        onFiles: (files) => {
          setActive(false);
          uploaderRef.addFiles(files);
        },
      });
    }

    return () => {
      dropzoneRef.current && dropzoneRef.current.dispose();
      dropzoneRef.current = null;
    };
  }, [elementRef, uploaderRef]);

  return { active };
}

export interface FileUploaderEventHooks {
  onStatusChanged: (fileId: FileId, newStatus: FileStatus) => any;
  onUploadStarted: (fileId: FileId) => any;
  onUploadComplete: (fileId: FileId, response: any) => any;
  onUploadFailed: (fileId: FileId, error: any) => any;
  onUploadCancelled: (fileId: FileId) => any;
  onUploadProgress: (fileId: FileId, progress: number) => any;
  onAllComplete: () => any;
  onCancelAll: () => any;
  onTotalProgress: (progress: number) => any;
  onFileQueued: (fileId: FileId) => any;
  onFileRejected: (fileId: FileId, reasons: string[]) => any;
  onFileRemoved: (fileId: FileId) => any;
  onUploadLimitExceeded: (allowedCount: number, files: File[]) => any;
  onUploadLimitReached: () => any;
}

export function useFileUploaderEvent(hooks: Partial<FileUploaderEventHooks>) {
  const uploaderRef = useFileUploaderRef();

  React.useEffect(() => {
    if (hooks.onStatusChanged) {
      uploaderRef.on('statusChange', hooks.onStatusChanged);
      return () => uploaderRef.off('statusChange', hooks.onStatusChanged);
    }
  }, [hooks.onStatusChanged, uploaderRef]);

  React.useEffect(() => {
    if (hooks.onUploadStarted) {
      uploaderRef.on('upload_started', hooks.onUploadStarted);
      return () => uploaderRef.off('upload_started', hooks.onUploadStarted);
    }
  }, [hooks.onUploadStarted, uploaderRef]);

  React.useEffect(() => {
    if (hooks.onUploadComplete) {
      uploaderRef.on('upload_successful', hooks.onUploadComplete);
      return () => uploaderRef.off('upload_successful', hooks.onUploadComplete);
    }
  }, [hooks.onUploadComplete, uploaderRef]);

  React.useEffect(() => {
    if (hooks.onUploadFailed) {
      uploaderRef.on('upload_failed', hooks.onUploadFailed);
      return () => uploaderRef.off('upload_failed', hooks.onUploadFailed);
    }
  }, [hooks.onUploadFailed, uploaderRef]);

  React.useEffect(() => {
    if (hooks.onUploadCancelled) {
      uploaderRef.on('upload_cancelled', hooks.onUploadCancelled);
      return () => uploaderRef.off('upload_cancelled', hooks.onUploadCancelled);
    }
  }, [hooks.onUploadCancelled, uploaderRef]);

  React.useEffect(() => {
    if (hooks.onUploadProgress) {
      uploaderRef.on('progress', hooks.onUploadProgress);
      return () => uploaderRef.off('progress', hooks.onUploadProgress);
    }
  }, [hooks.onUploadProgress, uploaderRef]);

  React.useEffect(() => {
    if (hooks.onAllComplete) {
      uploaderRef.on('all_complete', hooks.onAllComplete);
      return () => uploaderRef.off('all_complete', hooks.onAllComplete);
    }
  }, [hooks.onAllComplete, uploaderRef]);

  React.useEffect(() => {
    if (hooks.onCancelAll) {
      uploaderRef.on('cancel_all', hooks.onCancelAll);
      return () => uploaderRef.off('cancel_all', hooks.onCancelAll);
    }
  }, [hooks.onCancelAll, uploaderRef]);

  React.useEffect(() => {
    if (hooks.onTotalProgress) {
      uploaderRef.on('total_progress', hooks.onTotalProgress);
      return () => uploaderRef.off('total_progress', hooks.onTotalProgress);
    }
  }, [hooks.onTotalProgress, uploaderRef]);

  React.useEffect(() => {
    if (hooks.onFileQueued) {
      uploaderRef.on('queued', hooks.onFileQueued);
      return () => uploaderRef.off('queued', hooks.onFileQueued);
    }
  }, [hooks.onFileQueued, uploaderRef]);

  React.useEffect(() => {
    if (hooks.onFileRejected) {
      uploaderRef.on('rejected', hooks.onFileRejected);
      return () => uploaderRef.off('rejected', hooks.onFileRejected);
    }
  }, [hooks.onFileRejected, uploaderRef]);

  React.useEffect(() => {
    if (hooks.onFileRemoved) {
      uploaderRef.on('removed', hooks.onFileRemoved);
      return () => uploaderRef.off('removed', hooks.onFileRemoved);
    }
  }, [hooks.onFileRemoved, uploaderRef]);

  React.useEffect(() => {
    if (hooks.onUploadLimitExceeded) {
      uploaderRef.on('limit_exceeded', hooks.onUploadLimitExceeded);
      return () =>
        uploaderRef.off('limit_exceeded', hooks.onUploadLimitExceeded);
    }
  }, [hooks.onUploadLimitExceeded, uploaderRef]);

  React.useEffect(() => {
    if (hooks.onUploadLimitReached) {
      uploaderRef.on('limit_reached', hooks.onUploadLimitReached);
      return () => uploaderRef.off('limit_reached', hooks.onUploadLimitReached);
    }
  }, [hooks.onUploadLimitReached, uploaderRef]);
}
