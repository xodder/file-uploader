import { FileStatusEnum } from '../utils';

export type FileId = string;

type ValueOf<T> = T extends Record<string, infer U> ? U : never;

export type FileStatus = ValueOf<typeof FileStatusEnum>;

export interface FileHandler {
  start: (file: File) => Promise<void>;
  cancel: () => void;
}

export interface FileInfo {
  id: FileId;
  name: string;
  size: number;
  type: string;
  status: FileStatus;
  progress: number;
  __handler?: FileHandler;
  __raw: File;
}
