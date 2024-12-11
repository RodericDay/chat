import { useCallback, useEffect, useRef, useState } from "react"
import ReconnectingWebSocket from "reconnecting-websocket"

const config = {
  iceServers: [
    {
      urls: ['stun:stun.zari.chat:5349', 'turn:turn.zari.chat:5349'],
      username: 'roderic',
      credential: 'tomodachi',
    },
  ],
}

type Message = {
  kind: string
  sender: string
  offer: RTCSessionDescriptionInit
  answer: RTCSessionDescriptionInit
  candidate: RTCIceCandidate
}

interface PeerStreamProps {
  username: string
  ws: ReconnectingWebSocket | null
  myStream: MediaStream
  polite: boolean
}

const generateDebugString = (rpc: RTCPeerConnection, polite: boolean, username: string) => {
  const tracks = Object.fromEntries(
    rpc.getReceivers().map((r) => [r.track.kind, r.track.label])
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

const PeerStream = ({ username, ws, myStream, polite }:PeerStreamProps) => {
  const [rpc, setRpc] = useState<RTCPeerConnection>()
  const [debugString, setDebugString] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const rpc = new RTCPeerConnection(config)
    setRpc(rpc)
    rpc.onnegotiationneeded = async () => {
      await rpc.setLocalDescription()
      ws?.send(JSON.stringify({ kind: 'offer', targets: [username], offer: rpc.localDescription }))
    }
    rpc.onicecandidate = ({ candidate }) => {
      ws?.send(JSON.stringify({ kind: 'icecandidate', targets: [username], candidate }))
    }
    rpc.ontrack = ({ track }) => {
      if (!videoRef.current?.srcObject) {
        (videoRef.current as HTMLVideoElement).srcObject = new MediaStream()
      }
      (videoRef.current?.srcObject as MediaStream).addTrack(track)
    }

    myStream.getTracks().forEach(track => rpc.addTrack(track))
  }, [username, ws, myStream])
  
  const handleMessage = useCallback(async (message: Message) => {
    if (!rpc || message.sender !== username) {
      return
    }

    if (message.kind === 'offer') {

      if (rpc.signalingState === 'stable') {
        await rpc.setRemoteDescription(message.offer)
      } else if (polite) {
        await Promise.all([
            rpc.setLocalDescription({ type: 'rollback' }),
            rpc.setRemoteDescription(message.offer),
        ])
      } else {
        return
      }
      await rpc.setLocalDescription(await rpc.createAnswer())
      ws?.send(JSON.stringify({ kind: 'answer', targets: [message.sender], answer: rpc.localDescription }))

    } else if (message.kind === 'answer') {

      await rpc.setRemoteDescription(message.answer)

    } else if (message.kind === 'icecandidate') {

      if (rpc.remoteDescription) {
        await rpc.addIceCandidate(message.candidate)
      }

    }
    setDebugString(generateDebugString(rpc, polite, username))
  }, [rpc, username, ws, polite])

  useEffect(() => {
    const handler = (e: { data: string }) => { handleMessage(JSON.parse(e.data)) }
    ws?.addEventListener('message', handler)
    return () => ws?.removeEventListener('message', handler)
  }, [ws, handleMessage])

  useEffect(() => {
    if (!polite) {
      ws?.send(JSON.stringify({ kind: 'peer', targets: [username] }))
    }
  }, [ws, username, polite])

  return <div className="video-container">
    <video ref={videoRef} autoPlay playsInline></video>
    <span className="overlay">{debugString}</span>
  </div>
}

export default PeerStream
