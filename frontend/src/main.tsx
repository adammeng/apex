import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import VConsole from 'vconsole'
import App from './App.tsx'
import './index.css'

function shouldEnableVConsole() {
  if (typeof window === 'undefined') {
    return false
  }

  const params = new URLSearchParams(window.location.search)
  if (params.get('vconsole') === '1') {
    return true
  }

  return /Lark|Feishu/i.test(window.navigator.userAgent)
}

if (shouldEnableVConsole()) {
  const vconsole = new VConsole()
  ;(window as Window & { __APEX_VCONSOLE__?: VConsole }).__APEX_VCONSOLE__ = vconsole
  console.info('[apex-debug] vConsole enabled')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
