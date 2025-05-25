'use client';

import { FileId } from '../types';
import { useFileUploader } from './use-file-uploader';

export function useFileName(fileId: FileId) {
  const uploader = useFileUploader();
  const file = uploader.getFile(fileId);

  return file?.name;
}
