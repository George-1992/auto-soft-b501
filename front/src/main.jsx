// import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Router from './router.jsx'
import './index.css'
import './globals.scss'
import ToasterSonnar from '@/src/components/ui/sonnar/sonnar.jsx'
import { registerSW } from 'virtual:pwa-register'
import '../i18n.js'
import './services/pulltorefresh.js';


registerSW({ immediate: true })

createRoot(document.getElementById('root')).render(
  <>
    <Router />
    <ToasterSonnar />
  </>
  // <StrictMode>
  //   <Router />
  // </StrictMode>,
)
