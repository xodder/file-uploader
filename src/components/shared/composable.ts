import { Slot } from '@radix-ui/react-slot';
import { ComponentPropsWithRef, FC, createElement, forwardRef } from 'react';

export type ComposableComponentProps<T extends IntrinsicElementNames> =
  ComponentPropsWithRef<T> & {
    asChild?: boolean;
  };

type Composable = {
  [Tag in keyof JSX.IntrinsicElements]: FC<ComposableComponentProps<Tag>>;
};

const cache = new Map();

export const composable = new Proxy({} as Composable, {
  get(_, el) {
    if (!cache.has(el)) {
      cache.set(el, createComposableComponent(el as any));
    }

    return cache.get(el);
  },
});

type IntrinsicElementNames = keyof JSX.IntrinsicElements;

function createComposableComponent<T extends IntrinsicElementNames>(
  tag: T
): FC<ComposableComponentProps<T>> {
  return forwardRef<any, ComposableComponentProps<T>>(
    ({ asChild, ...props }, ref) => {
      return createElement(asChild ? Slot : tag, { ...props, ref } as any);
    }
  ) as any;
}
