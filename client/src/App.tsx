import ReconnectingWebSocket from 'reconnecting-websocket'
import { useState, useEffect, useRef } from 'react'
import { useStickyState } from './utils/StickyState'
import { calculateGridDimensions } from './utils/Calculate'
import WebcamStream from './components/Webcam'
import Connection from './components/Connection'
import Chat from './components/Chat'
import PeerStream from './components/Peer'
import './App.css'

function App() {
  const [ws, setWs] = useState<ReconnectingWebSocket | null>(null)
  const [stream, setStream] = useState(null)
  const [username, setUsername] = useStickyState('', 'username')
  const [messages, setMessages] = useState<object[]>([])
  const [peers, setPeers] = useState<string[]>([])
  const ref = useRef()
  ref.messages = messages

  useEffect(() => {
    ws?.addEventListener('message', (e) => {
      const message = JSON.parse(e.data)
      if (message.message) {
        setMessages([...ref.messages, message])
      } else if (message.kind === 'enter') {
        setPeers([...peers, message.username])
      } else if (message.kind === 'peer') {
        setPeers([...peers, message.sender])
      } else if (message.kind === 'leave') {
        setPeers(peers.filter(u => u != message.username))
      }
    })
  }, [ws, peers])

  return (
    <main>
      <header>
        <input onChange={(e) => setUsername(e.target.value)} value={username} />
        <Connection username={username} setWs={setWs} />
        <span>({peers.length + 1} online)</span>
      </header>
      <div className="videos" style={calculateGridDimensions(peers.length + 1)}>
        <WebcamStream username={username} setStream={setStream} />
        {[...peers].map(username => (
        <PeerStream key={username} ws={ws} username={username} myStream={stream} />
        ))}
      </div>
      {!!ws && <Chat messages={messages} ws={ws} />}
    </main>
  )
}

export default App
