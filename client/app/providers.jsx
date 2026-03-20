'use client';

import StoreProvider from '../src/store/StoreProvider';

export default function Providers({ children }) {
  return <StoreProvider>{children}</StoreProvider>;
}
