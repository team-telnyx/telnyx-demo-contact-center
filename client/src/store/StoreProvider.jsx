import React, { useEffect } from 'react';
import { Provider } from 'react-redux';
import { store } from './store';
import { hydrateFromToken } from '../features/auth/authSlice';

function TokenHydrator({ children }) {
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      store.dispatch(hydrateFromToken());
    }
  }, []);

  return children;
}

export default function StoreProvider({ children }) {
  return (
    <Provider store={store}>
      <TokenHydrator>{children}</TokenHydrator>
    </Provider>
  );
}
