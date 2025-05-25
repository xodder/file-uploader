'use client';

import { FileId, FileStatusEnum } from '../types';
import { useFileStatus } from './use-file-status';

export function useIsUploadRetryable(fileId: FileId) {
  const status = useFileStatus(fileId);

  return status === FileStatusEnum.FAILED;
}
