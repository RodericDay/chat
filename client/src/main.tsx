import { createRoot } from 'react-dom/client'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  // Strict mode is not suitable because RPC/Streams
  <App />
)
