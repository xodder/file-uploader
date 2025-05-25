'use client';

import { useFileUploader } from '../helpers/use-file-uploader';
import { useIsUploadCancelable } from '../helpers/use-is-upload-cancelable';
import { FileId } from '../types';
import { createComponent } from '../utils/create-component';
import { composable, ComposableComponentProps } from './shared/composable';

type BaseProps = ComposableComponentProps<'button'>;

export interface CancelButtonProps extends BaseProps {
  fileId: FileId;
  onlyRenderIfCancelable?: boolean;
  beforeAction?: () => Promise<boolean>;
}

export const CancelButton = createComponent<CancelButtonProps>(
  ({ fileId, onlyRenderIfCancelable, beforeAction, ...props }, ref) => {
    const uploader = useFileUploader();
    const cancelable = useIsUploadCancelable(fileId);

    async function onClick() {
      if (!beforeAction || (await beforeAction())) {
        if (fileId === undefined) {
          uploader.cancelAll();
        } else {
          uploader.cancel(fileId);
        }
      }
    }

    if (cancelable || !onlyRenderIfCancelable) {
      return (
        <composable.button
          type="button"
          {...props}
          ref={ref}
          onClick={cancelable ? onClick : undefined}
          disabled={!cancelable}
        />
      );
    }

    return null;
  }
);
