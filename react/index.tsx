import React from 'react';
import { FileUploader, FileUploaderConfig } from '../core';
import DropZone from '../core/drop-zone';
import { FileId, FileStatus } from '../core/types';
import { FileStatusEnum } from '../core/utils';
import { useConstant, useMountedCallback, useRerender } from './utils';

type FileUploaderContextValue = {
  ref: FileUploader;
  fileIds: FileId[];
};

const FileUploaderContext = React.createContext<any>({});

type FileUploaderProviderProps = React.PropsWithChildren<{
  options: FileUploaderConfig;
}>;

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
      {children}
    </FileUploaderContext.Provider>
  );
}

function useUploaderFileIds(uploaderRef: FileUploader) {
  const [fileIds, setFileIds] = React.useState<FileId[]>([]);

  React.useEffect(() => {
    const onFileQueued = (fileId: FileId) =>
      setFileIds((prev) => [...prev, fileId]);
    uploaderRef.on('queued', onFileQueued);
    return () => uploaderRef.off('queued', onFileQueued);
  }, [uploaderRef]);

  React.useEffect(() => {
    const onFileQueued = (fileId: FileId) =>
      setFileIds((prev) => prev.filter((id) => id !== fileId));
    uploaderRef.on('removed', onFileQueued);
    return () => uploaderRef.off('removed', onFileQueued);
  }, [uploaderRef]);

  return fileIds;
}

function useFileUploaderContext() {
  const context = React.useContext(FileUploaderContext);
  if (!context) {
    throw new Error(
      'useFileUploaderContext can only be within a FileUploaderProvider'
    );
  }
  return context as FileUploaderContextValue;
}

export function useFileUploaderRef() {
  return useFileUploaderContext().ref;
}

export function useFileUploaderData() {
  const rerender = useRerender();
  const { ref, fileIds } = useFileUploaderContext();

  useFileUploaderEvent({
    onStatusChanged: useMountedCallback(() => {
      rerender();
    }, [rerender]),
  });

  return {
    status: {
      started: ref.hasStarted(),
      done: ref.hasStarted() && ref.isComplete(),
    },
    fileIds,
    currentFileId: ref.getMostRecentActiveFileId(),
    activeFileCount: ref.getUploadingFileCount(),
    completedFileCount: ref.getUploadedFileCount(),
    totalFileCount: fileIds.length,
  };
}

export function useFileStatus(fileId?: FileId) {
  const uploaderRef = useFileUploaderRef();
  const rerender = useRerender();
  const file = fileId ? uploaderRef.getFile(fileId) : undefined;

  useFileUploaderEvent({
    onStatusChanged: (affectedFileId) => {
      if (affectedFileId === fileId || !fileId) {
        rerender();
      }
    },
  });

  return file?.status;
}

export function useFileName(fileId: FileId) {
  const uploaderRef = useFileUploaderRef();
  const file = uploaderRef.getFile(fileId);
  return file?.name;
}

export function useFileProgress(fileId: FileId) {
  const uploaderRef = useFileUploaderRef();
  const [progress, setProgress] = React.useState(() => {
    return uploaderRef.getFile(fileId)?.progress || 0;
  });

  useFileUploaderEvent({
    onUploadProgress: (affectedFileId, value) => {
      if (affectedFileId === fileId) {
        setProgress(value);
      }
    },
  });

  return progress;
}

export function useOverallProgress() {
  const uploaderRef = useFileUploaderRef();
  const [progress, setProgress] = React.useState(() => {
    return uploaderRef.getTotalProgress();
  });

  useFileUploaderEvent({
    onTotalProgress: (value) => {
      setProgress(value);
    },
  });

  return progress;
}

export function useFileThumbnailUrl(fileId: FileId, size: number) {
  const uploaderRef = useFileUploaderRef();
  const mountedRef = React.useRef(false);
  const [thumbnailUrl, setThumbnailUrl] = React.useState<string>(
    uploaderRef.getCachedThumbnailUrl(fileId) || ''
  );

  React.useEffect(() => {
    mountedRef.current = true;
    if (!thumbnailUrl) {
      uploaderRef.getThumbnailUrl(fileId, size).then((url) => {
        if (mountedRef.current) {
          setThumbnailUrl(url);
        }
      });
    }
    return () => {
      mountedRef.current = false;
    };
  }, [fileId, size, uploaderRef, thumbnailUrl]);

  return thumbnailUrl;
}

export function useIsUploadCancelable(fileId?: FileId) {
  const uploaderRef = useFileUploaderRef();
  const status = useFileStatus(fileId);

  if (!fileId) {
    return !uploaderRef.isComplete();
  }

  return [
    FileStatusEnum.QUEUED,
    FileStatusEnum.STARTED,
    FileStatusEnum.FAILED,
  ].includes(status as any);
}

export function useIsUploadStartable(fileId?: FileId) {
  const uploaderRef = useFileUploaderRef();
  const status = useFileStatus(fileId);
  if (!fileId) {
    return !uploaderRef.hasStarted();
  }
  return [FileStatusEnum.QUEUED, FileStatusEnum.FAILED].includes(status as any);
}

export function useIsUploadRetryable(fileId: FileId) {
  const status = useFileStatus(fileId);
  return status === FileStatusEnum.FAILED;
}

