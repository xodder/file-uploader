'use client';

import { useFileName } from '../helpers/use-file-name';
import { FileId } from '../types';
import { createComponent } from '../utils/create-component';
import { composable, ComposableComponentProps } from './shared/composable';

type BaseProps = ComposableComponentProps<'span'>;

export interface FileNameProps extends BaseProps {
  fileId: FileId;
  format?: (value: string) => string;
}

export const FileName = createComponent<FileNameProps>(
  ({ fileId, format, ...props }, ref) => {
    const fileName = useFileName(fileId);

    return (
      <composable.span {...props} ref={ref}>
        {format ? format(fileName) : fileName}
      </composable.span>
    );
  }
);
