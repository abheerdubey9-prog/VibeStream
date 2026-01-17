
export interface Video {
  id: string;
  title: string;
  description: string;
  url: string;
  thumbnail: string;
  uploader: string;
  views: number;
  createdAt: number;
  duration: string;
  category: string;
}

export interface User {
  id: string;
  name: string;
  avatar: string;
}

export enum ViewMode {
  FEED = 'FEED',
  WATCH = 'WATCH',
  UPLOAD = 'UPLOAD'
}
