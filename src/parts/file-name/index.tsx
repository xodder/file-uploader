import React from 'react';
import { FileId, useFileName } from '../..';
import { OverridableComponentProps } from '../../types';

type FileUploaderFileNameProps<C extends React.ElementType> =
  OverridableComponentProps<
    C,
    {
      fileId: FileId;
    }
  >;

function FileUploaderFileName<C extends React.ElementType>({
  component,
  fileId,
  ...props
}: FileUploaderFileNameProps<C>) {
  const Tag: any = component || 'span';
  const fileName = useFileName(fileId);

  return <Tag {...props}>{fileName}</Tag>;
}

export default FileUploaderFileName;
