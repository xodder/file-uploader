import MockEventEmitter from '../mock-event-emitter';
import { FileId, FileInfo } from '../types';
import {
  generateRandomStr,
  getFileThumbnailUrl,
  getFileTypeFromExtension,
} from '../utils';

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

export default FileManager;
