
import React, { useState, useEffect, useMemo } from 'react';
import { Video, ViewMode } from './types';
import { saveVideoGlobally, subscribeToVideos, getLocalVideos, saveLocal } from './services/dbService';
import { generateVideoMetadata } from './services/geminiService';
import Sidebar from './components/Sidebar';
import VideoCard from './components/VideoCard';

const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.FEED);
  const [globalVideos, setGlobalVideos] = useState<Record<string, Video>>({});
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [publicUrl, setPublicUrl] = useState('');

  // Subscribe to the global P2P feed
  useEffect(() => {
    subscribeToVideos((video) => {
      setGlobalVideos(prev => ({
        ...prev,
        [video.id]: video
      }));
    });
  }, []);

  const videosArray = useMemo(() => {
    return Object.values(globalVideos).sort((a, b) => b.createdAt - a.createdAt);
  }, [globalVideos]);

  const handleVideoSelect = (video: Video) => {
    setSelectedVideo(video);
    setViewMode(ViewMode.WATCH);
    window.scrollTo(0, 0);
  };

  const processVideoMetadata = async (videoUrl: string, fileName: string) => {
    setIsUploading(true);
    setUploadProgress(10);
    
    try {
      const videoElement = document.createElement('video');
      videoElement.src = videoUrl;
      videoElement.crossOrigin = "anonymous";
      
      await new Promise((resolve, reject) => {
        videoElement.onloadeddata = () => {
          videoElement.currentTime = 1;
        };
        videoElement.onseeked = () => resolve(true);
        videoElement.onerror = () => reject("Failed to load video");
        // Timeout for safety
        setTimeout(() => resolve(true), 5000);
      });

      const canvas = document.createElement('canvas');
      canvas.width = 320; // Lower res for Gun.js performance
      canvas.height = 180;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      const thumbnailData = canvas.toDataURL('image/jpeg', 0.6);

      setUploadProgress(40);
      const metadata = await generateVideoMetadata(thumbnailData);
      setUploadProgress(80);

      const newVideo: Video = {
        id: Math.random().toString(36).substr(2, 9),
        title: metadata.title || fileName,
        description: metadata.description || 'Global community video',
        url: videoUrl,
        thumbnail: thumbnailData,
        uploader: `User_${Math.floor(Math.random() * 9999)}`,
        views: Math.floor(Math.random() * 100),
        createdAt: Date.now(),
        duration: isFinite(videoElement.duration) 
            ? `${Math.floor(videoElement.duration / 60)}:${Math.floor(videoElement.duration % 60).toString().padStart(2, '0')}`
            : '0:00',
        category: metadata.category?.toLowerCase() || 'uncategorized'
      };

      await saveVideoGlobally(newVideo);
      setUploadProgress(100);
      
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
        setShowUrlModal(false);
        setPublicUrl('');
        handleVideoSelect(newVideo);
      }, 500);

    } catch (err) {
      console.error("Processing failed", err);
      setIsUploading(false);
      alert("Could not process video. Try a direct MP4 link.");
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    processVideoMetadata(url, file.name);
  };

  const handleUrlSubmit = () => {
    if (!publicUrl) return;
    processVideoMetadata(publicUrl, "Public Video");
  };

  const filteredVideos = videosArray.filter(v => 
    (activeCategory === 'all' || v.category === activeCategory) &&
    (v.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
     v.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">
      {/* Navbar */}
      <nav className="h-16 bg-[#0f0f0f]/95 backdrop-blur-md sticky top-0 z-50 flex items-center justify-between px-4 border-b border-white/5">
        <div className="flex items-center gap-4">
          <button className="p-2 hover:bg-white/10 rounded-full">
            <i className="fa-solid fa-bars text-lg"></i>
          </button>
          <div 
            className="flex items-center gap-1 cursor-pointer"
            onClick={() => {
              setViewMode(ViewMode.FEED);
              setSelectedVideo(null);
            }}
          >
            <div className="w-8 h-8 bg-gradient-to-br from-red-600 to-purple-600 rounded-lg flex items-center justify-center">
              <i className="fa-solid fa-globe text-white text-xs"></i>
            </div>
            <span className="text-xl font-bold tracking-tighter hidden sm:block">VibeStream <span className="text-[10px] bg-blue-600 px-1 rounded ml-1">GLOBAL</span></span>
          </div>
        </div>

        <div className="flex-1 max-w-2xl mx-4 relative group">
          <div className="flex items-center bg-[#121212] border border-white/10 rounded-full overflow-hidden group-focus-within:border-blue-500 transition-colors">
            <input 
              type="text" 
              placeholder="Search global community..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent px-5 py-2 outline-none text-sm placeholder:text-gray-500"
            />
            <button className="bg-white/5 border-l border-white/10 px-5 py-2 hover:bg-white/10">
              <i className="fa-solid fa-magnifying-glass text-sm text-gray-400"></i>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 lg:gap-4">
          <button 
            onClick={() => setShowUrlModal(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-full text-sm font-bold transition-all shadow-lg shadow-blue-900/20"
          >
            <i className="fa-solid fa-share-nodes"></i>
            <span className="hidden sm:inline">Share Video</span>
          </button>
          <div className="flex items-center gap-1 px-2 py-1 bg-green-500/10 rounded-full border border-green-500/20">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-[10px] font-bold text-green-500 uppercase tracking-widest hidden lg:block">P2P Live</span>
          </div>
        </div>
      </nav>

      {/* URL Modal */}
      {showUrlModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#1a1a1a] w-full max-w-md rounded-2xl p-6 border border-white/10 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Share Global Video</h2>
              <button onClick={() => setShowUrlModal(false)} className="text-gray-400 hover:text-white"><i className="fa-solid fa-xmark"></i></button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Option 1: Paste Link (Visible to All)</label>
                <input 
                  type="text" 
                  placeholder="https://example.com/video.mp4"
                  className="w-full bg-[#0f0f0f] border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-blue-500"
                  value={publicUrl}
                  onChange={(e) => setPublicUrl(e.target.value)}
                />
                <p className="text-[10px] text-gray-500 mt-2 italic">Links from Archive.org or Pexels work best.</p>
              </div>
              
              <div className="py-2 flex items-center gap-4">
                <div className="flex-1 h-px bg-white/5"></div>
                <span className="text-[10px] text-gray-600 font-bold uppercase">OR</span>
                <div className="flex-1 h-px bg-white/5"></div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Option 2: Local File (Visible to You)</label>
                <label className="flex items-center justify-center w-full h-24 border-2 border-dashed border-white/10 rounded-xl cursor-pointer hover:bg-white/5 transition-colors">
                   <div className="text-center">
                     <i className="fa-solid fa-file-video text-2xl mb-2 text-gray-500"></i>
                     <p className="text-xs font-medium text-gray-400">Select MP4 File</p>
                   </div>
                   <input type="file" accept="video/*" className="hidden" onChange={handleFileUpload} />
                </label>
              </div>

              <button 
                onClick={handleUrlSubmit}
                disabled={!publicUrl}
                className={`w-full py-3 rounded-xl font-bold transition-all ${publicUrl ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`}
              >
                Sync to Global Feed
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex pt-0">
        {viewMode === ViewMode.FEED && (
          <Sidebar activeCategory={activeCategory} onCategorySelect={setActiveCategory} />
        )}

        <main className={`flex-1 transition-all duration-300 ${viewMode === ViewMode.FEED ? 'lg:ml-64 p-4 lg:p-8' : 'w-full'}`}>
          {isUploading && (
            <div className="fixed bottom-8 right-8 z-[110] bg-zinc-900 border border-white/10 p-4 rounded-xl shadow-2xl w-80">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Globalizing...</span>
                <span className="text-xs text-gray-400">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
              </div>
              <p className="text-[10px] text-gray-500 mt-2 italic">Gemini is analyzing video content for global indexing...</p>
            </div>
          )}

          {viewMode === ViewMode.FEED ? (
            <div>
              <div className="flex gap-3 overflow-x-auto pb-6 scrollbar-hide">
                {['All', 'Music', 'Gaming', 'News', 'Learning', 'Live'].map((cat) => (
                  <button 
                    key={cat}
                    onClick={() => setActiveCategory(cat.toLowerCase())}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                      activeCategory === cat.toLowerCase() ? 'bg-white text-black' : 'bg-white/10 hover:bg-white/20'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-x-4 gap-y-10">
                {filteredVideos.map(video => (
                  <VideoCard key={video.id} video={video} onClick={handleVideoSelect} />
                ))}
              </div>
              
              {filteredVideos.length === 0 && (
                <div className="flex flex-col items-center justify-center py-32 text-center">
                  <div className="w-20 h-20 bg-blue-600/10 rounded-full flex items-center justify-center mb-4">
                    <i className="fa-solid fa-satellite-dish text-3xl text-blue-500 animate-pulse"></i>
                  </div>
                  <h2 className="text-xl font-semibold mb-2">Connecting to Feed</h2>
                  <p className="text-gray-400 max-w-sm">Waiting for global video metadata to sync from the P2P network...</p>
                </div>
              )}
            </div>
          ) : (
            <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-6 p-0 lg:p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex-1">
                <div className="aspect-video bg-black rounded-none lg:rounded-2xl overflow-hidden shadow-2xl">
                  <video key={selectedVideo?.url} src={selectedVideo?.url} controls autoPlay className="w-full h-full" />
                </div>
                
                <div className="mt-4 px-4 lg:px-0">
                  <h1 className="text-xl lg:text-2xl font-bold mb-3">{selectedVideo?.title}</h1>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 overflow-hidden">
                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedVideo?.uploader}`} alt="avatar" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm">{selectedVideo?.uploader} <span className="text-[10px] bg-white/10 px-1 rounded ml-1 font-normal text-gray-400">Global Creator</span></h4>
                        <p className="text-xs text-gray-400">P2P Verified</p>
                      </div>
                      <button className="ml-4 px-4 py-2 bg-white text-black text-sm font-bold rounded-full hover:bg-gray-200">Subscribe</button>
                    </div>
                  </div>
                  <div className="bg-white/10 rounded-2xl p-4 mb-8 text-sm hover:bg-white/15 cursor-pointer">
                    <div className="flex gap-3 font-bold mb-1">
                      <span>{selectedVideo?.views.toLocaleString()} global views</span>
                      <span>Shared {new Date(selectedVideo?.createdAt || 0).toLocaleDateString()}</span>
                    </div>
                    <p className="text-gray-200">{selectedVideo?.description}</p>
                  </div>
                </div>
              </div>

              <div className="w-full lg:w-[400px] flex flex-col gap-4 px-4 lg:px-0">
                <h3 className="font-bold text-sm text-gray-400 uppercase tracking-widest px-1">Other Global Clips</h3>
                {videosArray.filter(v => v.id !== selectedVideo?.id).slice(0, 10).map(video => (
                  <div key={video.id} className="flex gap-2 group cursor-pointer" onClick={() => handleVideoSelect(video)}>
                    <div className="relative w-40 h-24 flex-shrink-0 bg-[#272727] rounded-lg overflow-hidden shadow-lg">
                      <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      <div className="absolute bottom-1 right-1 bg-black/80 px-1 py-0.5 rounded text-[10px] font-bold">{video.duration}</div>
                    </div>
                    <div className="flex flex-col overflow-hidden py-1">
                      <h4 className="text-sm font-bold line-clamp-2 leading-tight group-hover:text-blue-400">{video.title}</h4>
                      <p className="text-[10px] text-gray-500 mt-1">{video.uploader}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
