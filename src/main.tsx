import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App'
import { AppProviders } from './app/AppProviders'

import './index.css'

const config = window.appApi.getConfig()

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AppProviders config={config}>
      <App />
    </AppProviders>
  </React.StrictMode>,
)

postMessage({ payload: 'removeLoading' }, '*')
