import React from 'react';
import { useFileUploaderRef, useIsUploadCancelable } from '../..';

function FileUploaderCancelButton({
  component,
  fileId,
  onlyRenderIfCancelable,
  beforeAction,
  ...props
}) {
  const Component = component || 'button';
  const uploaderRef = useFileUploaderRef();
  const cancelable = useIsUploadCancelable(fileId);

  async function onClick() {
    if (!beforeAction || (await beforeAction())) {
      if (fileId === undefined) {
        uploaderRef.cancelAll();
      } else {
        uploaderRef.cancel(fileId);
      }
    }
  }

  if (cancelable || !onlyRenderIfCancelable) {
    return (
      <Component
        {...props}
        onClick={cancelable ? onClick : null}
        disabled={!cancelable}
      />
    );
  }

  return null;
}

export default FileUploaderCancelButton;
