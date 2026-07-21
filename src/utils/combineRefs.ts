import type { Ref, RefCallback } from 'react';

/** Combine plusieurs refs (callback ou objet) en une seule ref callback. */
export function combineRefs<T>(...refs: Array<Ref<T> | undefined>): RefCallback<T> {
  return (node: T) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === 'function') {
        ref(node);
      } else {
        (ref as { current: T | null }).current = node;
      }
    }
  };
}
