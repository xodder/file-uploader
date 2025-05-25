'use client';

import { FileId, FileStatusEnum } from '../types';
import { useFileStatus } from './use-file-status';
import { useFileUploader } from './use-file-uploader';

export function useIsUploadStartable(fileId?: FileId) {
  const uploader = useFileUploader();
  const status = useFileStatus(fileId);

  if (!fileId) {
    return !uploader.hasStarted();
  }

  return [FileStatusEnum.QUEUED, FileStatusEnum.FAILED].includes(status as any);
}
