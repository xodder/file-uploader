'use client';

import { useFileUploaderContext } from '../file-uploader-provider';

export function useFileUploader() {
  return useFileUploaderContext().ref;
}
