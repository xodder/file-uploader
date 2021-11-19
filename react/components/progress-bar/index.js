import React from 'react';
import { useFileProgress, useFileUploaderRef } from '../..';

function FileUploaderProgressBar({
  fileId,
  hideBeforeStart,
  hideOnComplete,
  children,
  ...props
}) {
  const uploaderRef = useFileUploaderRef();
  const { progress, hidden } = useProgressInfo(
    fileId,
    uploaderRef,
    hideBeforeStart,
    hideOnComplete
  );

  return children({ progress, hidden, ...props });
}

function useProgressInfo(fileId, uploaderRef, hideBeforeStart, hideOnComplete) {
  const [hidden, setHidden] = React.useState(hideBeforeStart);
  const progress = useFileProgress(fileId);

  React.useEffect(() => {
    function onStatusChanged(affectedFileId, newStatus) {
      if (!fileId) {
        setHidden(hideOnComplete ? !uploaderRef.isComplete() : false);
      } else if (affectedFileId === fileId) {
        setHidden(hideOnComplete && newStatus === 'complete');
      }
    }

    uploaderRef.on('statusChange', onStatusChanged);
    return () => {
      uploaderRef.off('statusChange', onStatusChanged);
    };
  }, [fileId, hideOnComplete, uploaderRef]);

  return { hidden, progress };
}

export default FileUploaderProgressBar;
