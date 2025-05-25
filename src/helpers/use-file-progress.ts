'use client';

import { useState } from 'react';
import { FileId } from '../types';
import { useFileUploaderEvent } from './use-file-uploader-event';
import { useFileUploader } from './use-file-uploader';

export function useFileProgress(fileId: FileId) {
  const uploader = useFileUploader();
  const [progress, setProgress] = useState(() => {
    return uploader.getFile(fileId)?.progress || 0;
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
