'use client';

import { useRef, useState, useEffect } from 'react';
import { FileId } from '../types';
import { useFileUploader } from './use-file-uploader';

export function useFileThumbnailUrl(fileId: FileId, size: number) {
  const uploader = useFileUploader();
  const mountedRef = useRef(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string>(
    uploader.getEagerThumbnailUrl(fileId) || ''
  );

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    uploader
      .getThumbnailUrl(fileId, size)
      .then((url) => {
        if (mountedRef.current) {
          setThumbnailUrl(url);
        }
      })
      .catch(() => void 0);
  }, [fileId, size, thumbnailUrl, uploader]);

  return thumbnailUrl;
}
