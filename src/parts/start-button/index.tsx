import React from 'react';
import { OverridableComponentProps } from '../../types';
import { FileId, useFileUploaderRef, useIsUploadStartable } from '../..';

type BaseProps = {
  fileId: FileId;
  onlyRenderIfStartable?: boolean;
  beforeAction?: () => Promise<boolean>;
};

type FileUploaderStartButtonProps<C extends React.ElementType> =
  OverridableComponentProps<C, BaseProps>;

function FileUploaderStartButton<C extends React.ElementType>({
  component,
  fileId,
  onlyRenderIfStartable,
  beforeAction,
  ...props
}: FileUploaderStartButtonProps<C>) {
  const Tag: any = component || 'button';
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
      <Tag
        {...props}
        onClick={startable ? onClick : null}
        disabled={!startable}
      />
    );
  }

  return null;
}

export default FileUploaderStartButton;
