'use client';

import { useState } from 'react';
import { useFileUploaderEvent } from './use-file-uploader-event';
import { useFileUploader } from './use-file-uploader';

export function useOverallProgress() {
  const uploader = useFileUploader();
  const [progress, setProgress] = useState(() => uploader.getTotalProgress());

  useFileUploaderEvent({
    onTotalProgress: (value) => setProgress(value),
  });

  return progress;
}
