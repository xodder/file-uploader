'use client';

import { useFileStatus } from '../helpers/use-file-status';
import { FileId, FileStatus, FileStatusEnum } from '../types';
import { createComponent } from '../utils/create-component';
import { composable, ComposableComponentProps } from './shared/composable';

const defaultStatusToTextMap: Record<string, string> = {
  [FileStatusEnum.QUEUED]: 'Queued',
  [FileStatusEnum.STARTED]: 'Uploading...',
  [FileStatusEnum.COMPLETE]: 'Completed',
  [FileStatusEnum.FAILED]: 'Failed',
  [FileStatusEnum.CANCELLING]: 'Cancelling...',
};

type BaseProps = ComposableComponentProps<'span'>;

export interface StatusTextProps extends BaseProps {
  fileId: FileId;
  statusToTextMap?: Partial<Record<FileStatus, string>>;
}

export const StatusText = createComponent<StatusTextProps>(
  ({ fileId, statusToTextMap = {}, ...props }, ref) => {
    const status = useFileStatus(fileId);

    return (
      <composable.span {...props} ref={ref}>
        {(status &&
          (statusToTextMap[status] || defaultStatusToTextMap[status])) ||
          '----'}
      </composable.span>
    );
  }
);
