import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:8080';

// ---- Helpers ----
const isYouTube = (url) => url && (url.includes('youtube.com') || url.includes('youtu.be'));
const isVideoFile = (url) => url && /\.(mp4|webm|ogg|mov)$/i.test(url);

const getYouTubeEmbedUrl = (url) => {
  if (!url) return '';
  const match = url.match(/(?:v=|youtu\.be\/)([^&?/]+)/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : url;
};

const regionColors = {
  'Phnom Penh': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  'Siem Reap': 'bg-violet-500/20 text-violet-300 border-violet-500/30',
  'Battambang': 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  'Kampot': 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  'Kandal': 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  'default': 'bg-slate-500/20 text-slate-300 border-slate-500/30',
};
const getRegionColor = (region) => regionColors[region] || regionColors['default'];

// ---- Sub-components ----

function VideoPlayer({ variation }) {
  const [expanded, setExpanded] = useState(false);

  if (!variation.video_url) return null;

  return (
    <div className="bg-slate-800/60 rounded-2xl border border-slate-700/50 overflow-hidden group hover:border-indigo-500/40 transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/40">
        <div className="flex items-center gap-2.5">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${getRegionColor(variation.region)}`}>
            📍 {variation.region || 'Không xác định'}
          </span>
          {isYouTube(variation.video_url) && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">
              ▶ YouTube
            </span>
          )}
          {isVideoFile(variation.video_url) && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20">
              🎬 Video
            </span>
          )}
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-slate-500 hover:text-indigo-400 transition-colors font-semibold flex items-center gap-1"
        >
          {expanded ? '▲ Thu gọn' : '▼ Xem video'}
        </button>
      </div>

      {/* Description */}
      {variation.description && (
        <p className="px-4 py-2 text-xs text-slate-400 italic border-b border-slate-700/30">
          {variation.description}
        </p>
      )}

      {/* Video */}
      {expanded && (
        <div className="p-3">
          {isYouTube(variation.video_url) ? (
            <div className="relative rounded-xl overflow-hidden" style={{ paddingBottom: '56.25%', height: 0 }}>
              <iframe
                src={getYouTubeEmbedUrl(variation.video_url)}
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={`Video ${variation.region}`}
              />
            </div>
          ) : isVideoFile(variation.video_url) ? (
            <video
              src={variation.video_url}
              controls
              className="w-full rounded-xl max-h-64 object-contain bg-black"
            />
          ) : (
            <a
              href={variation.video_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors"
            >
              <div className="h-10 w-10 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400 text-lg">🔗</div>
              <div>
                <p className="text-sm font-semibold text-indigo-300">Mở liên kết video</p>
                <p className="text-xs text-slate-500 truncate max-w-xs">{variation.video_url}</p>
              </div>
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function EntryCard({ entry, isSelected, onSelect }) {
  const [variations, setVariations] = useState(entry.variations || []);
  const [loadingVars, setLoadingVars] = useState(false);
  const [varLoaded, setVarLoaded] = useState(Array.isArray(entry.variations));

  const loadVariations = useCallback(async () => {
    if (varLoaded) return;
    setLoadingVars(true);
    try {
      const res = await axios.get(`${API_URL}/api/dictionary/entries/${entry.entry_id}/variations`);
      setVariations(res.data.variations || []);
    } catch (err) {
      console.error('Variations fetch error:', err);
    } finally {
      setLoadingVars(false);
      setVarLoaded(true);
    }
  }, [entry.entry_id, varLoaded]);

  const handleSelect = () => {
    onSelect(entry.entry_id);
    if (!varLoaded) {
      loadVariations();
    }
  };

  return (
    <div
      className={`group rounded-3xl border transition-all duration-300 overflow-hidden cursor-pointer
        ${isSelected
          ? 'border-indigo-500/50 bg-gradient-to-br from-indigo-950/60 to-violet-950/40 shadow-lg shadow-indigo-900/20'
          : 'border-slate-700/50 bg-slate-900/50 hover:border-slate-600/70 hover:bg-slate-800/50'
        }`}
      onClick={handleSelect}
    >
      {/* Card Header */}
      <div className="px-6 py-5 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 mb-2 flex-wrap">
            <h3 className={`text-2xl font-black tracking-tight transition-colors
              ${isSelected ? 'text-indigo-300' : 'text-slate-100 group-hover:text-white'}`}>
              {entry.word}
            </h3>
            {entry.category_name && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/20">
                {entry.category_name}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400 leading-relaxed line-clamp-2">{entry.meaning}</p>
        </div>
        <div className={`shrink-0 h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-300
          ${isSelected ? 'bg-indigo-500/20 text-indigo-400 rotate-0' : 'bg-slate-800 text-slate-500 group-hover:text-slate-300'}`}>
          <svg className={`w-4 h-4 transition-transform duration-300 ${isSelected ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Expanded: Variations */}
      {isSelected && (
        <div
          className="border-t border-slate-700/40 px-6 py-5 space-y-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Full meaning */}
          <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/40">
            <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 mb-2">Ý nghĩa đầy đủ</p>
            <p className="text-sm text-slate-200 leading-relaxed">{entry.meaning}</p>
          </div>

          {/* Variations header */}
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-slate-700/40"></div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 px-2">
              🎬 Biến thể phát âm theo vùng miền
            </p>
            <div className="h-px flex-1 bg-slate-700/40"></div>
          </div>

          {loadingVars ? (
            <div className="flex items-center gap-3 py-4 justify-center text-slate-500">
              <div className="h-5 w-5 border-2 border-t-indigo-500 border-slate-700 rounded-full animate-spin"></div>
              <span className="text-xs">Đang tải biến thể phát âm...</span>
            </div>
          ) : variations.length > 0 ? (
            <div className="space-y-3">
              {variations.map((v) => (
                <VideoPlayer key={v.variation_id} variation={v} />
              ))}
            </div>
          ) : (
            <div className="py-6 text-center">
              <div className="text-3xl mb-2">🔇</div>
              <p className="text-xs text-slate-600">Chưa có biến thể phát âm nào được thêm</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Main Page ----
export default function DictionaryPage() {
  const [keyword, setKeyword] = useState('');
  const [inputVal, setInputVal] = useState('');
  const [entries, setEntries] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [activeCategory, setActiveCategory] = useState(null);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  // Load categories on mount
  useEffect(() => {
    axios.get(`${API_URL}/api/dictionary/categories`)
      .then(res => setCategories(res.data || []))
      .catch(() => {});
    // Load all entries on start
    fetchEntries('');
  }, []);

  const fetchEntries = async (kw) => {
    setLoading(true);
    setSearched(true);
    try {
      const res = await axios.get(`${API_URL}/api/dictionary/search?word=${encodeURIComponent(kw)}`);
      setEntries(res.data.entries || []);
      setSelectedId(null);
    } catch (err) {
      console.error('Search error:', err);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInput = (e) => {
    const val = e.target.value;
    setInputVal(val);
    // Debounce 400ms
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setKeyword(val);
      fetchEntries(val);
    }, 400);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    clearTimeout(debounceRef.current);
    setKeyword(inputVal);
    fetchEntries(inputVal);
  };

  const handleClear = () => {
    setInputVal('');
    setKeyword('');
    fetchEntries('');
    inputRef.current?.focus();
  };

  const filteredEntries = activeCategory
    ? entries.filter(e => e.category_name === activeCategory)
    : entries;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex overflow-hidden">
      {/* ---- Sidebar ---- */}
      <aside className="w-64 bg-slate-900/80 border-r border-slate-800 flex flex-col shrink-0">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="bg-teal-500/10 p-2 rounded-xl border border-teal-500/20">
            <svg className="w-6 h-6 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <div>
            <p className="font-extrabold tracking-wider text-sm uppercase text-teal-400">Từ Điển</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Tiếng Khmer</p>
          </div>
        </div>

        {/* Categories filter */}
        <div className="flex-1 overflow-y-auto px-4 py-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-3 px-2">Danh mục</p>
          <div className="space-y-1">
            <button
              onClick={() => setActiveCategory(null)}
              className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                !activeCategory
                  ? 'bg-teal-500/15 text-teal-300 border-l-4 border-teal-500'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border-l-4 border-transparent'
              }`}
            >
              <span>📚</span> Tất cả từ vựng
              <span className="ml-auto text-slate-600 font-mono">{entries.length}</span>
            </button>

            {categories.map(cat => {
              const count = entries.filter(e => e.category_name === cat.name).length;
              return (
                <button
                  key={cat.category_id}
                  onClick={() => setActiveCategory(activeCategory === cat.name ? null : cat.name)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                    activeCategory === cat.name
                      ? 'bg-teal-500/15 text-teal-300 border-l-4 border-teal-500'
                      : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border-l-4 border-transparent'
                  }`}
                >
                  <span>🏷️</span>
                  <span className="truncate">{cat.name}</span>
                  {count > 0 && <span className="ml-auto text-slate-600 font-mono shrink-0">{count}</span>}
                </button>
              );
            })}
          </div>

          {/* Navigation links */}
          <div className="mt-6 pt-4 border-t border-slate-800/70 space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-3 px-2">Điều hướng</p>
            {[
              { path: '/microlearning/roadmap', label: '🗺️ Lộ trình học' },
              { path: '/leaderboard', label: '🏆 Bảng xếp hạng' },
              { path: '/store', label: '🛍️ Cửa hàng' },
              { path: '/students/manage', label: '👥 Học viên' },
              { path: '/admin/dashboard', label: '⚙️ Admin' },
            ].map(item => (
              <button
                key={item.path}
                onClick={() => window.location.pathname = item.path}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium text-slate-500 hover:bg-slate-800/40 hover:text-slate-300 transition-all duration-200 text-left"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* ---- Main ---- */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="border-b border-slate-800 px-8 py-5 bg-slate-950/80 backdrop-blur sticky top-0 z-40">
          <div className="max-w-3xl mx-auto">
            <div className="mb-5 text-center">
              <h1 className="text-2xl font-black tracking-tight text-white mb-1">
                📖 Tra cứu Từ Điển Tiếng Khmer
              </h1>
              <p className="text-xs text-slate-500">Khám phá từ vựng và biến thể phát âm theo vùng miền</p>
            </div>

            {/* Search bar */}
            <form onSubmit={handleSearch} className="relative">
              <div className="relative flex items-center">
                <div className="absolute left-5 text-slate-500 pointer-events-none">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  ref={inputRef}
                  type="text"
                  value={inputVal}
                  onChange={handleInput}
                  placeholder="Nhập từ cần tra cứu... (ví dụ: AngkorWat, Khmer, Phnom)"
                  className="w-full bg-slate-800/70 border border-slate-700/60 rounded-2xl pl-12 pr-32 py-4 text-base text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500/50 transition-all duration-200"
                />
                <div className="absolute right-3 flex items-center gap-2">
                  {inputVal && (
                    <button
                      type="button"
                      onClick={handleClear}
                      className="p-2 text-slate-500 hover:text-slate-300 transition-colors rounded-lg hover:bg-slate-700/50"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                  <button
                    type="submit"
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-bold rounded-xl transition-colors duration-200"
                  >
                    Tìm
                  </button>
                </div>
              </div>
            </form>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-3xl mx-auto space-y-6">

            {/* Stats bar */}
            {searched && (
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-3 w-3 border border-t-teal-400 border-slate-600 rounded-full animate-spin"></span>
                      Đang tìm kiếm...
                    </span>
                  ) : (
                    <>
                      Tìm thấy <span className="font-bold text-teal-400">{filteredEntries.length}</span> kết quả
                      {keyword && <> cho <span className="font-bold text-white">"{keyword}"</span></>}
                      {activeCategory && <> trong danh mục <span className="font-bold text-violet-400">"{activeCategory}"</span></>}
                    </>
                  )}
                </span>
                <span className="text-slate-600">Click vào từ để xem biến thể phát âm</span>
              </div>
            )}

            {/* Results */}
            {!loading && filteredEntries.length > 0 && (
              <div className="space-y-3">
                {filteredEntries.map((entry) => (
                  <EntryCard
                    key={entry.entry_id}
                    entry={entry}
                    isSelected={selectedId === entry.entry_id}
                    onSelect={setSelectedId}
                  />
                ))}
              </div>
            )}

            {/* Empty state */}
            {!loading && searched && filteredEntries.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 gap-4">
                <div className="h-24 w-24 rounded-3xl bg-slate-800/50 border border-slate-700/40 flex items-center justify-center text-4xl">
                  🔍
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-slate-400">Không tìm thấy từ nào</p>
                  <p className="text-sm text-slate-600 mt-1">
                    {keyword
                      ? `Thử tìm với từ khóa khác hoặc kiểm tra chính tả`
                      : 'Hệ thống chưa có dữ liệu từ điển'}
                  </p>
                </div>
                {keyword && (
                  <button
                    onClick={handleClear}
                    className="px-5 py-2 rounded-xl bg-teal-600/20 text-teal-400 border border-teal-500/30 text-sm font-semibold hover:bg-teal-600/30 transition-colors"
                  >
                    Xem tất cả từ vựng
                  </button>
                )}
              </div>
            )}

            {/* Initial loading */}
            {loading && (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="rounded-3xl border border-slate-700/40 bg-slate-900/40 p-6 animate-pulse">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-7 w-28 bg-slate-800 rounded-xl"></div>
                      <div className="h-5 w-20 bg-slate-800 rounded-full"></div>
                    </div>
                    <div className="h-4 w-3/4 bg-slate-800 rounded-lg"></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
