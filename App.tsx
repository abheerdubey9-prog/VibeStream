
import React, { useState, useEffect, useMemo } from 'react';
import { Video, ViewMode } from './types.ts';
import { saveVideoGlobally, subscribeToVideos } from './services/dbService.ts';
import { generateVideoMetadata } from './services/geminiService.ts';
import Sidebar from './components/Sidebar.tsx';
import VideoCard from './components/VideoCard.tsx';

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

  useEffect(() => {
    // Subscribe to the decentralized P2P feed
    try {
      subscribeToVideos((video) => {
        if (video && video.id) {
          setGlobalVideos(prev => ({
            ...prev,
            [video.id]: video
          }));
        }
      });
    } catch (e) {
      console.error("Gun connection failed. Check your internet.");
    }
  }, []);

  const videosArray = useMemo(() => {
    return Object.values(globalVideos).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
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
      videoElement.muted = true;
      
      await new Promise((resolve) => {
        videoElement.onloadeddata = () => {
          videoElement.currentTime = 1;
        };
        videoElement.onseeked = () => resolve(true);
        videoElement.onerror = () => resolve(true); // Continue even if preview fails
        setTimeout(() => resolve(true), 4000); // Max 4s wait
      });

      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 180;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      const thumbnailData = canvas.toDataURL('image/jpeg', 0.5);

      setUploadProgress(40);
      const metadata = await generateVideoMetadata(thumbnailData);
      setUploadProgress(80);

      const newVideo: Video = {
        id: Math.random().toString(36).substr(2, 9),
        title: metadata.title || fileName,
        description: metadata.description || 'A video shared by a community member.',
        url: videoUrl,
        thumbnail: thumbnailData,
        uploader: `User_${Math.floor(Math.random() * 9999)}`,
        views: 0,
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
      console.error("Video processing error:", err);
      setIsUploading(false);
      alert("Something went wrong. Please check your internet or video link.");
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
    processVideoMetadata(publicUrl, "External Video");
  };

  const filteredVideos = videosArray.filter(v => 
    (activeCategory === 'all' || v.category === activeCategory) &&
    (v.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
     v.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white selection:bg-blue-500/30">
      <nav className="h-16 bg-[#0f0f0f]/95 backdrop-blur-md sticky top-0 z-50 flex items-center justify-between px-4 border-b border-white/5">
        <div className="flex items-center gap-4">
          <button className="p-2 hover:bg-white/10 rounded-full"><i className="fa-solid fa-bars text-lg"></i></button>
          <div 
            className="flex items-center gap-1 cursor-pointer"
            onClick={() => { setViewMode(ViewMode.FEED); setSelectedVideo(null); }}
          >
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
              <i className="fa-solid fa-globe text-white text-xs"></i>
            </div>
            <span className="text-xl font-bold tracking-tighter hidden sm:block">VibeStream <span className="text-[10px] bg-blue-600 px-1 rounded ml-1 font-black">GLOBAL</span></span>
          </div>
        </div>

        <div className="flex-1 max-w-2xl mx-4 relative">
          <div className="flex items-center bg-[#121212] border border-white/10 rounded-full overflow-hidden focus-within:border-blue-500 transition-all">
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
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-full text-sm font-bold transition-all"
          >
            <i className="fa-solid fa-cloud-arrow-up"></i>
            <span className="hidden sm:inline">Share</span>
          </button>
          <div className="flex items-center gap-1.5 px-3 py-1 bg-green-500/10 rounded-full border border-green-500/20">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-[10px] font-bold text-green-500 uppercase tracking-tighter hidden lg:block">P2P Online</span>
          </div>
        </div>
      </nav>

      {showUrlModal && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-[#181818] w-full max-w-md rounded-3xl p-8 border border-white/10 shadow-2xl">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black">Share with World</h2>
              <button onClick={() => setShowUrlModal(false)} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"><i className="fa-solid fa-xmark"></i></button>
            </div>
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3 block">Option 1: Paste Direct MP4 Link</label>
                <input 
                  type="text" 
                  placeholder="https://example.com/movie.mp4"
                  className="w-full bg-[#0f0f0f] border border-white/10 rounded-2xl px-5 py-4 outline-none focus:border-blue-500 transition-all text-sm"
                  value={publicUrl}
                  onChange={(e) => setPublicUrl(e.target.value)}
                />
              </div>
              <div className="relative flex items-center py-2">
                <div className="flex-1 h-px bg-white/5"></div>
                <span className="px-4 text-[10px] text-gray-600 font-black tracking-widest">OR</span>
                <div className="flex-1 h-px bg-white/5"></div>
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3 block">Option 2: Personal Local Upload</label>
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/5 rounded-2xl cursor-pointer hover:bg-white/5 transition-all group">
                   <i className="fa-solid fa-film text-3xl mb-3 text-gray-600 group-hover:text-blue-500 transition-colors"></i>
                   <p className="text-xs font-bold text-gray-500 group-hover:text-gray-300">Pick MP4 File</p>
                   <input type="file" accept="video/*" className="hidden" onChange={handleFileUpload} />
                </label>
              </div>
              <button 
                onClick={handleUrlSubmit}
                disabled={!publicUrl}
                className={`w-full py-4 rounded-2xl font-black transition-all ${publicUrl ? 'bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-600/20' : 'bg-white/5 text-gray-600 cursor-not-allowed'}`}
              >
                GO GLOBAL
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex">
        {viewMode === ViewMode.FEED && <Sidebar activeCategory={activeCategory} onCategorySelect={setActiveCategory} />}
        <main className={`flex-1 ${viewMode === ViewMode.FEED ? 'lg:ml-64 p-4 lg:p-8' : 'w-full'}`}>
          {isUploading && (
            <div className="fixed bottom-8 right-8 z-[110] bg-[#1a1a1a] border border-white/10 p-5 rounded-2xl shadow-2xl w-80 animate-in slide-in-from-right-10 duration-500">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-black uppercase tracking-widest text-blue-500">Analyzing Content</span>
                <span className="text-xs font-bold">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
              </div>
              <p className="text-[10px] text-gray-500 mt-3 italic leading-relaxed">Gemini AI is examining your video to generate metadata for the global feed...</p>
            </div>
          )}

          {viewMode === ViewMode.FEED ? (
            <div className="max-w-[2000px] mx-auto">
              <div className="flex gap-2 overflow-x-auto pb-8 scrollbar-hide">
                {['All', 'Music', 'Gaming', 'News', 'Learning', 'Creative'].map((cat) => (
                  <button 
                    key={cat}
                    onClick={() => setActiveCategory(cat.toLowerCase())}
                    className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                      activeCategory === cat.toLowerCase() ? 'bg-white text-black' : 'bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-x-5 gap-y-12">
                {filteredVideos.map(video => <VideoCard key={video.id} video={video} onClick={handleVideoSelect} />)}
              </div>
              
              {filteredVideos.length === 0 && (
                <div className="flex flex-col items-center justify-center py-48 text-center animate-in fade-in duration-1000">
                  <div className="w-24 h-24 bg-blue-600/5 rounded-full flex items-center justify-center mb-6">
                    <i className="fa-solid fa-tower-broadcast text-4xl text-blue-500/50"></i>
                  </div>
                  <h2 className="text-2xl font-black mb-3">Listening for Global Signals</h2>
                  <p className="text-gray-500 max-w-sm text-sm">Connecting to the decentralized peer network. Videos shared by others will appear here shortly.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-8 p-0 lg:p-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
              <div className="flex-1">
                <div className="aspect-video bg-black rounded-none lg:rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/5">
                  <video key={selectedVideo?.url} src={selectedVideo?.url} controls autoPlay className="w-full h-full" />
                </div>
                <div className="mt-6 px-4 lg:px-0">
                  <h1 className="text-2xl lg:text-3xl font-black mb-4 leading-tight">{selectedVideo?.title}</h1>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 p-0.5">
                        <div className="w-full h-full rounded-full bg-[#0f0f0f] overflow-hidden">
                          <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedVideo?.uploader}`} alt="avatar" />
                        </div>
                      </div>
                      <div>
                        <h4 className="font-black text-base">{selectedVideo?.uploader}</h4>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Global P2P Verified</p>
                      </div>
                      <button className="ml-4 px-6 py-2.5 bg-white text-black text-xs font-black rounded-full hover:bg-gray-200 transition-transform active:scale-95">SUBSCRIBE</button>
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-3xl p-6 mb-12 text-sm border border-white/5">
                    <div className="flex gap-4 font-bold mb-3 text-gray-400">
                      <span>{selectedVideo?.views.toLocaleString()} community views</span>
                      <span>Shared {new Date(selectedVideo?.createdAt || 0).toLocaleDateString()}</span>
                    </div>
                    <p className="text-gray-300 leading-relaxed font-medium">{selectedVideo?.description}</p>
                  </div>
                </div>
              </div>
              <div className="w-full lg:w-[420px] flex flex-col gap-5 px-4 lg:px-0">
                <h3 className="font-black text-[10px] text-gray-500 uppercase tracking-[0.2em] px-1">Community Feed</h3>
                {videosArray.filter(v => v.id !== selectedVideo?.id).slice(0, 12).map(video => (
                  <div key={video.id} className="flex gap-3 group cursor-pointer" onClick={() => handleVideoSelect(video)}>
                    <div className="relative w-44 h-24 flex-shrink-0 bg-[#1a1a1a] rounded-2xl overflow-hidden shadow-xl ring-1 ring-white/5">
                      <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                      <div className="absolute bottom-2 right-2 bg-black/80 px-1.5 py-0.5 rounded-lg text-[10px] font-black">{video.duration}</div>
                    </div>
                    <div className="flex flex-col overflow-hidden py-1 justify-center">
                      <h4 className="text-xs font-bold line-clamp-2 leading-snug group-hover:text-blue-500 transition-colors">{video.title}</h4>
                      <p className="text-[10px] text-gray-500 mt-2 font-black uppercase tracking-tighter">{video.uploader}</p>
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
