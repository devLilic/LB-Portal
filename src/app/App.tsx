import { registerRendererModuleRegistry } from './bootstrap/registerRendererModuleRegistry'
import logoVite from '@/assets/logo-vite.svg'
import logoElectron from '@/assets/logo-electron.svg'
import './App.css'

function App() {
  const config = window.appApi.getConfig()
  const rendererModules = registerRendererModuleRegistry(config)

  return (
    <div className='App'>
      <div className='logo-box'>
        <a href='https://github.com/electron-vite/electron-vite-react' target='_blank'>
          <img src={logoVite} className='logo vite' alt='Electron + Vite logo' />
          <img src={logoElectron} className='logo electron' alt='Electron + Vite logo' />
        </a>
      </div>
      <h1>Electron + Vite + React</h1>
      <div className='card'>
        <p>Starter foundation is being modularized.</p>
      </div>
      <p className='read-the-docs'>
        Click on the Electron + Vite logo to learn more
      </p>
      <div className='flex-center'>
        Place static files into the<code>/public</code> folder <img style={{ width: '5em' }} src='./node.svg' alt='Node logo' />
      </div>
      {rendererModules.map((module) => {
        const Component = module.component
        return <Component key={module.id} />
      })}
    </div>
  )
}

export default App
