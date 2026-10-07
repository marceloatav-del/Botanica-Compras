import React from 'react';
import ReactDOM from 'react-dom/client';
import { CatalogApp } from './features/catalog/CatalogApp';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CatalogApp />
  </React.StrictMode>,
);
