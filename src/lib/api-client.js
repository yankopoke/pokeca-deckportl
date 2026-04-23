/**
 * Next.js APIルート経由で外部APIを呼び出すためのユーティリティ
 * CORSを回避するため、すべてのリクエストはサーバーサイドのAPIルートを経由する
 */

export const apiClient = {
  /**
   * デッキコードからカードリストを取得 (/api/deck)
   */
  async fetchDeck(deckCode) {
    if (!deckCode) throw new Error('デッキコードが必要です');

    const response = await fetch(`/api/deck?code=${encodeURIComponent(deckCode)}`);
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || `デッキの取得に失敗しました: ${response.statusText}`);
    }

    return await response.json();
  },

  /**
   * キーワードでカードを検索 (/api/search)
   */
  async searchCards(keyword) {
    if (!keyword) throw new Error('キーワードが必要です');

    const response = await fetch(`/api/search?keyword=${encodeURIComponent(keyword)}`);
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || `検索に失敗しました: ${response.statusText}`);
    }

    return await response.json();
  },

  /**
   * カードの詳細（タイプ）を取得 (/api/card-type)
   */
  async getCardType(cardId) {
    if (!cardId) throw new Error('カードIDが必要です');

    const response = await fetch(`/api/card-type?id=${encodeURIComponent(cardId)}`);
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || `詳細の取得に失敗しました: ${response.statusText}`);
    }

    return await response.json();
  },

  /**
   * プロキシ経由で外部データを取得 (/api/proxy)
   */
  async fetchProxy(id) {
    if (!id) throw new Error('IDが必要です');
    const response = await fetch(`/api/proxy?id=${encodeURIComponent(id)}`);
    if (!response.ok) {
      throw new Error('フェッチに失敗しました');
    }
    return await response.json();
  }
};
