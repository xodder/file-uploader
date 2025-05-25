'use client';

import { useEffect } from 'react';
import { FileUploaderEvent } from '../file-uploader';
import { FileId, FileStatus } from '../types';
import { useFileUploader } from './use-file-uploader';

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
  const uploader = useFileUploader();

  useEffect(() => {
    if (hooks.onStatusChanged) {
      uploader.on(FileUploaderEvent.STATUS_CHANGE, hooks.onStatusChanged);

      return () =>
        uploader.off(FileUploaderEvent.STATUS_CHANGE, hooks.onStatusChanged);
    }
  }, [hooks.onStatusChanged, uploader]);

  useEffect(() => {
    if (hooks.onUploadStarted) {
      uploader.on(FileUploaderEvent.UPLOAD_STARTED, hooks.onUploadStarted);

      return () =>
        uploader.off(FileUploaderEvent.UPLOAD_STARTED, hooks.onUploadStarted);
    }
  }, [hooks.onUploadStarted, uploader]);

  useEffect(() => {
    if (hooks.onUploadComplete) {
      uploader.on(FileUploaderEvent.UPLOAD_SUCCESSFUL, hooks.onUploadComplete);

      return () =>
        uploader.off(
          FileUploaderEvent.UPLOAD_SUCCESSFUL,
          hooks.onUploadComplete
        );
    }
  }, [hooks.onUploadComplete, uploader]);

  useEffect(() => {
    if (hooks.onUploadFailed) {
      uploader.on(FileUploaderEvent.UPLOAD_FAILED, hooks.onUploadFailed);

      return () =>
        uploader.off(FileUploaderEvent.UPLOAD_FAILED, hooks.onUploadFailed);
    }
  }, [hooks.onUploadFailed, uploader]);

  useEffect(() => {
    if (hooks.onUploadCancelled) {
      uploader.on(FileUploaderEvent.UPLOAD_CANCELLED, hooks.onUploadCancelled);

      return () =>
        uploader.off(
          FileUploaderEvent.UPLOAD_CANCELLED,
          hooks.onUploadCancelled
        );
    }
  }, [hooks.onUploadCancelled, uploader]);

  useEffect(() => {
    if (hooks.onUploadProgress) {
      uploader.on(FileUploaderEvent.UPLOAD_PROGRESS, hooks.onUploadProgress);

      return () =>
        uploader.off(FileUploaderEvent.UPLOAD_PROGRESS, hooks.onUploadProgress);
    }
  }, [hooks.onUploadProgress, uploader]);

  useEffect(() => {
    if (hooks.onAllComplete) {
      uploader.on(FileUploaderEvent.ALL_COMPLETE, hooks.onAllComplete);

      return () =>
        uploader.off(FileUploaderEvent.ALL_COMPLETE, hooks.onAllComplete);
    }
  }, [hooks.onAllComplete, uploader]);

  useEffect(() => {
    if (hooks.onCancelAll) {
      uploader.on(FileUploaderEvent.CANCEL_ALL, hooks.onCancelAll);

      return () =>
        uploader.off(FileUploaderEvent.CANCEL_ALL, hooks.onCancelAll);
    }
  }, [hooks.onCancelAll, uploader]);

  useEffect(() => {
    if (hooks.onTotalProgress) {
      uploader.on(FileUploaderEvent.TOTAL_PROGRESS, hooks.onTotalProgress);

      return () =>
        uploader.off(FileUploaderEvent.TOTAL_PROGRESS, hooks.onTotalProgress);
    }
  }, [hooks.onTotalProgress, uploader]);

  useEffect(() => {
    if (hooks.onFileQueued) {
      uploader.on(FileUploaderEvent.QUEUED, hooks.onFileQueued);

      return () => uploader.off(FileUploaderEvent.QUEUED, hooks.onFileQueued);
    }
  }, [hooks.onFileQueued, uploader]);

  useEffect(() => {
    if (hooks.onFileRejected) {
      uploader.on(FileUploaderEvent.REJECTED, hooks.onFileRejected);

      return () =>
        uploader.off(FileUploaderEvent.REJECTED, hooks.onFileRejected);
    }
  }, [hooks.onFileRejected, uploader]);

  useEffect(() => {
    if (hooks.onFileRemoved) {
      uploader.on(FileUploaderEvent.REMOVED, hooks.onFileRemoved);

      return () => uploader.off(FileUploaderEvent.REMOVED, hooks.onFileRemoved);
    }
  }, [hooks.onFileRemoved, uploader]);

  useEffect(() => {
    if (hooks.onUploadLimitExceeded) {
      uploader.on(
        FileUploaderEvent.LIMIT_EXCEEDED,
        hooks.onUploadLimitExceeded
      );

      return () =>
        uploader.off(
          FileUploaderEvent.LIMIT_EXCEEDED,
          hooks.onUploadLimitExceeded
        );
    }
  }, [hooks.onUploadLimitExceeded, uploader]);

  useEffect(() => {
    if (hooks.onUploadLimitReached) {
      uploader.on(FileUploaderEvent.LIMIT_REACHED, hooks.onUploadLimitReached);

      return () =>
        uploader.off(
          FileUploaderEvent.LIMIT_REACHED,
          hooks.onUploadLimitReached
        );
    }
  }, [hooks.onUploadLimitReached, uploader]);
}
