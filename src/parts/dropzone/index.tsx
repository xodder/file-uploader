import React from 'react';
import { OverridableComponentProps } from '../../types';
import { useFileUploaderDropZone } from '../..';

type BaseProps = {
  children: React.ReactNode;
  indicator?: React.ReactNode;
};

type FileUploaderDropZoneProps<C extends React.ElementType> =
  OverridableComponentProps<C, BaseProps>;

function FileUploaderDropZone<C extends React.ElementType>({
  component,
  children,
  indicator,
  ...props
}: FileUploaderDropZoneProps<C>) {
  const Tag: any = component || 'div';
  const elementRef = React.useRef<Element | null>(null);
  const { active } = useFileUploaderDropZone(elementRef);

  return (
    <Tag ref={elementRef} {...props}>
      {children}
      {active && indicator}
    </Tag>
  );
}

type PassProps = {
  active: boolean;
  elementRef: React.RefCallback<Element>;
};

type FileUploaderDropZoneSkeletonProps = {
  children: (props: PassProps) => JSX.Element;
};

export function FileUploaderDropZoneSkeleton({
  children,
}: FileUploaderDropZoneSkeletonProps) {
  const _elementRef = React.useRef<Element | null>(null);

  const { active } = useFileUploaderDropZone(_elementRef);

  const captureElementRef: React.RefCallback<Element> = (ref) => {
    _elementRef.current = ref;
  };

  return children({ active, elementRef: captureElementRef });
}

export default FileUploaderDropZone;
