import React from 'react';
import { useFileName } from '../..';

function FileUploaderFileName({ component, fileId, ...props }) {
  const Component = component || 'span';
  const fileName = useFileName(fileId);
  return <Component {...props}>{fileName}</Component>;
}

export default FileUploaderFileName;
