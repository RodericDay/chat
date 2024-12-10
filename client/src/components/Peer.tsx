import { useEffect, useRef, useState } from "react"

const PeerStream = ({ username, ws, myStream }) => {
  const [rpc, setRpc] = useState<RTCPeerConnection | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  
  useEffect(() => {
    const config = {
      iceServers: [
        {
          urls: ['stun:stun.zari.chat:5349', 'turn:turn.zari.chat:5349'],
          username: 'roderic',
          credential: 'tomodachi',
        },
      ],
    }
    const rpc = new RTCPeerConnection(config)
    setRpc(rpc)
    rpc.onnegotiationneeded = async () => {
      await rpc.setLocalDescription()
      ws.send(JSON.stringify({ kind: 'offer', targets: [username], offer: rpc.localDescription }))
    }
    rpc.onicecandidate = ({ candidate }) => {
      ws.send(JSON.stringify({ kind: 'icecandidate', targets: [username], candidate }))
    }
    rpc.ontrack = ({ track, streams }) => {
      if (!videoRef.current.srcObject) {
        videoRef.current.srcObject = new MediaStream()
      }
      videoRef.current.srcObject.addTrack(track)
    }

    myStream.getTracks().forEach(track => rpc.addTrack(track))

    ws.addEventListener('message', async (e) => {
      const message = JSON.parse(e.data)
      if (message.sender !== username) {
        return
      } else if (message.kind === 'offer') {
        // if (rpc.signalingState === 'stable') {
        await rpc.setRemoteDescription(message.offer)
        // }

        await rpc.setLocalDescription(await rpc.createAnswer())
        ws.send(JSON.stringify({ kind: 'answer', targets: [message.sender], answer: rpc.localDescription }))
      } else if (message.kind === 'answer') {
        rpc.setRemoteDescription(message.answer)
      } else if (message.kind === 'icecandidate') {
        if (rpc.remoteDescription) {
          await rpc.addIceCandidate(message.candidate)
        }
      }
    })

  }, [ws, username])

  const tracks = Object.fromEntries(
    videoRef?.current?.srcObject?.getTracks().map(({ label, kind }) => [kind, label]) || []
  )
  const debug = JSON.stringify({
    username,
    tracks,
    rpcInfo: {
      connectionState: rpc?.connectionState,
      iceConnectionState: rpc?.iceConnectionState,
      iceGatheringState: rpc?.iceGatheringState,
      signalingState: rpc?.signalingState,
    }
  }, null, 2)

  return <div className="video-container">
    <video ref={videoRef} autoPlay playsInline></video>
    <span className="overlay">{ debug }</span>
  </div>
}

export default PeerStream