export function useFileUploaderDropZone(elementRef: React.RefObject<Element>) {
  const dropzoneRef = React.useRef<DropZone | null>();
  const uploaderRef = useFileUploaderRef();
  const [active, setActive] = React.useState(false);

  React.useEffect(() => {
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
          uploaderRef.addFiles(files);
        },
      });
    }

    return () => {
      dropzoneRef.current && dropzoneRef.current.dispose();
      dropzoneRef.current = null;
    };
  }, [elementRef, uploaderRef]);

  return { active };
}

interface FileUploaderEventHooks {
  onStatusChanged: (fileId: FileId, newStatus: FileStatus) => void;
  onUploadStarted: (fileId: FileId) => void;
  onUploadComplete: (fileId: FileId, response: any) => void;
  onUploadFailed: (fileId: FileId, error: any) => void;
  onUploadCancelled: (fileId: FileId) => void;
  onUploadProgress: (fileId: FileId, progress: number) => void;
  onAllComplete: () => void;
  onCancelAll: () => void;
  onTotalProgress: (progress: number) => void;
  onFileQueued: (fileId: FileId) => void;
  onFileRejected: (fileId: FileId, reasons: [string]) => void;
  onFileRemoved: (fileId: FileId) => void;
  onUploadLimitExceeded: (allowedCount: number, files: [File]) => void;
  onUploadLimitReached: () => void;
}

export function useFileUploaderEvent(hooks: Partial<FileUploaderEventHooks>) {
  const uploaderRef = useFileUploaderRef();

  React.useEffect(() => {
    if (hooks.onStatusChanged) {
      uploaderRef.on('statusChange', hooks.onStatusChanged);
      return () => uploaderRef.off('statusChange', hooks.onStatusChanged!);
    }
  }, [hooks.onStatusChanged, uploaderRef]);

  React.useEffect(() => {
    if (hooks.onUploadStarted) {
      uploaderRef.on('upload_started', hooks.onUploadStarted);
      return () => uploaderRef.off('upload_started', hooks.onUploadStarted!);
    }
  }, [hooks.onUploadStarted, uploaderRef]);

  React.useEffect(() => {
    if (hooks.onUploadComplete) {
      uploaderRef.on('upload_successful', hooks.onUploadComplete);
      return () =>
        uploaderRef.off('upload_successful', hooks.onUploadComplete!);
    }
  }, [hooks.onUploadComplete, uploaderRef]);

  React.useEffect(() => {
    if (hooks.onUploadFailed) {
      uploaderRef.on('upload_failed', hooks.onUploadFailed);
      return () => uploaderRef.off('upload_failed', hooks.onUploadFailed!);
    }
  }, [hooks.onUploadFailed, uploaderRef]);

  React.useEffect(() => {
    if (hooks.onUploadCancelled) {
      uploaderRef.on('upload_cancelled', hooks.onUploadCancelled);
      return () =>
        uploaderRef.off('upload_cancelled', hooks.onUploadCancelled!);
    }
  }, [hooks.onUploadCancelled, uploaderRef]);

  React.useEffect(() => {
    if (hooks.onUploadProgress) {
      uploaderRef.on('progress', hooks.onUploadProgress);
      return () => uploaderRef.off('progress', hooks.onUploadProgress!);
    }
  }, [hooks.onUploadProgress, uploaderRef]);

  React.useEffect(() => {
    if (hooks.onAllComplete) {
      uploaderRef.on('all_complete', hooks.onAllComplete);
      return () => uploaderRef.off('all_complete', hooks.onAllComplete!);
    }
  }, [hooks.onAllComplete, uploaderRef]);

  React.useEffect(() => {
    if (hooks.onCancelAll) {
      uploaderRef.on('cancel_all', hooks.onCancelAll);
      return () => uploaderRef.off('cancel_all', hooks.onCancelAll!);
    }
  }, [hooks.onCancelAll, uploaderRef]);

  React.useEffect(() => {
    if (hooks.onTotalProgress) {
      uploaderRef.on('total_progress', hooks.onTotalProgress);
      return () => uploaderRef.off('total_progress', hooks.onTotalProgress!);
    }
  }, [hooks.onTotalProgress, uploaderRef]);

  React.useEffect(() => {
    if (hooks.onFileQueued) {
      uploaderRef.on('queued', hooks.onFileQueued);
      return () => uploaderRef.off('queued', hooks.onFileQueued!);
    }
  }, [hooks.onFileQueued, uploaderRef]);

  React.useEffect(() => {
    if (hooks.onFileRejected) {
      uploaderRef.on('rejected', hooks.onFileRejected);
      return () => uploaderRef.off('rejected', hooks.onFileRejected!);
    }
  }, [hooks.onFileRejected, uploaderRef]);

  React.useEffect(() => {
    if (hooks.onFileRemoved) {
      uploaderRef.on('removed', hooks.onFileRemoved);
      return () => uploaderRef.off('removed', hooks.onFileRemoved!);
    }
  }, [hooks.onFileRemoved, uploaderRef]);

  React.useEffect(() => {
    if (hooks.onUploadLimitExceeded) {
      uploaderRef.on('limit_exceeded', hooks.onUploadLimitExceeded);
      return () =>
        uploaderRef.off('limit_exceeded', hooks.onUploadLimitExceeded!);
    }
  }, [hooks.onUploadLimitExceeded, uploaderRef]);

  React.useEffect(() => {
    if (hooks.onUploadLimitReached) {
      uploaderRef.on('limit_reached', hooks.onUploadLimitReached);
      return () =>
        uploaderRef.off('limit_reached', hooks.onUploadLimitReached!);
    }
  }, [hooks.onUploadLimitReached, uploaderRef]);
}
