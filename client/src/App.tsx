import ReconnectingWebSocket from 'reconnecting-websocket'
import { useState, useEffect, useCallback } from 'react'
import { useStickyState } from './utils/StickyState'
import { calculateGridDimensions } from './utils/Calculate'
import WebcamStream from './components/Webcam'
import Connection from './components/Connection'
import Chat from './components/Chat'
import PeerStream from './components/Peer'
import './App.css'

type Message = {
  kind: string
  message: string
  username: string
  sender: string
}

function App() {
  const [ws, setWs] = useState<ReconnectingWebSocket | null>(null)
  const [stream, setStream] = useState(new MediaStream())
  const [username, setUsername] = useStickyState('', 'username')
  const [messages, setMessages] = useState<Message[]>([])
  const [peers, setPeers] = useState<[string, boolean][]>([])
  const [gridStyle, setGridStyle] = useState<object>({})

  const handleResize = useCallback((peers:[string, boolean][]) => {
    setGridStyle(calculateGridDimensions(peers.length + 1))
  }, [])

  const handleMessage = useCallback((message: Message) => {
    if (message.message) {
      setMessages([...messages, message])
    }
    
    if (message.kind === 'enter') {
      setPeers([...peers, [message.username, false]])
    } else if (message.kind === 'peer') {
      setPeers([...peers, [message.sender, true]])
    } else if (message.kind === 'leave') {
      setPeers(peers.filter(([u]) => u != message.username))
    }
  }, [messages, peers])

  useEffect(() => {
    handleResize(peers)
  }, [peers, handleResize])

  useEffect(() => {
    const onmessage = (e: { data: string }) => handleMessage(JSON.parse(e.data))

    ws?.addEventListener('message', onmessage)
    return () => {
      ws?.removeEventListener('message', onmessage)
    }
  }, [ws, handleMessage])

  useEffect(() => {
    const onresize = () => handleResize(peers)

    window.addEventListener('resize', onresize)
    return () => {
      window.removeEventListener('resize', onresize)
    }
  }, [peers, handleResize]);

  return (
    <main>
      <header>
        <input disabled onChange={(e) => setUsername(e.target.value)} value={username} />
        <Connection username={username} setWs={setWs} />
      </header>
      <div className="videos" style={gridStyle}>
        <WebcamStream username={username} setStream={setStream} />
        {[...peers].map(([username, polite]) => (
        <PeerStream key={username} ws={ws} username={username} myStream={stream} polite={polite} />
        ))}
      </div>
      {!!ws && <Chat messages={messages} ws={ws} />}
    </main>
  )
}

export default App
