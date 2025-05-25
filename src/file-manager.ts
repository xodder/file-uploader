import { EventEmitter } from './event-emitter';
import { fileTypeToCategoryMap } from './helpers';
import { FileId, InternalFile } from './types';
import { formatBytes } from './utils/format-bytes';
import { getFileThumbnailUrl } from './utils/get-file-thumbnail-url';
import { getFileTypeFromExtension } from './utils/get-file-type-from-extension';

interface FileManagerConfig {
  allowedFileCount: number;
  allowedFileTypes: string[];
  maxAllowedFileSize: number;
  minAllowedFileSize: number;
}

export enum FileManagerEvent {
  ACCEPTED = 'accepted',
  REMOVED = 'removed',
  REJECTED = 'rejected',
  CHANGED = 'changed',
}

export class FileManager {
  private emitter = new EventEmitter();
  private files: Record<FileId, InternalFile> = {};
  private validators = [validateFileType, validateFileSize];
  private thumbnailUrls: Record<FileId, string> = {};
  private allowedFileCount = 0;
  private config: FileManagerConfig = {
    allowedFileCount: -1,
    allowedFileTypes: [],
    maxAllowedFileSize: -1,
    minAllowedFileSize: -1,
  };

  on = this.emitter.on.bind(this);
  off = this.emitter.off.bind(this);
  emit = this.emitter.emit.bind(this);

  constructor(config: FileManagerConfig) {
    this.config = config;
    this.allowedFileCount = config.allowedFileCount;
  }

  reset() {
    for (const fileId in this.files) {
      this.removeFile(fileId);
    }

    this.files = {};
    this.thumbnailUrls = {};
    this.allowedFileCount = this.config.allowedFileCount;
  }

  getAllowedFileCount() {
    return this.allowedFileCount;
  }

  setAllowedFileCount(count: number) {
    this.allowedFileCount = count;
  }

  getAllFileIds() {
    return Object.keys(this.files);
  }

  getFile(fileId: FileId) {
    return this.files[fileId];
  }

  getRawFile(fileId: FileId) {
    return this.files[fileId]?.__raw;
  }

  removeFile(fileId: FileId) {
    if (fileId in this.files) {
      delete this.files[fileId];
      delete this.thumbnailUrls[fileId];
      this.emit(FileManagerEvent.REMOVED, fileId);
    }
  }

  updateFile(fileId: FileId, updates: Partial<InternalFile>) {
    this.files[fileId] = {
      ...this.files[fileId],
      ...updates,
    };
    this.emit(FileManagerEvent.CHANGED, fileId, updates);
  }

  async addFile(file: File) {
    if (!this.isFilledUp()) {
      await this.processFile(file);
    }
  }

  isFilledUp() {
    return this.allowedFileCount === 0;
  }

  isEmpty() {
    return Object.keys(this.files).length === 0;
  }

  private async processFile(file: File) {
    const errors = await this.validate(file);

    if (!errors || errors.length === 0) {
      this.markAsAccepted(file);
    } else {
      this.markAsRejected(file, errors);
    }
  }

  private async validate(file: File) {
    const errors = await Promise.all(
      this.validators.map((validator) => validator(file, this.config))
    );
    return errors.filter((error) => !!error) as string[];
  }

  private markAsAccepted(file: File) {
    const processedFile: InternalFile = {
      id: newID(),
      name: file.name,
      size: file.size,
      type: file.type,
      category:
        fileTypeToCategoryMap[
          file.type as keyof typeof fileTypeToCategoryMap
        ] || '',
      status: 'accepted',
      progress: 0,
      __raw: file,
    };

    if (this.allowedFileCount > 0) {
      this.allowedFileCount--;
    }

    // add accepted file to accepted files queue
    this.files[processedFile.id] = processedFile;
    // notify processing completion
    this.emit(FileManagerEvent.ACCEPTED, processedFile);
  }

  private markAsRejected(file: File, reasons: string[]) {
    this.emit(FileManagerEvent.REJECTED, file, reasons);
  }

  async getThumbnailUrl(fileId: FileId, maxSize: number) {
    let thumbnailUrl = this.thumbnailUrls[fileId];

    if (!thumbnailUrl) {
      thumbnailUrl = await getFileThumbnailUrl(
        this.getRawFile(fileId),
        maxSize
      );
    }

    return thumbnailUrl;
  }

  getEagerThumbnailUrl(fileId: FileId) {
    return this.thumbnailUrls[fileId];
  }
}

function newID() {
  return generateRandomStr(8);
}

const charset =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function generateRandomStr(length = 5) {
  return Array.from({ length }, () => {
    return charset[Math.round(Math.random() * charset.length)];
  }).join('');
}

function validateFileType(file: File, config: FileManagerConfig) {
  const fileType = file.type || getFileTypeFromExtension(file);
  const isValid =
    config.allowedFileTypes.length === 0 ||
    config.allowedFileTypes.includes(fileType) ||
    config.allowedFileTypes.some((allowedFileType) => {
      return new RegExp(allowedFileType).test(file.type);
    });

  if (!isValid) {
    return 'File type is not supported';
  }

  return null;
}

function validateFileSize(file: File, config: FileManagerConfig) {
  const minAllowedFileSize = config.minAllowedFileSize;
  const maxAllowedFileSize = config.maxAllowedFileSize;
  const formatedFileSize = formatBytes(file.size);

  if (minAllowedFileSize !== -1 && file.size < minAllowedFileSize) {
    return `File's size (${formatedFileSize}) is smaller than the allowed file size (${formatBytes(
      minAllowedFileSize
    )})`;
  }

  if (maxAllowedFileSize !== -1 && file.size > maxAllowedFileSize) {
    return `File's size (${formatedFileSize}) is greater than the allowed file size (${formatBytes(
      maxAllowedFileSize
    )})`;
  }

  return null;
}
