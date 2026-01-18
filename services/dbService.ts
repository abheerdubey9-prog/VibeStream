
import { Video } from '../types';

// Safely initialize Gun from the global window object.
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

export const removeVideoGlobally = (id: string): Promise<void> => {
  return new Promise((resolve) => {
    if (!videoNode) return resolve();
    // In GunDB, nulling a key effectively deletes it from the current path
    videoNode.get(id).put(null as any, (ack: any) => {
      if (ack.err) console.error("Gun Delete Error:", ack.err);
      resolve();
    });
  });
};

export const subscribeToVideos = (callback: (video: Video | null, id: string) => void) => {
  if (!videoNode) return;
  videoNode.map().on((data: any, id: string) => {
    if (data === null) {
      callback(null, id);
    } else if (data && data.title && typeof data.title === 'string') {
      callback({ ...data, id }, id);
    }
  });
};
