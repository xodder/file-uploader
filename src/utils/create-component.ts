import { FC, forwardRef } from 'react';

type ComponentDefinition<Props> = (props: Props, ref?: any) => any;

export function createComponent<Props>(definition: ComponentDefinition<Props>) {
  return forwardRef(definition) as FC<Props>;
}
