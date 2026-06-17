import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Book, X, ChevronDown, Play, MapPin } from 'lucide-react';
import AppLayout from '../components/AppLayout';
import { Card, Badge, PrimaryButton, GhostButton } from '../components/ui';
import EmptyState from '../components/EmptyState';
import { api } from '../api/client';

// ---- Helpers ----
const isYouTube = (url) => url && (url.includes('youtube.com') || url.includes('youtu.be'));
const isVideoFile = (url) => url && /\.(mp4|webm|ogg|mov)$/i.test(url);
const getYouTubeEmbedUrl = (url) => {
  if (!url) return '';
  const match = url.match(/(?:v=|youtu\.be\/)([^&?/]+)/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : url;
};

const REGION_META = {
  'Phnom Penh': { color: 'success',  label: 'Phnom Penh' },
  'Siem Reap':  { color: 'primary',  label: 'Siem Reap' },
  'Battambang': { color: 'warning',  label: 'Battambang' },
  'Kampot':     { color: 'primary',  label: 'Kampot' },
  'Kandal':     { color: 'danger',   label: 'Kandal' },
};

function VideoPlayer({ variation }) {
  const [expanded, setExpanded] = useState(false);
  if (!variation.video_url) return null;

  const region = REGION_META[variation.region] || { color: 'muted', label: variation.region || 'Không xác định' };

  return (
    <Card padding="p-0" className="overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-divider">
        <div className="flex items-center gap-2.5">
          <Badge color={region.color}>
            <span className="inline-flex items-center gap-1">
              <MapPin size={10} strokeWidth={2.5} />
              {region.label}
            </span>
          </Badge>
          {isYouTube(variation.video_url) && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">YouTube</span>
          )}
          {isVideoFile(variation.video_url) && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary-light text-primary border border-primary/30">Video</span>
          )}
        </div>
        <GhostButton
          size="sm"
          icon={expanded ? null : <Play size={12} strokeWidth={1.8} />}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Thu gọn' : 'Xem video'}
        </GhostButton>
      </div>

      {variation.description && (
        <p className="px-4 py-2 text-xs text-body italic border-b border-divider">{variation.description}</p>
      )}

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
            <video src={variation.video_url} controls className="w-full rounded-xl max-h-64 object-contain bg-black" />
          ) : (
            <a href={variation.video_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-xl bg-primary-light border border-primary/30 hover:bg-primary-light/70 transition-colors">
              <div className="h-10 w-10 rounded-lg bg-primary text-white flex items-center justify-center text-lg">↗</div>
              <div>
                <p className="text-sm font-semibold text-primary">Mở liên kết video</p>
                <p className="text-xs text-muted truncate max-w-xs">{variation.video_url}</p>
              </div>
            </a>
          )}
        </div>
      )}
    </Card>
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
      const res = await api.get(`/api/dictionary/entries/${entry.entry_id}/variations`);
      setVariations(res.data.variations || []);
    } catch { /* silent */ }
    finally { setLoadingVars(false); setVarLoaded(true); }
  }, [entry.entry_id, varLoaded]);

  return (
    <Card padding="p-0" className={`overflow-hidden cursor-pointer transition-colors ${isSelected ? 'border-primary' : ''}`}>
      <div className="px-6 py-5 flex items-start justify-between gap-4" onClick={() => { onSelect(entry.entry_id); if (!varLoaded) loadVariations(); }}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 mb-2 flex-wrap">
            <h3 className={`text-2xl font-bold tracking-tight ${isSelected ? 'text-primary' : 'text-heading'}`}>
              {entry.word}
            </h3>
            {entry.category_name && <Badge color="primary">{entry.category_name}</Badge>}
          </div>
          <p className="text-sm text-body leading-relaxed line-clamp-2">{entry.meaning}</p>
        </div>
        <div className={`shrink-0 h-9 w-9 rounded-xl flex items-center justify-center transition-all ${isSelected ? 'bg-primary text-white' : 'bg-base text-muted'}`}>
          <ChevronDown size={16} strokeWidth={2.5} className={`transition-transform ${isSelected ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {isSelected && (
        <div className="border-t border-divider px-6 py-5 space-y-4">
          <div className="bg-base rounded-2xl p-4 border border-divider">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2">Ý nghĩa đầy đủ</p>
            <p className="text-sm text-heading leading-relaxed">{entry.meaning}</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-divider"></div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted px-2">Biến thể phát âm theo vùng miền</p>
            <div className="h-px flex-1 bg-divider"></div>
          </div>

          {loadingVars ? (
            <div className="flex items-center gap-3 py-4 justify-center text-muted">
              <div className="h-5 w-5 border-2 border-t-primary border-divider rounded-full animate-spin"></div>
              <span className="text-xs">Đang tải biến thể phát âm...</span>
            </div>
          ) : variations.length > 0 ? (
            <div className="space-y-3">
              {variations.map((v) => <VideoPlayer key={v.variation_id} variation={v} />)}
            </div>
          ) : (
            <p className="py-6 text-center text-xs text-muted">Chưa có biến thể phát âm nào được thêm</p>
          )}
        </div>
      )}
    </Card>
  );
}

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

  useEffect(() => {
    api.get('/api/dictionary/categories').then((res) => setCategories(res.data || [])).catch(() => {});
    fetchEntries('');
  }, []);

  const fetchEntries = async (kw) => {
    setLoading(true); setSearched(true);
    try {
      const res = await api.get(`/api/dictionary/search?word=${encodeURIComponent(kw)}`);
      setEntries(res.data.entries || []);
      setSelectedId(null);
    } catch {
      setEntries([]);
    } finally { setLoading(false); }
  };

  const handleInput = (e) => {
    const val = e.target.value;
    setInputVal(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setKeyword(val); fetchEntries(val); }, 400);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    clearTimeout(debounceRef.current);
    setKeyword(inputVal);
    fetchEntries(inputVal);
  };

  const handleClear = () => {
    setInputVal(''); setKeyword(''); fetchEntries('');
    inputRef.current?.focus();
  };

  const filteredEntries = activeCategory
    ? entries.filter((e) => e.category_name === activeCategory)
    : entries;

  const primaryItems = [
    {
      id: 'all',
      label: 'Tất cả từ vựng',
      active: !activeCategory,
      onClick: () => setActiveCategory(null),
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 10h16M4 14h16M4 18h16" />,
    },
    ...categories.map((cat) => ({
      id: `cat-${cat.category_id}`,
      label: cat.name,
      active: activeCategory === cat.name,
      onClick: () => setActiveCategory(activeCategory === cat.name ? null : cat.name),
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 7h.01M7 3h5a1.99 1.99 0 011.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.99 1.99 0 013 12V7a4 4 0 014-4z" />,
    })),
  ];

  return (
    <AppLayout
      role="student"
      currentPath="/dictionary"
      title="Từ điển Ngôn ngữ Ký hiệu"
      subtitle="Tra cứu từ vựng và biến thể phát âm theo vùng miền"
      primaryItems={primaryItems}
      primaryLabel="Danh mục"
    >
      <div className="p-8 max-w-4xl mx-auto">
        <Card padding="p-4" className="mb-6">
          <form onSubmit={handleSearch} className="relative flex items-center">
            <Search size={18} strokeWidth={1.8} className="absolute left-4 text-muted pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={inputVal}
              onChange={handleInput}
              placeholder="Nhập từ cần tra cứu... (ví dụ: AngkorWat, Khmer, Phnom)"
              className="w-full bg-surface border border-divider rounded-xl pl-12 pr-32 py-3 text-sm text-heading placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            />
            <div className="absolute right-3 flex items-center gap-2">
              {inputVal && (
                <button type="button" onClick={handleClear} className="p-2 text-muted hover:text-heading transition-colors rounded-lg hover:bg-base">
                  <X size={14} strokeWidth={2} />
                </button>
              )}
              <PrimaryButton size="sm" type="submit">Tìm</PrimaryButton>
            </div>
          </form>
        </Card>

        {searched && (
          <div className="flex items-center justify-between mb-4 text-xs text-muted">
            <span>
              {loading ? 'Đang tìm kiếm...' : (
                <>
                  Tìm thấy <span className="font-bold text-primary">{filteredEntries.length}</span> kết quả
                  {keyword && <> cho <span className="font-bold text-heading">&ldquo;{keyword}&rdquo;</span></>}
                  {activeCategory && <> trong danh mục <span className="font-bold text-primary">&ldquo;{activeCategory}&rdquo;</span></>}
                </>
              )}
            </span>
            <span>Click vào từ để xem biến thể phát âm</span>
          </div>
        )}

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

        {!loading && searched && filteredEntries.length === 0 && (
          <Card>
            <EmptyState
              icon={<Book size={36} className="text-muted" />}
              title="Không tìm thấy từ nào"
              message={keyword ? 'Thử tìm với từ khóa khác hoặc kiểm tra chính tả.' : 'Hệ thống chưa có dữ liệu từ điển.'}
              action={keyword ? <PrimaryButton size="sm" onClick={handleClear}>Xem tất cả từ vựng</PrimaryButton> : null}
            />
          </Card>
        )}

        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <div className="h-7 w-28 bg-base rounded-xl mb-3"></div>
                <div className="h-4 w-3/4 bg-base rounded mb-2"></div>
                <div className="h-4 w-1/2 bg-base rounded"></div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
