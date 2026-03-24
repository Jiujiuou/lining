import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import StorePage from './StorePage.jsx'

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Routes>
      <Route path="/store" element={<StorePage />} />
      <Route path="*" element={<App />} />
    </Routes>
  </BrowserRouter>,
)
