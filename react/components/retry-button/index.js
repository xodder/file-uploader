import React from 'react';
import { useFileUploaderRef, useIsUploadRetryable } from '../..';

function FileUploaderRetryButton({
  fileId,
  component,
  onlyRenderIfRetryable,
  ...props
}) {
  const Component = component || 'button';
  const uploaderRef = useFileUploaderRef();
  const retryable = useIsUploadRetryable(fileId);

  function onClick() {
    uploaderRef.retry(fileId);
  }

  if (retryable || !onlyRenderIfRetryable) {
    return (
      <Component
        {...props}
        disabled={!retryable}
        onClick={retryable && onClick}
      />
    );
  }

  return null;
}

export default FileUploaderRetryButton;
