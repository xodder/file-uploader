'use client';

import { useFileStatus, useFileUploader } from '../helpers';
import { FileId } from '../types';
import { createComponent } from '../utils/create-component';
import { composable, ComposableComponentProps } from './shared/composable';

interface RemoveButtonProps extends ComposableComponentProps<'button'> {
  fileId: FileId;
  beforeAction?: () => Promise<boolean>;
  onlyRenderIfRemovable?: boolean;
}

export const RemoveButton = createComponent<RemoveButtonProps>(
  ({ fileId, beforeAction, onlyRenderIfRemovable, ...props }, ref) => {
    const uploader = useFileUploader();
    const status = useFileStatus(fileId);
    const removable =
      !status || ['queued', 'failed', 'complete'].includes(status);

    async function handleClick() {
      if (!beforeAction || (await beforeAction())) {
        uploader.removeFile(fileId);
      }
    }

    if (removable || !onlyRenderIfRemovable) {
      return (
        <composable.button
          type="button"
          {...props}
          ref={ref}
          onClick={handleClick as any}
        />
      );
    }

    return null;
  }
);
