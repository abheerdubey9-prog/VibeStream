
import { Video } from '../types';

// Safely initialize Gun from the global window object.
// Access Gun via window as any to resolve the "Cannot find name 'Gun'" error for the CDN-loaded library.
const GunConstructor = (window as any).Gun;
const gun = typeof GunConstructor !== 'undefined' 
  ? GunConstructor([
    'https://gun-manhattan.herokuapp.com/gun',
    'https://relay.peer.ooo/gun',
    'https://peer.wallie.io/gun',
    'https://gundb-relay.herokuapp.com/gun'
  ])
  : null;

// Namespace for global discovery
const videoNode = gun ? gun.get('vibestream-global-discovery-v4') : null;

export const saveVideoGlobally = (video: Video): Promise<void> => {
  return new Promise((resolve) => {
    if (!videoNode) {
      console.warn("P2P Node unavailable.");
      return resolve();
    }
    videoNode.get(video.id).put(video, (ack: any) => {
      if (ack.err) console.error("Gun Broadcast Error:", ack.err);
      resolve();
    });
  });
};

export const subscribeToVideos = (callback: (video: Video) => void) => {
  if (!videoNode) return;
  videoNode.map().on((data: any, id: string) => {
    if (data && data.title && typeof data.title === 'string') {
      callback({ ...data, id });
    }
  });
};
