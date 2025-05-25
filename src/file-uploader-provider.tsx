'use client';

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';
import {
  FileUploader,
  FileUploaderConfig,
  FileUploaderEvent,
} from './file-uploader';
import { FileId } from './types';
import { useConstant } from './utils/use-constant';

type FileUploaderContextValue = {
  ref: FileUploader;
  fileIds: FileId[];
};

const FileUploaderContext = createContext<any>({});

type FileUploaderProviderProps = {
  options: FileUploaderConfig;
  children: ReactNode | ((uploader: FileUploader) => ReactNode);
};

/**
 * FileUploaderProvider
 *
 * @example
 *
 * ```tsx
 * <FileUploaderProvider options={...}>
 *    {(uploader) => (...)}
 * </FileUploaderProvider>
 * ```
 *
 * ```tsx
 * <FileUploaderProvider options={...}>
 *    ...
 * </FileUploaderProvider>
 * ```
 *
 */
export function FileUploaderProvider({
  children,
  options,
}: FileUploaderProviderProps) {
  const uploader = useConstant(() => new FileUploader(options));
  const fileIds = useUploaderFileIds(uploader);

  const value = {
    ref: uploader,
    fileIds,
  };

  return (
    <FileUploaderContext.Provider value={value}>
      {typeof children === 'function' ? children(uploader) : children}
    </FileUploaderContext.Provider>
  );
}

export function useFileUploaderContext() {
  const context = useContext(FileUploaderContext);

  if (!context) {
    throw new Error(
      'useFileUploaderContext can only be within a FileUploaderProvider'
    );
  }

  return context as FileUploaderContextValue;
}

function useUploaderFileIds(uploader: FileUploader) {
  const [fileIds, setFileIds] = useState<FileId[]>([]);

  useEffect(() => {
    const onFileQueued = (fileId: FileId) => {
      setFileIds((prev) => [...prev, fileId]);
    };

    uploader.on(FileUploaderEvent.QUEUED, onFileQueued);
    return () => uploader.off(FileUploaderEvent.QUEUED, onFileQueued);
  }, [uploader]);

  useEffect(() => {
    const onFileQueued = (fileId: FileId) => {
      setFileIds((prev) => prev.filter((id) => id !== fileId));
    };

    uploader.on(FileUploaderEvent.REMOVED, onFileQueued);
    return () => uploader.off(FileUploaderEvent.REMOVED, onFileQueued);
  }, [uploader]);

  return fileIds;
}
