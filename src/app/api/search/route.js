export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('keyword');

  if (!keyword) {
    return Response.json({ error: 'Keyword is required' }, { status: 400 });
  }

  try {
    const queryParams = new URLSearchParams();
    queryParams.append('keyword', keyword);
    queryParams.append('regulation_sidebar_form', 'XY');
    queryParams.append('sm_and_keyword', 'true');

    // Use the official JSON API endpoint the frontend uses
    const response = await fetch(`https://www.pokemon-card.com/card-search/resultAPI.php?${queryParams.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch search results: ${response.statusText}`);
    }

    const json = await response.json();
    const results = [];
    
    if (json.cardList && Array.isArray(json.cardList)) {
      const seen = new Set();
      json.cardList.forEach(card => {
        if (!seen.has(card.cardID)) {
          seen.add(card.cardID);
          
          let imgPath = card.cardThumbFile;
          if (imgPath) {
              imgPath = imgPath.replace(/\/\//g, '/'); // cleanup duplicate slashes if any
          }
          
          results.push({
            id: card.cardID,
            name: card.cardNameAltText || card.cardNameViewText || `Card ${card.cardID}`,
            imageUrl: imgPath ? `https://www.pokemon-card.com${imgPath}` : `/assets/images/card_images/large/${card.cardID}.jpg`
          });
        }
      });
    }

    return Response.json({ results });

  } catch (err) {
    console.error(err);
    return Response.json({ error: 'Internal Server Error', message: err.message }, { status: 500 });
  }
}
