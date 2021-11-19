import React from 'react';
import { useFileUploaderDropZone } from '../..';

function FileUploaderDropZone({ component, children, indicator, ...props }) {
  const Component = component || 'div';
  const elementRef = React.useRef();
  const { active } = useFileUploaderDropZone(elementRef);

  return (
    <Component ref={elementRef} {...props}>
      {children}
      {active && indicator}
    </Component>
  );
}

export function FileUploaderDropZoneSkeleton({ children }) {
  const _elementRef = React.useRef();
  const { active } = useFileUploaderDropZone(_elementRef);

  function elementRef(ref) {
    _elementRef.current = ref;
  }

  return children({ active, elementRef });
}

export default FileUploaderDropZone;
