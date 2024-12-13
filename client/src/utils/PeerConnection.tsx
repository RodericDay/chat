const config = {
  iceServers: [
    {
      urls: ['stun:stun.zari.chat:5349', 'turn:turn.zari.chat:5349'],
      username: 'roderic',
      credential: 'tomodachi',
    },
  ],
}

const onOffer = async (rpc: RTCPeerConnection, offer: RTCSessionDescriptionInit, polite: boolean) => {
  if (rpc.signalingState === 'stable') {
    await rpc.setRemoteDescription(offer)
  } else if (polite) {
    await Promise.all([
        rpc.setLocalDescription({ type: 'rollback' }),
        rpc.setRemoteDescription(offer),
    ])
  } else {
    return
  }
  const answer = await rpc.createAnswer()
  await rpc.setLocalDescription(answer)
  return answer
}

export const connect = (
    username: string,
    ws: WebSocket,
    stream: MediaStream,
    polite: boolean,
  ) => {
  const rpc = new RTCPeerConnection(config)
  console.log(`[${username}] Created RPC connection`)

  rpc.onnegotiationneeded = async () => {
    await rpc.setLocalDescription()
    ws?.send(JSON.stringify({ kind: 'offer', targets: [username], offer: rpc.localDescription }))
    console.log(`[${username}] Set local description and sent offer`)
  }

  rpc.onicecandidate = ({ candidate }) => {
    ws?.send(JSON.stringify({ kind: 'icecandidate', targets: [username], candidate }))
  }

  rpc.ontrack = ({ track }) => {
    stream.addTrack(track)
    console.log(`[${username}] Added ${track.kind} track`)
  }

  const onMessage = async (event: MessageEvent) => {
    const message = JSON.parse(event.data)
    if (message.sender !== username) {
      return
    }

    if (message.kind === 'offer') {
      const answer = await onOffer(rpc, message.offer, polite)
      if (answer) {
        ws?.send(JSON.stringify({ kind: 'answer', targets: [username], answer }))
        console.log(`[${username}] Received and set offer, sent answer`)
      }

    } else if (message.kind === 'answer') {
      await rpc.setRemoteDescription(message.answer)
      console.log(`[${username}] Received and set remote answer`)    

    } else if (message.kind === 'icecandidate') {
      if (rpc.remoteDescription) {
        await rpc.addIceCandidate(message.candidate)
      }

    }
  }

  ws.addEventListener('message', onMessage)
  return rpc
}