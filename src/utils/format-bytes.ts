import { filesize, FileSizeOptionsObject } from 'filesize';

type Options = Pick<FileSizeOptionsObject, 'locale' | 'round' | 'spacer'>;

export function formatBytes(bytes: number, options?: Options) {
  return filesize(bytes, options);
}
