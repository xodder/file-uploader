import React from 'react';
import { OverridableComponentProps } from '../../types';
import { FileId, FileStatus, FileStatusEnum, useFileStatus } from '../..';

const defaultStatusToTextMap: Record<string, string> = {
  [FileStatusEnum.QUEUED]: 'Queued',
  [FileStatusEnum.STARTED]: 'Uploading...',
  [FileStatusEnum.COMPLETE]: 'Completed',
  [FileStatusEnum.FAILED]: 'Failed',
  [FileStatusEnum.CANCELLING]: 'Cancelling...',
};

type BaseProps = {
  fileId: FileId;
  statusToTextMap?: Partial<Record<FileStatus, string>>;
};

type FileUploaderStatusTextProps<C extends React.ElementType> =
  OverridableComponentProps<C, BaseProps>;

function FileUploaderStatusText<C extends React.ElementType>({
  component,
  fileId,
  statusToTextMap = {},
  ...props
}: FileUploaderStatusTextProps<C>) {
  const Tag: any = component || 'span';
  const status = useFileStatus(fileId);

  return (
    <Tag {...props}>
      {(status &&
        (statusToTextMap[status] || defaultStatusToTextMap[status])) ||
        '----'}
    </Tag>
  );
}

export default FileUploaderStatusText;
