import { useEffect, useRef, useState } from 'react'

const WebcamStream = ({ username, setStream }) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {

    const startVideoStream = async () => {
      try {
        const config = {
          audio: { echoCancellation: true },
          video: { width: { ideal: 320 }, facingMode: 'user', frameRate: 26 }
        }
        const stream = await navigator.mediaDevices.getUserMedia(config)
        setStream(stream)
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      } catch (error) {
        console.error('Error accessing webcam:', error)
        setHasError(true)
      }
    }

    startVideoStream()

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream
        const tracks = stream.getTracks()
        tracks.forEach(track => track.stop())
      }
    }
  }, [])
  
  const tracks = Object.fromEntries(
    videoRef?.current?.srcObject?.getTracks().map(({ label, kind }) => [kind, label]) || []
  )
  const debug = JSON.stringify({
    username,
    tracks,
  }, null, 2)

  return (
    <div className="video-container">
      {hasError
      ? <p>There was an error accessing the webcam. Please check your device permissions.</p>
      : <video className="self" ref={videoRef} autoPlay playsInline muted></video>
      }
      <span className="overlay">{debug}</span>
    </div>
  )
}

export default WebcamStream
