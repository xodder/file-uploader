'use client';

import { ComponentProps, CSSProperties } from 'react';
import { useFileThumbnailUrl } from '../helpers/use-file-thumbnail-url';
import { FileId } from '../types';
import { createComponent } from '../utils/create-component';
import { composable, ComposableComponentProps } from './shared/composable';

type BaseProps = ComposableComponentProps<'div'>;

export interface ThumbnailProps extends BaseProps {
  fileId: FileId;
  height: number;
  width: number;
  rounded?: boolean;
  fallbackURL?: string;
  style?: CSSProperties;
  imgProps?: ComponentProps<'img'>;
}

export const Thumbnail = createComponent<ThumbnailProps>((inProps, ref) => {
  const {
    fileId,
    height,
    width,
    rounded,
    fallbackURL,
    imgProps,
    style,
    ...props
  } = inProps;

  const maxSize = Math.max(width, height) * 2;
  const thumbnailUrl = useFileThumbnailUrl(fileId, maxSize) || fallbackURL;
  const canShowImage = !!thumbnailUrl;

  return (
    <composable.div
      {...props}
      ref={ref}
      style={{
        position: 'relative',
        height,
        width,
        flexShrink: 0,
        overflow: 'hidden',
        backgroundColor: '#ededed',
        borderRadius: rounded ? '50%' : undefined,
        ...style,
      }}
    >
      <img
        key={fileId}
        src={thumbnailUrl}
        {...imgProps}
        alt="img"
        style={{
          height: '100%',
          width: '100%',
          objectFit: 'cover',
          opacity: canShowImage ? 1 : 0,
          transition: 'opacity 120ms ease-in-out',
          ...imgProps?.style,
        }}
      />
    </composable.div>
  );
});
