
import { Video } from '../types';

// Initialize Gun.js with public relay peers
// @ts-ignore
const gun = Gun([
  'https://gun-manhattan.herokuapp.com/gun',
  'https://relay.peer.ooo/gun',
  'https://peer.wallie.io/gun'
]);

const videoNode = gun.get('vibestream-v3-global-videos');

export const saveVideoGlobally = (video: Video): Promise<void> => {
  return new Promise((resolve) => {
    // We store metadata in Gun. Thumbnails are stored as Base64.
    // Note: Gun is best for small-ish data. For high-res videos, we use URLs.
    videoNode.get(video.id).put(video, (ack: any) => {
      if (ack.err) console.error("Gun Error:", ack.err);
      resolve();
    });
  });
};

export const subscribeToVideos = (callback: (video: Video) => void) => {
  videoNode.map().on((data: any, id: string) => {
    if (data && data.title) {
      callback({ ...data, id });
    }
  });
};

// Local storage backup for offline support
export const saveLocal = (video: Video) => {
  const local = JSON.parse(localStorage.getItem('vibe_local_videos') || '[]');
  localStorage.setItem('vibe_local_videos', JSON.stringify([...local, video]));
};

export const getLocalVideos = (): Video[] => {
  return JSON.parse(localStorage.getItem('vibe_local_videos') || '[]');
};
