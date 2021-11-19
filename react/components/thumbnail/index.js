import React from 'react';
import { useFileThumbnailUrl } from '../..';

function FileUploaderThumbnail({
  fileId,
  height,
  width,
  rounded,
  fallbackURL,
  ...props
}) {
  const maxSize = Math.max(width, height) * 2;
  const thumbnailUrl = useFileThumbnailUrl(fileId, maxSize) || fallbackURL;
  const canShowImage = thumbnailUrl !== undefined;

  return (
    <div
      {...props}
      style={{
        position: 'relative',
        height: '100%',
        width: '100%',
        flexShrink: 0,
        overflow: 'hidden',
        backgroundColor: '#ededed',
        borderRadius: rounded && '50%',
        ...props.style,
      }}
    >
      <img
        key={fileId}
        alt=" "
        src={thumbnailUrl}
        style={{
          height: '100%',
          width: '100%',
          objectFit: 'cover',
          opacity: canShowImage ? 1 : 0,
          transition: 'opacity 120ms ease-in-out',
        }}
      />
    </div>
  );
}

export default FileUploaderThumbnail;
