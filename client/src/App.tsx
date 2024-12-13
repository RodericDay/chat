import ReconnectingWebSocket from 'reconnecting-websocket'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useStickyState } from './utils/StickyState'
import { calculateGridDimensions } from './utils/Calculate'
import WebcamStream from './components/Webcam'
import Button from './components/Button'
import Connection from './components/Connection'
import Chat from './components/Chat'
import PeerStream from './components/Peer'
import ScreenShare from './components/ScreenShare'
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
  const videosContainerRef = useRef<HTMLDivElement>(null)

  const [loggedIn, setLoggedIn] = useState(!!username)

  const [videoOn, setVideoOn] = useStickyState(false, 'videoOn')
  const [audioOn, setAudioOn] = useStickyState(true, 'audioOn')
  const [chatOn, setChatOn] = useStickyState(true, 'chatOn')
  const [debugOn, setDebugOn] = useStickyState(true, 'debugOn')
  const [bordersOn, setBordersOn] = useStickyState(true, 'bordersOn')
  const [screenSharingOn, setScreenSharingOn] = useState(false)

  const handleResize = useCallback((peers:[string, boolean][]) => {
    setGridStyle(calculateGridDimensions(peers.length + 1, videosContainerRef.current))
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
  }, [handleResize, peers, chatOn, screenSharingOn])

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

  useEffect(() => {
    stream.getVideoTracks().forEach(track => { track.enabled = videoOn })
  }, [videoOn, stream])

  useEffect(() => {
    stream.getAudioTracks().forEach(track => { track.enabled = audioOn })
  }, [audioOn, stream])

  useEffect(() => {
    console.log(loggedIn ? 'Logged in' : 'Logged out')
  }, [loggedIn])

  return (
    !loggedIn
    ? <main>
        <header>
          <button className="auth-button" onClick={() => setLoggedIn(true)}>log in</button>
          <input className="auth-input" onChange={(e) => setUsername(e.target.value)} value={username} />
        </header>
        <WebcamStream
          debugOn={true}
          bordersOn={bordersOn}
          username={username}
          stream={stream}
          setStream={setStream}
        />
      </main>
    : <main>
      <header>
        <Connection username={username} setWs={setWs} />
        <button className="auth-button" onClick={() => setLoggedIn(false)}>log out</button>
        <input className="auth-input" disabled onChange={(e) => setUsername(e.target.value)} value={username} />
        <Button img='/camera.svg' label='Video' state={videoOn} setState={setVideoOn} />
        <Button img='/microphone.svg' label='Audio' state={audioOn} setState={setAudioOn} />
        <Button img='/cards.svg' label='Borders' state={bordersOn} setState={setBordersOn} />
        <Button img='/gear.svg' label='Debug' state={debugOn} setState={setDebugOn} />
        <Button img='/chat.svg' label='Chat' state={chatOn} setState={setChatOn} />
        <Button img='/screen.svg' label='Screen Sharing' state={screenSharingOn} setState={setScreenSharingOn} />
      </header>
      <div className="desk">
        <div ref={videosContainerRef} className="videos" style={gridStyle}>
          <WebcamStream
            debugOn={debugOn}
            bordersOn={bordersOn} 
            username={username}
            stream={stream}
            setStream={setStream}
          />
          {[...peers].map(([username, polite]) => (
            <PeerStream
              key={username}
              debugOn={debugOn}
              bordersOn={bordersOn}
              ws={ws}
              username={username}
              myStream={stream}
              polite={polite}
            />
          ))}
        </div>
        {!!screenSharingOn && <ScreenShare ws={ws as WebSocket} />}
        {!!chatOn && ws && <Chat messages={messages} ws={ws} />}
      </div>
    </main>
  )
}

export default App
