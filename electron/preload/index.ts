import { loadConfig } from '../../config/loadConfig'
import { registerPreloadModuleRegistry } from './registerPreloadModuleRegistry'

function domReady(condition: DocumentReadyState[] = ['complete', 'interactive']) {
  return new Promise((resolve) => {
    if (condition.includes(document.readyState)) {
      resolve(true)
    } else {
      document.addEventListener('readystatechange', () => {
        if (condition.includes(document.readyState)) {
          resolve(true)
        }
      })
    }
  })
}

const safeDOM = {
  append(parent: HTMLElement, child: HTMLElement) {
    if (!Array.from(parent.children).find((element) => element === child)) {
      return parent.appendChild(child)
    }
  },
  remove(parent: HTMLElement, child: HTMLElement) {
    if (Array.from(parent.children).find((element) => element === child)) {
      return parent.removeChild(child)
    }
  },
}

function useLoading() {
  const className = 'loaders-css__square-spin'
  const styleContent = `
@keyframes square-spin {
  25% { transform: perspective(100px) rotateX(180deg) rotateY(0); }
  50% { transform: perspective(100px) rotateX(180deg) rotateY(180deg); }
  75% { transform: perspective(100px) rotateX(0) rotateY(180deg); }
  100% { transform: perspective(100px) rotateX(0) rotateY(0); }
}
.${className} > div {
  animation-fill-mode: both;
  width: 50px;
  height: 50px;
  background: #fff;
  animation: square-spin 3s 0s cubic-bezier(0.09, 0.57, 0.49, 0.9) infinite;
}
.app-loading-wrap {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #282c34;
  z-index: 9;
}
    `
  const styleElement = document.createElement('style')
  const container = document.createElement('div')

  styleElement.id = 'app-loading-style'
  styleElement.innerHTML = styleContent
  container.className = 'app-loading-wrap'
  container.innerHTML = `<div class="${className}"><div></div></div>`

  return {
    appendLoading() {
      safeDOM.append(document.head, styleElement)
      safeDOM.append(document.body, container)
    },
    removeLoading() {
      safeDOM.remove(document.head, styleElement)
      safeDOM.remove(document.body, container)
    },
  }
}

registerPreloadModuleRegistry(loadConfig())

const { appendLoading, removeLoading } = useLoading()
domReady().then(() => appendLoading())

window.onmessage = (event) => {
  if (event.data.payload === 'removeLoading') {
    removeLoading()
  }
}

setTimeout(removeLoading, 4999)
