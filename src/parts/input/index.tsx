import React from 'react';
import { OverridableComponentProps } from '../../types';
import { useFileUploaderRef } from '../..';

type BaseProps = {
  children?: React.ReactNode;
};

type FileUploaderInputProps<C extends React.ElementType> =
  OverridableComponentProps<C, BaseProps>;

function FileUploaderInput<C extends React.ElementType>({
  component,
  children,
  ...props
}: FileUploaderInputProps<C>) {
  const Tag: any = component || 'span';
  const uploader = useFileUploaderRef();
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [key, setKey] = React.useState(Date.now());

  function onClick() {
    if (inputRef.current) {
      inputRef.current.click();
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      uploader.addFiles(Array.from(e.target.files));
      setKey(Date.now()); // resets input
    }
  }

  return (
    <Tag {...props} onClick={onClick}>
      <input
        key={key}
        ref={inputRef}
        type="file"
        onChange={onInputChange}
        multiple={!!uploader.getConfigValue('multiple')}
        accept={uploader.getConfigValue('allowedFileTypes')?.join(',')}
        style={{ display: 'none', width: 0, height: 0 }}
      />
      {children}
    </Tag>
  );
}

export default FileUploaderInput;
