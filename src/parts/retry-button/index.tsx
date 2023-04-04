import React from 'react';
import { OverridableComponentProps } from '../../types';
import { FileId, useFileUploaderRef, useIsUploadRetryable } from '../..';

type BaseProps = {
  fileId: FileId;
  onlyRenderIfRetryable?: boolean;
};

type FileUploaderRetryButtonProps<C extends React.ElementType> =
  OverridableComponentProps<C, BaseProps>;

function FileUploaderRetryButton<C extends React.ElementType>({
  component,
  fileId,
  onlyRenderIfRetryable,
  ...props
}: FileUploaderRetryButtonProps<C>) {
  const Tag: any = component || 'button';
  const uploaderRef = useFileUploaderRef();
  const retryable = useIsUploadRetryable(fileId);

  function onClick() {
    uploaderRef.retry(fileId);
  }

  if (retryable || !onlyRenderIfRetryable) {
    return (
      <Tag {...props} disabled={!retryable} onClick={retryable && onClick} />
    );
  }

  return null;
}

export default FileUploaderRetryButton;
