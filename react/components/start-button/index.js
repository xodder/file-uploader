import React from 'react';
import { useFileUploaderRef, useIsUploadStartable } from '../..';

function FileUploaderStartButton({
  component,
  fileId,
  onlyRenderIfStartable,
  beforeAction,
  ...props
}) {
  const Component = component || 'button';
  const uploaderRef = useFileUploaderRef();
  const startable = useIsUploadStartable(fileId);

  async function onClick() {
    if (!beforeAction || (await beforeAction())) {
      if (fileId === undefined) {
        uploaderRef.startAll();
      } else {
        uploaderRef.start(fileId);
      }
    }
  }

  if (startable || !onlyRenderIfStartable) {
    return (
      <Component
        {...props}
        onClick={startable ? onClick : null}
        disabled={!startable}
      />
    );
  }

  return null;
}

export default FileUploaderStartButton;
