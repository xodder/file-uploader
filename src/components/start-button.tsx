'use client';

import { useFileUploader } from '../helpers/use-file-uploader';
import { useIsUploadStartable } from '../helpers/use-is-upload-startable';
import { FileId } from '../types';
import { createComponent } from '../utils/create-component';
import { composable, ComposableComponentProps } from './shared/composable';

type BaseProps = ComposableComponentProps<'button'>;

export interface StartButtonProps extends BaseProps {
  fileId?: FileId;
  onlyRenderIfStartable?: boolean;
  beforeAction?: () => Promise<boolean>;
}

export const StartButton = createComponent<StartButtonProps>(
  ({ fileId, onlyRenderIfStartable, beforeAction, ...props }, ref) => {
    const uploader = useFileUploader();
    const startable = useIsUploadStartable(fileId);

    async function handleClick() {
      if (!startable) return;

      if (!beforeAction || (await beforeAction())) {
        if (fileId === undefined) {
          uploader.startAll();
        } else {
          uploader.start(fileId);
        }
      }
    }

    if (startable || !onlyRenderIfStartable) {
      return (
        <composable.button
          type="button"
          {...props}
          ref={ref}
          onClick={handleClick as any}
          disabled={!startable}
        />
      );
    }

    return null;
  }
);
