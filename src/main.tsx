import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App'
import { AppProviders } from './app/AppProviders'
import { registerRendererModuleRegistry } from './app/bootstrap/registerRendererModuleRegistry'

import './index.css'

const config = window.appApi.getConfig()
const rendererModules = registerRendererModuleRegistry(config)

function RuntimeModules() {
  return <>{rendererModules.map(({ id, component: Module }) => <Module key={id} />)}</>
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AppProviders config={config}>
      <App />
      <RuntimeModules />
    </AppProviders>
  </React.StrictMode>,
)

postMessage({ payload: 'removeLoading' }, '*')
