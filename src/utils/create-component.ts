import { forwardRef, ForwardRefRenderFunction } from 'react';

type ComponentDefinition<Props> = (props: Props, ref?: any) => any;

export function createComponent<Props>(definition: ComponentDefinition<Props>) {
  return forwardRef(definition) as unknown as ForwardRefRenderFunction<
    any,
    Props
  >;
}
