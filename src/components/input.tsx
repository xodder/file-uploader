'use client';

import { ChangeEvent, useRef, useState } from 'react';
import { useFileUploader } from '../helpers/use-file-uploader';
import { createComponent } from '../utils/create-component';
import { composable, ComposableComponentProps } from './shared/composable';
import { Slottable } from '@radix-ui/react-slot';

type BaseProps = ComposableComponentProps<'span'>;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface InputProps extends BaseProps {}

export const Input = createComponent<InputProps>(
  ({ children, ...props }, ref) => {
    const uploader = useFileUploader();
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [key, setKey] = useState(Date.now());

    function onClick() {
      if (inputRef.current) {
        inputRef.current.click();
      }
    }

    function handleChange(e: ChangeEvent<HTMLInputElement>) {
      if (e.target.files) {
        uploader.addFiles(Array.from(e.target.files));
        setKey(Date.now()); // resets input
      }
    }

    return (
      <composable.span {...props} ref={ref} onClick={onClick}>
        <input
          key={key}
          ref={inputRef}
          type="file"
          onChange={handleChange}
          multiple={!!uploader.getConfigValue('multiple')}
          accept={uploader.getConfigValue('allowedFileTypes')?.join(',')}
          style={{ display: 'none', width: 0, height: 0 }}
        />
        <Slottable>{children}</Slottable>
      </composable.span>
    );
  }
);
