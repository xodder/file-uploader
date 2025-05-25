'use client';

import { useFileUploaderContext } from '../file-uploader-provider';

export function useFileUploaderFileIds() {
  return useFileUploaderContext().fileIds;
}
