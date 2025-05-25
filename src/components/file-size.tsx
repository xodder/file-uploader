'use client';

import { ReactNode } from 'react';
import { useFileUploader } from '../helpers';
import { FileId } from '../types';
import { createComponent } from '../utils/create-component';
import { composable, ComposableComponentProps } from './shared/composable';

type BaseProps = ComposableComponentProps<'span'>;

export interface FileSizeProps extends BaseProps {
  fileId: FileId;
  format?: (value: number) => ReactNode;
}

export const FileSize = createComponent<FileSizeProps>(
  ({ fileId, format, ...props }, ref) => {
    const uploader = useFileUploader();
    const file = uploader.getFile(fileId);

    return (
      <composable.span {...props} ref={ref}>
        {format ? format(file.size) : file.size}
      </composable.span>
    );
  }
);
