import { useEffect, useRef, useState, useCallback } from 'react'
import ReconnectingWebSocket from 'reconnecting-websocket'
import { connect } from '../utils/PeerConnection'

interface PeerStreamProps {
  username: string
  ws: ReconnectingWebSocket | null
  myStream: MediaStream
  polite: boolean
  bordersOn: boolean
  debugOn: boolean
}

const generateDebugString = (rpc: RTCPeerConnection | undefined, polite: boolean, username: string) => {
  const tracks = Object.fromEntries(
    rpc?.getReceivers()
      .filter(r => r.track.enabled)
      .map(r => [r.track.kind, r.track.label]) || []
  )
  return JSON.stringify({
    username,
    polite,
    tracks,
    rpcInfo: {
      connectionState: rpc?.connectionState,
      iceConnectionState: rpc?.iceConnectionState,
      iceGatheringState: rpc?.iceGatheringState,
      signalingState: rpc?.signalingState,
    }
  }, null, 2)
}

const PeerStream = ({ debugOn, bordersOn, username, ws, myStream, polite }:PeerStreamProps) => {
  const [rpc, setRpc] = useState<RTCPeerConnection>()
  const [debugString, setDebugString] = useState(username)
  const [stream] = useState(new MediaStream())
  const videoRef = useRef<HTMLVideoElement>(null)

  const updateDebug = useCallback(() => {
    setDebugString(debugOn ? generateDebugString(rpc, polite, username) : username)
  }, [debugOn, rpc, polite, username])

  useEffect(() => {
    updateDebug()
  }, [updateDebug])

  useEffect(() => {
    const doConnect = async () => {
      if (ws) {
        const rpc = await connect(username, ws as WebSocket, stream, polite)
        myStream.getTracks().forEach(track => rpc.addTrack(track))
        setRpc(rpc)
      }
    }
    doConnect()
    return () => {
      rpc?.getReceivers().forEach(({ track }) => track.stop())
    }
  }, [])

  useEffect(() => {
    if (!rpc) return
    rpc.oniceconnectionstatechange = updateDebug
    rpc.onicegatheringstatechange = updateDebug
    rpc.onconnectionstatechange = updateDebug
    rpc.onsignalingstatechange = updateDebug
  }, [rpc, updateDebug])

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  useEffect(() => {
    if (!polite) {
      ws?.send(JSON.stringify({ kind: 'peer', targets: [username] }))
    }
  }, [ws, username, polite])

  return <div className="video-container">
    <video
      ref={videoRef}
      style={ {objectFit: bordersOn ? 'contain' : 'cover'} }
      autoPlay 
      playsInline>  
    </video>
    <span className="overlay">{debugString}</span>
  </div>
}

export default PeerStream
