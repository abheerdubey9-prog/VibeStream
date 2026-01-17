
import React from 'react';
import { Video } from '../types';

interface VideoCardProps {
  video: Video;
  onClick: (video: Video) => void;
}

const VideoCard: React.FC<VideoCardProps> = ({ video, onClick }) => {
  return (
    <div 
      className="group cursor-pointer flex flex-col gap-3"
      onClick={() => onClick(video)}
    >
      <div className="relative aspect-video rounded-xl overflow-hidden bg-[#272727]">
        <img 
          src={video.thumbnail || `https://picsum.photos/seed/${video.id}/400/225`} 
          alt={video.title}
          className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-300"
        />
        <div className="absolute bottom-2 right-2 bg-black/80 px-1.5 py-0.5 rounded text-[10px] font-bold">
          {video.duration}
        </div>
      </div>
      
      <div className="flex gap-3 px-1">
        <div className="w-9 h-9 flex-shrink-0 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 overflow-hidden">
          <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${video.uploader}`} alt="avatar" />
        </div>
        <div className="flex flex-col overflow-hidden">
          <h3 className="text-sm font-semibold line-clamp-2 leading-tight group-hover:text-blue-400 transition-colors">
            {video.title}
          </h3>
          <p className="text-xs text-gray-400 mt-1 hover:text-white transition-colors">{video.uploader}</p>
          <div className="text-[11px] text-gray-400 flex items-center gap-1">
            <span>{video.views.toLocaleString()} views</span>
            <span>•</span>
            <span>{new Date(video.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoCard;
