import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { AppDataProvider } from './store/AppData'
import { ThemeProvider } from './theme/ThemeProvider'
import { ToastProvider } from './ui/Toast'
import './styles/tokens.css'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AppDataProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AppDataProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
