import React from 'react';
import { FileStatusEnum, useFileStatus } from '../..';

const defaultStatusToTextMap = {
  [FileStatusEnum.QUEUED]: 'Queued',
  [FileStatusEnum.STARTED]: 'Uploading...',
  [FileStatusEnum.COMPLETE]: 'Completed',
  [FileStatusEnum.FAILED]: 'Failed',
  [FileStatusEnum.CANCELLING]: 'Cancelling...',
};

function FileUploaderStatusText({
  component,
  fileId,
  statusToTextMap = {},
  ...props
}) {
  const Component = component || 'span';
  const status = useFileStatus(fileId);

  return (
    <Component {...props}>
      {statusToTextMap[status] || defaultStatusToTextMap[status] || '-----'}
    </Component>
  );
}

export default FileUploaderStatusText;
