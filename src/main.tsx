import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { installErrorCapture } from './utils/errorLog'
import { initAuth } from './cloud/authStore'

installErrorCapture()
initAuth()

// GitHub Pages menyajikan aplikasi di /chipin-order/ — router harus tahu awalan itu.
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter
      basename={basename}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
