
import React from 'react';
import { Video } from '../types';

interface VideoCardProps {
  video: Video;
  onClick: (video: Video) => void;
  onUninstall?: (id: string) => void;
}

const VideoCard: React.FC<VideoCardProps> = ({ video, onClick, onUninstall }) => {
  return (
    <div 
      className="group cursor-pointer flex flex-col gap-3 relative"
      onClick={() => onClick(video)}
    >
      <div className="relative aspect-video rounded-xl overflow-hidden bg-[#272727] shadow-lg">
        <img 
          src={video.thumbnail || `https://picsum.photos/seed/${video.id}/400/225`} 
          alt={video.title}
          className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-300"
        />
        
        {/* Status Badge */}
        <div className={`absolute top-2 left-2 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest shadow-lg ${video.isLocal ? 'bg-blue-600 text-white' : 'bg-emerald-600 text-white'}`}>
          {video.isLocal ? 'Local Mesh' : 'Global Link'}
        </div>

        {/* Uninstall Button */}
        {onUninstall && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onUninstall(video.id);
            }}
            className="absolute top-2 right-2 w-8 h-8 bg-red-600/90 hover:bg-red-600 text-white rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all transform scale-90 group-hover:scale-100 shadow-xl z-10"
            title="Uninstall Video"
          >
            <i className="fa-solid fa-trash-can text-xs"></i>
          </button>
        )}

        <div className="absolute bottom-2 right-2 bg-black/80 px-1.5 py-0.5 rounded text-[10px] font-bold">
          {video.duration}
        </div>
      </div>
      
      <div className="flex gap-3 px-1">
        <div className="w-9 h-9 flex-shrink-0 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 overflow-hidden ring-1 ring-white/10">
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
