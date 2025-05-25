'use client';

import { RefObject, useRef, useState, useEffect } from 'react';
import { DropZone } from '../dropzone';
import { useFileUploader } from './use-file-uploader';

export function useFileUploaderDropZone(elementRef: RefObject<Element | null>) {
  const dropzoneRef = useRef<DropZone | null>();
  const uploader = useFileUploader();
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (elementRef.current && !dropzoneRef.current) {
      dropzoneRef.current = new DropZone(elementRef.current, {
        onEnter: () => {
          setActive(true);
        },
        onActualLeave: () => {
          setActive(false);
        },
        onFiles: (files) => {
          setActive(false);
          uploader.addFiles(files);
        },
      });
    }

    return () => {
      dropzoneRef.current && dropzoneRef.current.dispose();
      dropzoneRef.current = null;
    };
  }, [elementRef, uploader]);

  return { active };
}
