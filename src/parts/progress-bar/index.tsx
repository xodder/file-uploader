import React from 'react';
import {
  useFileProgress,
  useFileUploaderRef,
  FileId,
  FileUploaderEventHooks,
} from '../..';

type PassProps = {
  progress: number;
};

type FileUploaderProgressBarProps = {
  fileId: FileId;
  hideBeforeStart?: boolean;
  hideOnComplete?: boolean;
  children: (passProps: PassProps) => JSX.Element;
};

function FileUploaderProgressBar({
  fileId,
  hideBeforeStart,
  hideOnComplete,
  children,
}: FileUploaderProgressBarProps) {
  const uploaderRef = useFileUploaderRef();
  const { progress, hidden } = useProgressInfo({
    fileId,
    uploaderRef,
    hideBeforeStart,
    hideOnComplete,
  });

  return hidden ? null : children({ progress });
}

type UseProgressInfoOptions = {
  fileId: FileId;
  uploaderRef: ReturnType<typeof useFileUploaderRef>;
  hideBeforeStart?: boolean;
  hideOnComplete?: boolean;
};

function useProgressInfo({
  fileId,
  uploaderRef,
  hideBeforeStart,
  hideOnComplete,
}: UseProgressInfoOptions) {
  const [hidden, setHidden] = React.useState(!!hideBeforeStart);
  const progress = useFileProgress(fileId);

  React.useEffect(() => {
    const onStatusChanged: FileUploaderEventHooks['onStatusChanged'] = (
      affectedFileId,
      newStatus
    ) => {
      if (!fileId) {
        setHidden(!!hideOnComplete && !uploaderRef.isComplete());
      } else if (affectedFileId === fileId) {
        setHidden(!!hideOnComplete && newStatus === 'complete');
      }
    };

    uploaderRef.on('statusChange', onStatusChanged);
    return () => {
      uploaderRef.off('statusChange', onStatusChanged);
    };
  }, [fileId, hideOnComplete, uploaderRef]);

  return { hidden, progress };
}

export default FileUploaderProgressBar;
