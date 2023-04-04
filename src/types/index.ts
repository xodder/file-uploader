import React from 'react';

export type DistributiveOmit<T, U> = T extends any
  ? Pick<T, Exclude<keyof T, U>>
  : never;

export type OverridableComponentProps<C extends React.ElementType, P> = {
  component: C;
} & OverrideComponentProps<C, P>;

type OverrideComponentProps<C extends React.ElementType, P> = P &
  DistributiveOmit<React.ComponentPropsWithRef<C>, keyof P>;
