// import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Router from './router.jsx'
import './index.css'
import './globals.scss'
import ToasterSonnar from '@/src/components/ui/sonnar/sonnar.jsx'
import { registerSW } from 'virtual:pwa-register'
import '../i18n.js'
import './services/pulltorefresh.js';
import { GridPattern } from '@/src/components/ui/grid.jsx'


registerSW({ immediate: true })

createRoot(document.getElementById('root')).render(
  <>
    <Router />
    <ToasterSonnar />
    {/* <GridPattern
      width={40}
      height={40}
      x={-1}
      y={-1}
      strokeDasharray={"0"}
      squares={[[0, 0], [2, 2], [4, 4], [6, 6], [8, 8], [10, 10], [12, 12], [14, 14], [16, 16], [18, 18]]}
      className={'-z-10 opacity-30'}
    /> */}

    <div
      className="fixed inset-0 w-full h-full -z-10 opacity-30 bg-repeat bg-auto bg-gray-50"
      style={{ backgroundImage: "url('/images/other/concrete-wall-with-rough-texture-small-drops-water-it_731790-75103.jpg')" }}
      aria-hidden="true"
    />

  </>
  // <StrictMode>
  //   <Router />
  // </StrictMode>,
)
