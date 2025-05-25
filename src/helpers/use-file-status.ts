'use client';

import { FileId } from '../types';
import { useRerender } from '../utils/use-rerender';
import { useFileUploader } from './use-file-uploader';
import { useFileUploaderEvent } from './use-file-uploader-event';

export function useFileStatus(fileId?: FileId) {
  const uploader = useFileUploader();
  const rerender = useRerender();
  const file = fileId ? uploader.getFile(fileId) : undefined;

  useFileUploaderEvent({
    onStatusChanged: (affectedFileId: FileId) => {
      if (affectedFileId === fileId || !fileId) {
        rerender();
      }
    },
  });

  return file?.status;
}
