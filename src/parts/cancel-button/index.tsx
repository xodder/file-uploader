import React from 'react';
import { OverridableComponentProps } from '../../types';
import { useFileUploaderRef, useIsUploadCancelable, FileId } from '../..';

type BaseProps = {
  fileId: FileId;
  onlyRenderIfCancelable?: boolean;
  beforeAction?: () => Promise<boolean>;
};

type FileUploaderCancelButtonProps<C extends React.ElementType> =
  OverridableComponentProps<C, BaseProps>;

function FileUploaderCancelButton<C extends React.ElementType>({
  component,
  fileId,
  onlyRenderIfCancelable,
  beforeAction,
  ...props
}: FileUploaderCancelButtonProps<C>) {
  const Tag: any = component || 'button';
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
      <Tag
        {...props}
        onClick={cancelable ? onClick : null}
        disabled={!cancelable}
      />
    );
  }

  return null;
}

export default FileUploaderCancelButton;
