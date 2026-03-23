import * as cheerio from 'cheerio';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const deckCode = searchParams.get('code');

  if (!deckCode) {
    return Response.json({ error: 'Deck code is required' }, { status: 400 });
  }

  try {
    const response = await fetch(`https://www.pokemon-card.com/deck/result.html/deckID/${deckCode}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch deck: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Exact Map for Pokemon Card Official: PCGDECK.searchItemCardPict[38063]='/assets/...'
    const imgMap = {};
    const regex = /PCGDECK\.searchItemCardPict\[(\d+)\]\s*=\s*'([^']+)'/g;
    let match;
    while ((match = regex.exec(html)) !== null) {
        let path = match[2];
        // clean any accidental trailing slashes or fix duplicate slashes
        path = path.replace(/\/\//g, '/');
        imgMap[match[1]] = path;
    }

    const cards = [];

    // Extract all Hidden fields starting with deck_
    $('input[type="hidden"]').each((i, el) => {
      const name = $(el).attr('name') || '';
      if (name.startsWith('deck_') && name !== 'deck_id') {
        const val = $(el).attr('value') || $(el).val();
        if (val) {
          const cardEntries = val.split('-');
          cardEntries.forEach((entry) => {
            const parts = entry.split('_');
            if (parts.length >= 2) {
              const id = parts[0];
              const count = parseInt(parts[1], 10);
              
              if (id && count > 0 && !isNaN(count)) {
                let imgPath = imgMap[id];
                if (!imgPath) {
                   imgPath = `/assets/images/card_images/large/${id}.jpg`; // fallback
                }
                
                cards.push({
                  id,
                  count,
                  type: name.replace('deck_', ''),
                  imageUrl: imgPath.startsWith('http') ? imgPath : `https://www.pokemon-card.com${imgPath}`
                });
              }
            }
          });
        }
      }
    });

    if (cards.length === 0) {
      return Response.json({ error: 'Deck not found or empty', code: deckCode }, { status: 404 });
    }

    return Response.json({ code: deckCode, cards });

  } catch (err) {
    console.error(err);
    return Response.json({ error: 'Internal Server Error', message: err.message }, { status: 500 });
  }
}
