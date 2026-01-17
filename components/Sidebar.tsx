
import React from 'react';

interface SidebarProps {
  onCategorySelect: (category: string) => void;
  activeCategory: string;
}

const Sidebar: React.FC<SidebarProps> = ({ onCategorySelect, activeCategory }) => {
  const navItems = [
    { icon: 'fa-home', label: 'Home', id: 'all' },
    { icon: 'fa-fire', label: 'Trending', id: 'trending' },
    { icon: 'fa-clapperboard', label: 'Subscriptions', id: 'subs' },
    { icon: 'fa-layer-group', label: 'Library', id: 'library' },
  ];

  const categories = [
    'Music', 'Gaming', 'News', 'Movies', 'Fashion', 'Learning', 'Live'
  ];

  return (
    <aside className="w-64 hidden lg:flex flex-col h-[calc(100vh-64px)] fixed left-0 top-16 bg-[#0f0f0f] p-3 overflow-y-auto border-r border-white/5">
      <div className="space-y-1 mb-6">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onCategorySelect(item.id)}
            className={`w-full flex items-center gap-5 px-4 py-2.5 rounded-xl transition-colors hover:bg-white/10 ${
              activeCategory === item.id ? 'bg-white/10 font-medium' : ''
            }`}
          >
            <i className={`fa-solid ${item.icon} text-lg w-6 text-center`}></i>
            <span className="text-sm">{item.label}</span>
          </button>
        ))}
      </div>

      <hr className="border-white/10 mb-6 mx-2" />

      <div className="px-4 mb-4">
        <h3 className="text-sm font-semibold mb-2 text-gray-400">Categories</h3>
        <div className="space-y-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => onCategorySelect(cat.toLowerCase())}
              className={`w-full flex items-center px-2 py-2 rounded-lg text-sm transition-colors hover:bg-white/5 ${
                activeCategory === cat.toLowerCase() ? 'bg-white/10' : ''
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>
      
      <div className="mt-auto px-4 py-6 text-[10px] text-gray-500 font-medium leading-tight">
        <p>© 2024 VibeStream LLC</p>
        <p>About Press Copyright</p>
        <p>Contact us Creators</p>
        <p>Advertise Developers</p>
      </div>
    </aside>
  );
};

export default Sidebar;
