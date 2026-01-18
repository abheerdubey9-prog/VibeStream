
import React, { useEffect, useRef, useState } from 'react';

interface VideoPlayerProps {
  src: string;
  poster?: string;
  onError?: () => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, poster, onError }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [player, setPlayer] = useState<any>(null);

  useEffect(() => {
    // Install polyfills for browser compatibility
    (window as any).shaka.polyfill.installAll();

    if (!(window as any).shaka.Player.isBrowserSupported()) {
      console.error('Browser not supported for Shaka Player');
      return;
    }

    const initPlayer = async () => {
      if (!videoRef.current || !containerRef.current) return;

      const shaka = (window as any).shaka;
      const newPlayer = new shaka.Player(videoRef.current);
      
      // Initialize UI controls
      const ui = new shaka.ui.Overlay(newPlayer, containerRef.current, videoRef.current);
      
      // Configure player for smooth mesh streaming
      newPlayer.configure({
        streaming: {
          bufferingGoal: 30, // Buffer 30 seconds ahead
          rebufferingGoal: 5, // Rebuffer 5 seconds before resuming
          bufferBehind: 15,
          retryParameters: {
            maxAttempts: 5,
            baseDelay: 1000,
            backoffFactor: 2,
          }
        },
        abr: {
          enabled: true, // Enable Adaptive Bitrate
          defaultBandwidthEstimate: 1000000, // Default to 1Mbps
        }
      });

      // Listen for errors
      newPlayer.addEventListener('error', (event: any) => {
        console.error('Shaka Player Error:', event.detail);
        if (onError) onError();
      });

      setPlayer(newPlayer);

      try {
        await newPlayer.load(src);
        console.log('Video loaded successfully via Shaka');
      } catch (e) {
        console.error('Error loading video:', e);
        if (onError) onError();
      }
    };

    initPlayer();

    return () => {
      if (player) {
        player.destroy();
      }
    };
  }, [src]);

  return (
    <div 
      ref={containerRef} 
      className="shaka-video-container w-full h-full bg-black group"
    >
      <video
        ref={videoRef}
        poster={poster}
        className="w-full h-full"
        autoPlay
        playsInline
      />
    </div>
  );
};

export default VideoPlayer;
