
import { Video } from '../types.ts';

// Initialize Gun.js with multiple public relay peers for better global reach
// @ts-ignore
const gun = Gun([
  'https://gun-manhattan.herokuapp.com/gun',
  'https://relay.peer.ooo/gun',
  'https://peer.wallie.io/gun',
  'https://gundb-relay.herokuapp.com/gun'
]);

// Namespace for global discovery
const videoNode = gun.get('vibestream-global-discovery-v4');

export const saveVideoGlobally = (video: Video): Promise<void> => {
  return new Promise((resolve) => {
    // Gun stores small data efficiently. Thumbnails are kept small (320px).
    videoNode.get(video.id).put(video, (ack: any) => {
      if (ack.err) console.error("Gun Broadcast Error:", ack.err);
      resolve();
    });
  });
};

export const subscribeToVideos = (callback: (video: Video) => void) => {
  videoNode.map().on((data: any, id: string) => {
    // Basic validation to ensure we only get valid video objects
    if (data && data.title && typeof data.title === 'string') {
      callback({ ...data, id });
    }
  });
};
