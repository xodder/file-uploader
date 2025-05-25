'use client';

import { useState } from 'react';
import { useFileProgress } from '../helpers/use-file-progress';
import { useFileUploaderEvent } from '../helpers/use-file-uploader-event';
import { useFileUploader } from '../helpers/use-file-uploader';
import { FileId } from '../types';

type PassProps = {
  progress: number;
};

export interface FileUploadProgressProps {
  fileId: FileId;
  hideBeforeStart?: boolean;
  hideOnComplete?: boolean;
  children: (props: PassProps) => JSX.Element;
}

export function FileUploadProgress({
  fileId,
  hideBeforeStart,
  hideOnComplete,
  children,
}: FileUploadProgressProps) {
  const uploader = useFileUploader();
  const { progress, hidden } = useProgressInfo({
    fileId,
    uploader,
    hideBeforeStart,
    hideOnComplete,
  });

  return hidden ? null : children({ progress });
}

type UseProgressInfoOptions = {
  fileId: FileId;
  uploader: ReturnType<typeof useFileUploader>;
  hideBeforeStart?: boolean;
  hideOnComplete?: boolean;
};

function useProgressInfo({
  fileId,
  uploader,
  hideBeforeStart,
  hideOnComplete,
}: UseProgressInfoOptions) {
  const [hidden, setHidden] = useState(!!hideBeforeStart);
  const progress = useFileProgress(fileId);

  useFileUploaderEvent({
    onStatusChanged: (affectedFileId, newStatus) => {
      if (!fileId) {
        setHidden(!!hideOnComplete && !uploader.isComplete());
      } else if (affectedFileId === fileId) {
        setHidden(!!hideOnComplete && newStatus === 'complete');
      }
    },
  });

  return { hidden, progress };
}
