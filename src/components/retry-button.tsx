'use client';

import { useFileUploader } from '../helpers/use-file-uploader';
import { useIsUploadRetryable } from '../helpers/use-is-upload-retryable';
import { FileId } from '../types';
import { createComponent } from '../utils/create-component';
import { composable, ComposableComponentProps } from './shared/composable';

type BaseProps = ComposableComponentProps<'button'>;

export interface RetryButtonProps extends BaseProps {
  fileId: FileId;
  onlyRenderIfRetryable?: boolean;
}

export const RetryButton = createComponent<RetryButtonProps>(
  ({ fileId, onlyRenderIfRetryable, ...props }, ref) => {
    const uploader = useFileUploader();
    const retryable = useIsUploadRetryable(fileId);

    function handleClick() {
      if (!retryable) return;

      uploader.retry(fileId);
    }

    if (retryable || !onlyRenderIfRetryable) {
      return (
        <composable.button
          type="button"
          {...props}
          ref={ref}
          disabled={!retryable}
          onClick={handleClick}
        />
      );
    }

    return null;
  }
);
