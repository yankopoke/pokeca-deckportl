'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

export default function Home() {
  const [deckCode, setDeckCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Current deck state
  const [deck, setDeck] = useState([]);
  const [deckName, setDeckName] = useState('新規デッキ');
  
  // UI State
  const [showManager, setShowManager] = useState(true);

  // Search state
  const [keyword, setKeyword] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');

  // Saved decks state
  const [savedDecks, setSavedDecks] = useState([]);

  // Load saved decks on mount
  useEffect(() => {
    const stored = localStorage.getItem('pokeca_decks');
    if (stored) {
      try {
        setSavedDecks(JSON.parse(stored));
      } catch (err) {
        console.error('Failed to parse saved decks', err);
      }
    }
  }, []);

  // Save to locale storage whenever savedDecks change
  useEffect(() => {
    localStorage.setItem('pokeca_decks', JSON.stringify(savedDecks));
  }, [savedDecks]);

  const totalCards = deck.reduce((acc, card) => acc + card.count, 0);

  // Extract deck code from deck name (only available for imported decks)
  const extractDeckCode = () => {
    if (deckName.startsWith('インポート: ')) {
      return deckName.replace('インポート: ', '');
    }
    return null;
  };

  const openHitorimawashi = () => {
    // Flatten deck for simulation (count -> individual entries)
    const flatDeck = [];
    deck.forEach(card => {
      for (let i = 0; i < card.count; i++) {
        flatDeck.push({
          id: card.id,
          name: card.name || "",
          url: card.imageUrl
        });
      }
    });

    if (flatDeck.length > 0) {
      localStorage.setItem('pokeca_preview_deck', JSON.stringify(flatDeck));
      window.open(`/simulation?source=local`, '_blank');
    }
  };

  // Sort order definition
  const SORT_ORDER = [
    'ポケモン',
    'グッズ',
    'ポケモンのどうぐ',
    'サポート',
    'スタジアム',
    'エネルギー',
    'その他'
  ];

  const sortDeck = (cards) => {
    return [...cards].sort((a, b) => {
      const posA = SORT_ORDER.indexOf(a.type) >= 0 ? SORT_ORDER.indexOf(a.type) : 999;
      const posB = SORT_ORDER.indexOf(b.type) >= 0 ? SORT_ORDER.indexOf(b.type) : 999;
      return posA - posB;
    });
  };

  // 1. Fetch official deck
  const fetchDeck = async (e) => {
    e.preventDefault();
    if (!deckCode.trim()) return;

    // Check if the deck exists locally
    const expectedName = `インポート: ${deckCode}`;
    const localDeck = savedDecks.find(d => d.name === expectedName);
    if (localDeck) {
      if (confirm(`ローカルに保存された "${expectedName}" の編集データがあります。こちらを読み込みますか？\n（キャンセルを押すと、公式から再取得して上書きします）`)) {
        loadDeck(localDeck);
        return;
      }
    }

    setLoading(true);
    setError('');
    
    try {
      const res = await fetch(`/api/deck?code=${encodeURIComponent(deckCode)}`);
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load deck');
      }
      
      setDeck(data.cards);
      setDeckName(`インポート: ${deckCode}`);
      setLoading(false);
      // Removed auto-collapse here to allow further management
    } catch (err) {
      setError('デッキの取得に失敗しました: ' + err.message);
      setLoading(false);
    }
  };

  // 2. Search cards
  const searchCards = async (e) => {
    if (e) e.preventDefault();
    if (!keyword.trim()) return;

    setSearchLoading(true);
    setSearchError('');
    setSearchResults([]);

    try {
      const res = await fetch(`/api/search?keyword=${encodeURIComponent(keyword)}`);
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Search failed');
      }

      setSearchResults(data.results);
      setSearchLoading(false);
    } catch (err) {
      setSearchError('検索に失敗しました: ' + err.message);
      setSearchLoading(false);
    }
  };

  // 3. Deck modifications
  const updateCardCount = (card, delta) => {
    setDeck(prev => {
      const existing = prev.find(c => c.id === card.id);
      let updated;
      if (existing) {
        const newCount = existing.count + delta;
        if (newCount <= 0) {
          updated = prev.filter(c => c.id !== card.id); // Remove card completely
        } else {
          updated = prev.map(c => c.id === card.id ? { ...c, count: newCount } : c);
        }
      } else if (delta > 0) {
        // Add new card
        updated = [...prev, { ...card, count: 1 }];
      } else {
        return prev;
      }
      return sortDeck(updated);
    });
  };

  const handleAddFromSearch = async (card) => {
    const existing = deck.find(c => c.id === card.id);
    if (existing) {
      updateCardCount(card, 1);
      return;
    }
    
    // Add provisionally
    const tempCard = { ...card, type: '読込中...', count: 1 };
    setDeck(prev => [...prev, tempCard]);

    try {
      const res = await fetch(`/api/card-type?id=${card.id}`);
      const data = await res.json();
      const actualType = data.type || 'その他';

      setDeck(prev => {
        const updated = prev.map(c => c.id === card.id ? { ...c, type: actualType } : c);
        return sortDeck(updated);
      });
    } catch (e) {
      console.error(e);
      setDeck(prev => {
        const updated = prev.map(c => c.id === card.id ? { ...c, type: 'その他' } : c);
        return sortDeck(updated);
      });
    }
  };

  const removeCard = (id) => {
    setDeck(prev => prev.filter(c => c.id !== id));
  };

  // 4. Save/Load Decks
  const saveCurrentDeck = () => {
    if (deck.length === 0) return alert('デッキが空です。');
    
    const newSaved = {
      id: Date.now().toString(),
      name: deckName,
      cards: deck,
      updatedAt: new Date().toISOString()
    };
    
    const existingIndex = savedDecks.findIndex(d => d.name === deckName);
    if (existingIndex >= 0 && confirm(`"${deckName}" を上書きしますか？`)) {
      const updated = [...savedDecks];
      updated[existingIndex] = { ...newSaved, id: updated[existingIndex].id };
      setSavedDecks(updated);
    } else {
      setSavedDecks([...savedDecks, newSaved]);
    }
    
    // Auto collapse removed here
    alert('保存完了しました！');
  };

  const loadDeck = (savedDeck) => {
    setDeck(savedDeck.cards);
    setDeckName(savedDeck.name);
    // setShowManager(false); // Removed auto-collapse on selection
  };

  const deleteSavedDeck = (id) => {
    if (confirm('本当に削除しますか？')) {
      setSavedDecks(prev => prev.filter(d => d.id !== id));
    }
  };

  // Styles
  const scrollbarStyle = {
    flex: 1, 
    overflowY: 'auto', 
    paddingRight: '1rem', 
    marginTop: '1rem'
  };

  return (
    <div className="home-container" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 100px)' }}>
      
      {/* Toggle Button for Manager */}
      <div style={{ marginBottom: showManager ? '1rem' : '0.5rem', display: 'flex', justifyContent: 'flex-end' }}>
        <button 
          onClick={() => setShowManager(!showManager)}
          style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid var(--border-color)', padding: '0.4rem 1rem', fontSize: '0.9rem' }}
        >
          {showManager ? '▲ デッキ管理・保存を閉じる' : '▼ デッキコードの読込・保存済みデッキ一覧を見る'}
        </button>
      </div>

      {/* Top Section: Loading & Saving (Collapsible) */}
      {showManager && (
        <section className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1rem', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h2 style={{ fontSize: '1.2rem', margin: 0 }}>保存済みデッキ ({savedDecks.length})</h2>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>デッキコード読込:</span>
              <form onSubmit={fetchDeck} className="compact-form">
                <input
                  type="text"
                  placeholder="例: 8Ycc8D-XXX"
                  value={deckCode}
                  onChange={(e) => setDeckCode(e.target.value)}
                  disabled={loading}
                  style={{ width: '180px' }}
                />
                <button type="submit" disabled={loading || !deckCode.trim()}>
                  {loading ? <span className="loader" style={{ width: '14px', height: '14px' }}></span> : '読込'}
                </button>
              </form>
            </div>
          </div>

          {error && <p style={{ color: 'var(--danger)', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</p>}

          {savedDecks.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>保存されたデッキはありません。</p>
          ) : (
            <div style={{ maxHeight: '300px', overflowY: 'auto', paddingRight: '0.5rem' }}>
              <div className="saved-decks-grid">
                {[...savedDecks].reverse().map(d => (
                  <div key={d.id} className="saved-deck-item" onClick={() => loadDeck(d)}>
                    <div className="saved-deck-info">
                      <div className="saved-deck-name" title={d.name}>{d.name}</div>
                      <div className="saved-deck-meta">
                        {d.cards.reduce((acc, c)=>acc+c.count, 0)}枚 · {new Date(d.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <button 
                      className="delete-btn-sm" 
                      title="削除"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSavedDeck(d.id);
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Main Workspace (Takes remaining full height) */}
      <div style={{ display: 'flex', gap: '1rem', flex: 1, minHeight: 0 }}>
        
        {/* Left: Current Deck Editor */}
        <section className="glass-panel" style={{ flex: 3, padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          {/* Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <input 
                type="text" 
                value={deckName} 
                onChange={e => setDeckName(e.target.value)}
                style={{ fontSize: '1.3rem', fontWeight: 'bold', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', padding: '0.4rem 0.8rem', color: 'white', display: 'inline-block', width: '300px' }}
              />
              <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: totalCards === 60 ? 'var(--success)' : totalCards > 60 ? 'var(--danger)' : 'var(--text-muted)' }}>
                合計: {totalCards} / 60 枚
              </span>
            </div>
            <button onClick={saveCurrentDeck}>デッキを保存</button>
              <button
                className="accent"
                onClick={openHitorimawashi}
                disabled={deck.length === 0}
                title={deck.length > 0 ? '1人回しツールで現在のデッキを練習する' : 'カードをデッキに追加してください'}
              >
                🎮 1人回し
              </button>
          </div>

          {/* Scrollable Card Grid */}
          <div style={scrollbarStyle}>
            {deck.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
                カードがありません。デッキコードを読み込むか、検索して追加してください。
              </div>
            ) : (
              <div className="deck-grid" style={{ marginTop: '0' }}>
                {deck.map(card => (
                  <div key={card.id} className="card-item">
                    <div className="card-image-wrap">
                      <Image src={card.imageUrl} alt={card.name || card.id} fill style={{ objectFit: 'contain' }} unoptimized />
                    </div>
                    <div className="card-controls">
                      <button className="qty-btn" onClick={() => updateCardCount(card, -1)}>-</button>
                      <span className="card-qty">{card.count}</span>
                      <button className="qty-btn" onClick={() => updateCardCount(card, 1)}>+</button>
                      <button className="qty-btn" style={{ marginLeft: 'auto', color: 'var(--danger)', background: 'transparent' }} onClick={() => removeCard(card.id)}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Right: Card Search Sidebar */}
        <section className="glass-panel" style={{ flex: 1, minWidth: '350px', maxWidth: '450px', padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1.2rem', margin: 0, flexShrink: 0 }}>カード検索・追加</h3>
          <form onSubmit={searchCards} style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexShrink: 0 }}>
            <input
              type="text"
              placeholder="カード名"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              disabled={searchLoading}
            />
            <button type="submit" disabled={searchLoading || !keyword.trim()}>
              {searchLoading ? <span className="loader" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></span> : '検索'}
            </button>
          </form>
          {searchError && <p style={{ color: 'var(--danger)', marginTop: '0.5rem', fontSize: '0.9rem', flexShrink: 0 }}>{searchError}</p>}
          
          {/* Scrollable Search Results */}
          <div style={scrollbarStyle}>
            {searchResults.length === 0 && !searchLoading && !searchError ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '2rem' }}>キーワードを入力して検索してください</p>
            ) : null}
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {searchResults.map(card => (
                <div key={card.id} style={{ display: 'flex', gap: '1rem', background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '8px' }}>
                  <div style={{ position: 'relative', width: '70px', height: '98px', flexShrink: 0, background: 'rgba(0,0,0,0.5)', borderRadius: '4px' }}>
                    <Image src={card.imageUrl} alt={card.name} fill style={{ objectFit: 'contain' }} unoptimized />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1 }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 'bold', lineHeight: 1.2, marginBottom: '0.5rem' }}>{card.name}</span>
                    <button 
                      style={{ padding: '0.4rem', fontSize: '0.8rem', background: 'var(--primary)', border: 'none', opacity: deck.some(c=>c.id===card.id&&c.type==='読込中...') ? 0.5 : 1 }}
                      onClick={() => handleAddFromSearch(card)}
                      disabled={deck.some(c=>c.id===card.id&&c.type==='読込中...')}
                    >
                      {deck.some(c=>c.id===card.id&&c.type==='読込中...') ? '追加中...' : 'デッキに追加'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
