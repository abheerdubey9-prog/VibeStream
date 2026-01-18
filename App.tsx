
import React, { useState, useEffect, useMemo } from 'react';
import { Video, ViewMode, User } from './types';
import { saveVideoGlobally, subscribeToVideos, removeVideoGlobally } from './services/dbService';
import { generateVideoMetadata } from './services/geminiService';
import { storeLocalVideo, getLocalVideo, removeLocalVideo } from './services/storageService';
import Sidebar from './components/Sidebar';
import VideoCard from './components/VideoCard';
import VideoPlayer from './components/VideoPlayer';

const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.AUTH);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  
  const [globalVideos, setGlobalVideos] = useState<Record<string, Video>>({});
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [publicUrl, setPublicUrl] = useState('');
  const [lastSyncedVideo, setLastSyncedVideo] = useState<string | null>(null);
  const [showNotification, setShowNotification] = useState(false);
  const [videoError, setVideoError] = useState<boolean>(false);
  const [showDetails, setShowDetails] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // State for editing video details before broadcast
  const [pendingVideo, setPendingVideo] = useState<Video | null>(null);
  const [pendingFileBlob, setPendingFileBlob] = useState<Blob | null>(null);

  // Check for existing session on load
  useEffect(() => {
    const savedUser = localStorage.getItem('vibestream_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
      setViewMode(ViewMode.FEED);
    }
  }, []);

  // Subscribe to P2P network updates
  useEffect(() => {
    if (viewMode === ViewMode.AUTH) return;

    try {
      subscribeToVideos(async (video, id) => {
        if (video === null) {
          setGlobalVideos(prev => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
          if (selectedVideo?.id === id) {
            setViewMode(ViewMode.FEED);
            setSelectedVideo(null);
          }
          await removeLocalVideo(id);
        } else {
          let processedVideo = { ...video };
          if (video.isLocal) {
            const localFile = await getLocalVideo(id);
            if (localFile) {
              processedVideo.url = URL.createObjectURL(localFile);
            }
          }

          setGlobalVideos(prev => {
            if (!prev[id]) {
              setLastSyncedVideo(processedVideo.title);
              setShowNotification(true);
              setTimeout(() => setShowNotification(false), 5000);
            }
            return { ...prev, [id]: processedVideo };
          });
        }
      });
    } catch (e) {
      console.warn("P2P synchronization layer error.");
    }
  }, [viewMode, selectedVideo?.id]);

  const handleGoogleSignIn = () => {
    setIsAuthenticating(true);
    // Simulate Google OAuth flow
    setTimeout(() => {
      const mockUser: User = {
        id: Math.random().toString(36).substr(2, 9),
        name: `Vibe User ${Math.floor(Math.random() * 1000)}`,
        email: `user${Math.floor(Math.random() * 1000)}@gmail.com`,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${Math.random()}`
      };
      localStorage.setItem('vibestream_user', JSON.stringify(mockUser));
      setUser(mockUser);
      setIsAuthenticating(false);
      setViewMode(ViewMode.FEED);
    }, 1500);
  };

  const handleLogout = () => {
    localStorage.removeItem('vibestream_user');
    setUser(null);
    setViewMode(ViewMode.AUTH);
  };

  const videosArray = useMemo(() => {
    const videos = Object.values(globalVideos) as Video[];
    return videos.sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
  }, [globalVideos]);

  const handleVideoSelect = (video: Video) => {
    setSelectedVideo(video);
    setVideoError(false);
    setShowDetails(false);
    setViewMode(ViewMode.WATCH);
    window.scrollTo(0, 0);
  };

  const handleUninstall = async (id: string) => {
    if (!confirm("Remove this broadcast from the network?")) return;
    setIsDeleting(true);
    try {
      await removeVideoGlobally(id);
      await removeLocalVideo(id);
    } catch (err) {
      console.error("Cleanup failed:", err);
    }
    setIsDeleting(false);
  };

  const processVideoMetadata = async (videoUrl: string, fileName: string, fileBlob?: Blob) => {
    if (!user) return;
    setIsUploading(true);
    setUploadProgress(10);
    
    try {
      const videoId = Math.random().toString(36).substr(2, 9);
      
      const videoElement = document.createElement('video');
      videoElement.src = videoUrl;
      videoElement.crossOrigin = "anonymous";
      videoElement.muted = true;
      
      const videoInfo = await new Promise<{ resolution: string, duration: string }>((resolve) => {
        videoElement.onloadedmetadata = () => {
          const res = `${videoElement.videoWidth}x${videoElement.videoHeight}`;
          const dur = isFinite(videoElement.duration) 
            ? `${Math.floor(videoElement.duration / 60)}:${Math.floor(videoElement.duration % 60).toString().padStart(2, '0')}`
            : '0:00';
          resolve({ resolution: res, duration: dur });
        };
        videoElement.onerror = () => resolve({ resolution: 'Unknown', duration: '0:00' });
        setTimeout(() => resolve({ resolution: '1080p', duration: '0:00' }), 4000);
      });

      setUploadProgress(30);
      videoElement.currentTime = Math.min(1, videoElement.duration || 0);
      await new Promise(r => setTimeout(r, 500));

      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 180;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      const thumbnailData = canvas.toDataURL('image/jpeg', 0.5);

      setUploadProgress(50);
      const metadata = await generateVideoMetadata(thumbnailData);
      setUploadProgress(100);

      const newVideo: Video = {
        id: videoId,
        title: metadata.title || fileName,
        description: metadata.description || 'A community shared video.',
        url: videoUrl,
        thumbnail: thumbnailData,
        uploader: user.name,
        views: 0,
        createdAt: Date.now(),
        duration: videoInfo.duration,
        category: metadata.category?.toLowerCase() || 'uncategorized',
        isLocal: !!fileBlob,
        resolution: videoInfo.resolution,
        codec: fileName.split('.').pop()?.toUpperCase() || 'MP4'
      };

      setPendingVideo(newVideo);
      setPendingFileBlob(fileBlob || null);
      setIsUploading(false);
      setUploadProgress(0);
      setShowUrlModal(false);
      setPublicUrl('');

    } catch (err) {
      setIsUploading(false);
      console.error(err);
      alert("Video processing failed.");
    }
  };

  const confirmBroadcast = async () => {
    if (!pendingVideo) return;
    
    setIsUploading(true);
    setUploadProgress(10);
    
    try {
      if (pendingFileBlob) {
        await storeLocalVideo(pendingVideo.id, pendingFileBlob);
      }
      setUploadProgress(50);
      await saveVideoGlobally(pendingVideo);
      setUploadProgress(100);
      
      const finalVideo = pendingVideo;
      setPendingVideo(null);
      setPendingFileBlob(null);
      setIsUploading(false);
      setUploadProgress(0);
      handleVideoSelect(finalVideo);
    } catch (error) {
      setIsUploading(false);
      alert("Failed to broadcast video.");
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    processVideoMetadata(url, file.name, file);
  };

  const handleUrlSubmit = () => {
    if (!publicUrl) return;
    processVideoMetadata(publicUrl, "External Stream");
  };

  const filteredVideos = videosArray.filter(v => 
    (activeCategory === 'all' || v.category === activeCategory) &&
    (v.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
     v.description?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (viewMode === ViewMode.AUTH) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/20 blur-[120px] rounded-full"></div>

        <div className="w-full max-w-md z-10 animate-in fade-in zoom-in duration-700">
          <div className="bg-[#121212]/80 backdrop-blur-xl border border-white/5 rounded-[40px] p-10 shadow-2xl text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-500/20 mx-auto mb-8">
              <i className="fa-solid fa-globe text-white text-3xl"></i>
            </div>
            
            <h1 className="text-4xl font-black tracking-tight mb-3">VibeStream</h1>
            <p className="text-gray-400 text-sm font-medium mb-10 leading-relaxed">
              Decentralized video discovery with adaptive mesh streaming.
            </p>

            <button 
              onClick={handleGoogleSignIn}
              disabled={isAuthenticating}
              className="w-full bg-white text-black h-14 rounded-2xl font-bold flex items-center justify-center gap-4 hover:bg-gray-100 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {isAuthenticating ? (
                <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.64 24.55c0-1.65-.15-3.23-.42-4.75H24v9.03h12.73c-.55 2.85-2.15 5.27-4.57 6.91l7.14 5.53c4.18-3.85 6.64-9.53 6.64-15.72z"/>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.14-5.53c-2.1.84-4.71 1.34-8.75 1.34-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                  </svg>
                  Sign in with Google
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

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
            <span className="text-xl font-bold tracking-tighter hidden sm:block">VibeStream <span className="text-[10px] bg-blue-600 px-1 rounded ml-1 font-black uppercase">P2P</span></span>
          </div>
        </div>

        <div className="flex-1 max-w-2xl mx-4 relative">
          <div className="flex items-center bg-[#121212] border border-white/10 rounded-full overflow-hidden focus-within:border-blue-500 transition-all">
            <input 
              type="text" 
              placeholder="Search Mesh network..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent px-5 py-2 outline-none text-sm placeholder:text-gray-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 lg:gap-4">
          <button 
            onClick={() => setShowUrlModal(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-full text-sm font-bold transition-all shadow-lg shadow-blue-600/20"
          >
            <i className="fa-solid fa-cloud-arrow-up"></i>
            <span className="hidden sm:inline">Broadcast</span>
          </button>
          
          <div className="flex items-center gap-3 pl-2 border-l border-white/5 ml-2">
            <div className="w-8 h-8 rounded-full bg-white/5 overflow-hidden ring-1 ring-white/10">
              <img src={user?.avatar} alt="user avatar" />
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 text-gray-500 hover:text-white transition-colors"
              title="Logout"
            >
              <i className="fa-solid fa-right-from-bracket"></i>
            </button>
          </div>
        </div>
      </nav>

      {/* Pending Video Editor Modal */}
      {pendingVideo && (
        <div className="fixed inset-0 z-[150] bg-black/90 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-[#181818] w-full max-w-xl rounded-[40px] p-8 border border-white/10 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-2xl font-black tracking-tight">Finalize Broadcast</h2>
                <p className="text-xs text-blue-500 font-black uppercase tracking-widest mt-1">Review AI Suggestions</p>
              </div>
              <button 
                onClick={() => { setPendingVideo(null); setPendingFileBlob(null); }} 
                className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            
            <div className="space-y-8">
              <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black ring-1 ring-white/10 shadow-inner">
                <img src={pendingVideo.thumbnail} alt="preview" className="w-full h-full object-cover" />
              </div>

              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3 block">Video Title</label>
                  <input 
                    type="text" 
                    className="w-full bg-[#0f0f0f] border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-blue-500 transition-all text-sm font-bold"
                    value={pendingVideo.title}
                    onChange={(e) => setPendingVideo({ ...pendingVideo, title: e.target.value })}
                    placeholder="Enter a catchy title..."
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3 block">Description</label>
                  <textarea 
                    rows={3}
                    className="w-full bg-[#0f0f0f] border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-blue-500 transition-all text-sm font-medium resize-none"
                    value={pendingVideo.description}
                    onChange={(e) => setPendingVideo({ ...pendingVideo, description: e.target.value })}
                    placeholder="What's this video about?"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3 block">Category</label>
                    <select 
                      className="w-full bg-[#0f0f0f] border border-white/10 rounded-2xl px-4 py-4 outline-none focus:border-blue-500 transition-all text-sm font-bold appearance-none cursor-pointer"
                      value={pendingVideo.category}
                      onChange={(e) => setPendingVideo({ ...pendingVideo, category: e.target.value })}
                    >
                      {['creative', 'music', 'gaming', 'news', 'learning', 'uncategorized'].map(cat => (
                        <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3 block">Network Type</label>
                    <div className="h-[52px] bg-white/5 border border-white/5 rounded-2xl flex items-center px-6">
                      <span className="text-xs font-black uppercase tracking-widest text-blue-500">
                        {pendingVideo.isLocal ? 'Mesh Node' : 'Global Source'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <button 
                onClick={confirmBroadcast}
                className="w-full py-5 rounded-[24px] bg-blue-600 hover:bg-blue-700 font-black text-sm tracking-widest uppercase transition-all shadow-xl shadow-blue-600/20 active:scale-[0.98]"
              >
                BROADCAST TO PEERS
              </button>
            </div>
          </div>
        </div>
      )}

      {showNotification && (
        <div className="fixed bottom-6 left-6 z-[200] bg-[#1a1a1a] border border-blue-500/30 p-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-left-10 duration-500 max-w-xs">
          <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
            <i className="fa-solid fa-bolt text-white text-sm"></i>
          </div>
          <div className="overflow-hidden">
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-0.5">Network Update</p>
            <p className="text-xs font-bold text-gray-200 line-clamp-1">{lastSyncedVideo} joined mesh</p>
          </div>
        </div>
      )}

      {showUrlModal && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-[#181818] w-full max-w-md rounded-3xl p-8 border border-white/10 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black tracking-tight">Broadcast Content</h2>
              <button onClick={() => setShowUrlModal(false)} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center"><i className="fa-solid fa-xmark"></i></button>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3 block">Global URL (Visible to Everyone)</label>
                <input 
                  type="text" 
                  placeholder="https://example.com/video.mp4"
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
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3 block">Local File (Saved on Device)</label>
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/5 rounded-2xl cursor-pointer hover:bg-white/5 transition-all group">
                   <i className="fa-solid fa-file-video text-3xl mb-3 text-gray-600 group-hover:text-blue-500 transition-colors"></i>
                   <p className="text-xs font-bold text-gray-500 group-hover:text-gray-300">Select MP4 Video</p>
                   <input type="file" accept="video/*" className="hidden" onChange={handleFileUpload} />
                </label>
              </div>
              <button 
                onClick={handleUrlSubmit}
                disabled={!publicUrl}
                className={`w-full py-4 rounded-2xl font-black transition-all ${publicUrl ? 'bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-600/20' : 'bg-white/5 text-gray-600 cursor-not-allowed'}`}
              >
                ANALYZE & BROADCAST
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex">
        {viewMode === ViewMode.FEED && <Sidebar activeCategory={activeCategory} onCategorySelect={setActiveCategory} />}
        <main className={`flex-1 ${viewMode === ViewMode.FEED ? 'lg:ml-64 p-4 lg:p-8' : 'w-full'}`}>
          {isUploading && (
            <div className="fixed bottom-8 right-8 z-[200] bg-[#1a1a1a] border border-white/10 p-5 rounded-2xl shadow-2xl w-80">
              <div className="flex items-center justify-between mb-3 text-blue-500">
                <span className="text-xs font-black uppercase tracking-widest">Processing Data...</span>
                <span className="text-xs font-bold">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
              </div>
            </div>
          )}

          {viewMode === ViewMode.FEED ? (
            <div className="max-w-[2000px] mx-auto">
              <div className="flex gap-2 overflow-x-auto pb-8 scrollbar-hide">
                {['All', 'Music', 'Gaming', 'News', 'Learning', 'Creative'].map((cat) => (
                  <button key={cat} onClick={() => setActiveCategory(cat.toLowerCase())} className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${activeCategory === cat.toLowerCase() ? 'bg-white text-black' : 'bg-white/5 hover:bg-white/10'}`}>
                    {cat}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-x-5 gap-y-12">
                {filteredVideos.map(video => (
                  <VideoCard 
                    key={video.id} 
                    video={video} 
                    onClick={handleVideoSelect} 
                    onUninstall={handleUninstall}
                  />
                ))}
              </div>
              {filteredVideos.length === 0 && (
                <div className="flex flex-col items-center justify-center py-48 text-center animate-in fade-in duration-700">
                  <i className="fa-solid fa-satellite-dish text-4xl text-white/20 mb-6 animate-pulse"></i>
                  <h2 className="text-2xl font-black mb-2">Syncing Mesh...</h2>
                </div>
              )}
            </div>
          ) : (
            <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-8 p-0 lg:p-6 animate-in fade-in slide-in-from-bottom-8 duration-500">
              <div className="flex-1">
                <div className="aspect-video bg-black relative rounded-none lg:rounded-3xl overflow-hidden shadow-2xl">
                  {videoError ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center bg-[#1a1a1a]">
                      <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
                        <i className="fa-solid fa-circle-exclamation text-3xl text-red-500"></i>
                      </div>
                      <h3 className="text-xl font-black mb-3">Broadcast Unavailable</h3>
                      <button 
                        onClick={() => { setViewMode(ViewMode.FEED); setSelectedVideo(null); }}
                        className="mt-8 px-6 py-2.5 bg-white text-black text-xs font-black rounded-full hover:bg-gray-200"
                      >
                        BACK TO FEED
                      </button>
                    </div>
                  ) : (
                    selectedVideo && (
                      <VideoPlayer 
                        src={selectedVideo.url} 
                        poster={selectedVideo.thumbnail}
                        onError={() => setVideoError(true)}
                      />
                    )
                  )}
                </div>
                <div className="mt-6 px-4 lg:px-0">
                  <div className="flex justify-between items-start gap-4">
                    <h1 className="text-2xl lg:text-3xl font-black mb-4 leading-tight flex-1">{selectedVideo?.title}</h1>
                    <button 
                      onClick={() => selectedVideo && handleUninstall(selectedVideo.id)}
                      className="px-4 py-2 bg-white/5 hover:bg-red-600/20 text-red-500 border border-red-500/20 rounded-full text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                      Uninstall
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center shadow-lg overflow-hidden ring-2 ring-white/10">
                      <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedVideo?.uploader}`} alt="avatar" />
                    </div>
                    <div>
                      <h4 className="font-black text-base">{selectedVideo?.uploader}</h4>
                      <p className="text-[10px] text-blue-500 font-black uppercase tracking-widest">Active Node</p>
                    </div>
                  </div>
                  
                  <div className="bg-white/5 rounded-3xl p-6 border border-white/5">
                    <p className="text-gray-300 leading-relaxed font-medium">{selectedVideo?.description}</p>
                  </div>
                </div>
              </div>
              <div className="w-full lg:w-[420px] flex flex-col gap-5 px-4 lg:px-0">
                <h3 className="font-black text-[10px] text-blue-500 uppercase tracking-widest px-1">Up Next</h3>
                {videosArray.filter(v => v.id !== selectedVideo?.id).slice(0, 10).map(video => (
                  <div key={video.id} className="flex gap-3 group cursor-pointer" onClick={() => handleVideoSelect(video)}>
                    <div className="relative w-44 h-24 flex-shrink-0 bg-[#1a1a1a] rounded-2xl overflow-hidden shadow-xl ring-1 ring-white/5">
                      <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                      <div className="absolute bottom-2 right-2 bg-black/80 px-1.5 py-0.5 rounded-lg text-[10px] font-black">{video.duration}</div>
                    </div>
                    <div className="flex flex-col overflow-hidden py-1">
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
