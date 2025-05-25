'use client';

import { FileId, FileStatusEnum } from '../types';
import { useFileStatus } from './use-file-status';
import { useFileUploader } from './use-file-uploader';

export function useIsUploadCancelable(fileId?: FileId) {
  const uploader = useFileUploader();
  const status = useFileStatus(fileId);

  if (!fileId) {
    return !uploader.isComplete();
  }

  return status === FileStatusEnum.STARTED;
}
