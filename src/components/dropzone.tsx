'use client';

import { forwardRef, ReactNode, Ref, useRef } from 'react';
import { useFileUploaderDropZone } from '../helpers/use-file-uploader-dropzone';
import { mergeRefs } from '../utils/merge-refs';
import { composable, ComposableComponentProps } from './shared/composable';

type BaseProps = Omit<ComposableComponentProps<'div'>, 'children'>;

type PassProps = {
  active: boolean;
  elementRef: Ref<Element>;
};

export interface DropZoneProps extends BaseProps {
  children: ReactNode | ((props: PassProps) => ReactNode);
  indicator?: ReactNode;
}

export const DropZone = forwardRef<any, DropZoneProps>(
  ({ children, indicator, ...props }, ref) => {
    const elementRef = useRef<Element | null>(null);
    const { active } = useFileUploaderDropZone(elementRef);

    return (
      <composable.div {...props} ref={mergeRefs(elementRef, ref)}>
        {typeof children === 'function'
          ? children({ active, elementRef })
          : children}
        {active && indicator}
      </composable.div>
    );
  }
);
