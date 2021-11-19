import React from 'react';
import { useFileUploaderRef } from '../..';

function FileUploaderInput(props) {
  const { component, children, ...otherProps } = props;
  const Component = component || 'span';
  const uploader = useFileUploaderRef();
  const inputRef = React.useRef();
  const [key, setKey] = React.useState(Date.now());

  function onClick() {
    inputRef.current.click();
  }

  function onInputChange(e) {
    uploader.addFiles(Array.from(e.target.files), '');
    setKey(Date.now()); // resets input
  }

  return (
    <Component {...otherProps} onClick={onClick}>
      <input
        key={key}
        ref={inputRef}
        type="file"
        onChange={onInputChange}
        multiple={uploader.getConfigValue('multiple')}
        accept={uploader.getConfigValue('allowedFileTypes').join(',')}
        style={{ display: 'none', width: 0, height: 0 }}
      />
      {children}
    </Component>
  );
}

export default FileUploaderInput;
