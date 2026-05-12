/// <reference types="vite/client" />

// When React types are not installed locally, TypeScript can't resolve
// JSX.IntrinsicAttributes (which marks `key` as a framework-managed attribute
// rather than a component prop). Without this, TypeScript includes `key` in the
// excess-property check for every JSX element and produces false TS2322 errors.
// This minimal augmentation teaches TypeScript that `key` is always valid on
// any JSX element, matching what React's own types provide.
declare module "react/jsx-runtime" {
  namespace JSX {
    interface IntrinsicAttributes {
      key?: string | number | null;
    }
  }
}
