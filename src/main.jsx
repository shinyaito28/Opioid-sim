import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './i18n';
import {installAppViewport} from './lib/appViewport.js';

const stopViewport=installAppViewport(window,document);
if(import.meta.hot)import.meta.hot.dispose(stopViewport);

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)
