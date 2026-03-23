import * as cheerio from 'cheerio';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return Response.json({ error: 'Card ID is required' }, { status: 400 });
  }

  try {
    const url = `https://www.pokemon-card.com/card-search/details.php/card/${id}/`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch card details: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    
    let type = 'その他';
    const headerText = $('.RightBox').find('.Heading1, h1, .Label, .Type, .KindOf').text().trim().replace(/\s+/g, ' ');

    if (headerText.includes('ポケモン')) {
        type = 'ポケモン';
    } else if (headerText.includes('サポート')) {
        type = 'サポート';
    } else if (headerText.includes('ポケモンのどうぐ')) {
        type = 'ポケモンのどうぐ';
    } else if (headerText.includes('グッズ')) {
        type = 'グッズ';
    } else if (headerText.includes('スタジアム')) {
        type = 'スタジアム';
    } else if (headerText.includes('エネルギー')) {
        type = 'エネルギー';
    } else if (headerText.includes('トレーナーズ')) {
        type = 'グッズ'; // fallback
    }

    return Response.json({ id, type });

  } catch (err) {
    console.error(err);
    return Response.json({ error: 'Internal Server Error', message: err.message }, { status: 500 });
  }
}
