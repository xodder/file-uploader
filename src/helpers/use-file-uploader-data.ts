'use client';

import { useFileUploaderContext } from '../file-uploader-provider';
import { useRerender } from '../utils/use-rerender';
import { useFileUploaderEvent } from './use-file-uploader-event';

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
