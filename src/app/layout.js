import './globals.css';

export const metadata = {
  title: 'Pokemon Deck Editor',
  description: 'Manage and edit Pokemon Card Decks',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body>
        <header className="app-header glass-panel">
          <div className="container">
            <h1 className="title-gradient" style={{ margin: 0, fontSize: '1.5rem' }}>
              ポケカ デッキエディタ
            </h1>
            <nav style={{ display: 'flex', gap: '1rem' }}>
              {/* Future feature: My Decks */}
            </nav>
          </div>
        </header>
        <main className="container">
          {children}
        </main>
      </body>
    </html>
  );
}
