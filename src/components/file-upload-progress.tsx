'use client';

import { useMemo } from 'react';
import { useFileStatus } from '../helpers';
import { useFileProgress } from '../helpers/use-file-progress';
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
  const progress = useFileProgress(fileId);
  const status = useFileStatus(fileId);
  const hidden = useMemo(() => {
    if (!fileId) {
      return !!hideOnComplete && !uploader.isComplete();
    }

    return (
      (hideBeforeStart && status === 'queued') ||
      (hideOnComplete && status === 'complete')
    );
  }, [status]);

  return {
    hidden,
    progress,
  };
}
