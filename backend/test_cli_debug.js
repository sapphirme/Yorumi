// Debug script to test AllManga episode sources resolution
const ALLMANGA_API = 'https://api.allanime.day/api';
const ALLMANGA_REFERER = 'https://allmanga.to';
const ALLMANGA_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0';
const EPISODE_GQL = `query($showId:String! $translationType:VaildTranslationTypeEnumType! $episodeString:String!){episode(showId:$showId translationType:$translationType episodeString:$episodeString){episodeString sourceUrls}}`;
const EPISODE_QUERY_HASH = 'd405d0edd690624b66baba3068e0edc3ac90f1597d898a1ec8db4e5c43c00fec';

const HEX_MAP = {
  79: 'A', '7a': 'B', '7b': 'C', '7c': 'D', '7d': 'E', '7e': 'F', '7f': 'G', 70: 'H', 71: 'I', 72: 'J',
  73: 'K', 74: 'L', 75: 'M', 76: 'N', 77: 'O', 68: 'P', 69: 'Q', '6a': 'R', '6b': 'S', '6c': 'T',
  '6d': 'U', '6e': 'V', '6f': 'W', 60: 'X', 61: 'Y', 62: 'Z', 59: 'a', '5a': 'b', '5b': 'c',
  '5c': 'd', '5d': 'e', '5e': 'f', '5f': 'g', 50: 'h', 51: 'i', 52: 'j', 53: 'k', 54: 'l',
  55: 'm', 56: 'n', 57: 'o', 48: 'p', 49: 'q', '4a': 'r', '4b': 's', '4c': 't', '4d': 'u',
  '4e': 'v', '4f': 'w', 40: 'x', 41: 'y', 42: 'z', '08': '0', '09': '1', '0a': '2', '0b': '3',
  '0c': '4', '0d': '5', '0e': '6', '0f': '7', '00': '8', '01': '9', 15: '-', 16: '.', 67: '_',
  46: '~', '02': ':', 17: '/', '07': '?', '1b': '#', 63: '[', 65: ']', 78: '@', 19: '!', '1c': '$',
  '1e': '&', 10: '(', 11: ')', 12: '*', 13: '+', 14: ',', '03': ';', '05': '=', '1d': '%',
};

function decodeAmUrl(encoded) {
  const clean = encoded.startsWith('--') ? encoded.slice(2) : encoded;
  let result = '';
  for (let i = 0; i < clean.length; i += 2) {
    const pair = clean.slice(i, i + 2);
    result += HEX_MAP[pair] ?? pair;
  }
  return result.replace(/\\u002F/gi, '/').replace(/\\\|/g, '');
}

async function test() {
  const showId = 'qpeexkeTa7DzLjRnp'; // Frieren Season 2
  
  // Try persisted query GET
  const params = new URLSearchParams({
    variables: JSON.stringify({ showId, translationType: 'sub', episodeString: '1' }),
    extensions: JSON.stringify({ persistedQuery: { version: 1, sha256Hash: EPISODE_QUERY_HASH } }),
  });
  
  console.log('--- GET (persisted query) ---');
  try {
    const getRes = await fetch(`${ALLMANGA_API}?${params.toString()}`, {
      headers: { 'User-Agent': ALLMANGA_UA, Referer: ALLMANGA_REFERER, Origin: 'https://youtu-chan.com' },
    });
    console.log('GET status:', getRes.status);
    const getData = await getRes.json();
    console.log('GET data keys:', Object.keys(getData));
    if (getData.data?.episode?.sourceUrls) {
      console.log('Sources found:', getData.data.episode.sourceUrls.length);
      for (const src of getData.data.episode.sourceUrls) {
        const url = String(src.sourceUrl || '');
        const decoded = url.startsWith('--') ? decodeAmUrl(url).slice(0, 80) : url.slice(0, 80);
        console.log(`  ${src.sourceName} (priority ${src.priority}): ${decoded}...`);
      }
    } else {
      console.log('No sourceUrls in GET response');
      console.log('Response preview:', JSON.stringify(getData).slice(0, 300));
    }
  } catch (e) {
    console.log('GET error:', e.message);
  }
  
  console.log('\n--- POST (full query) ---');
  try {
    const postRes = await fetch(ALLMANGA_API, {
      method: 'POST',
      headers: { 'User-Agent': ALLMANGA_UA, Referer: ALLMANGA_REFERER, Origin: ALLMANGA_REFERER, Accept: '*/*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ variables: { showId, translationType: 'sub', episodeString: '1' }, query: EPISODE_GQL }),
    });
    console.log('POST status:', postRes.status);
    const postData = await postRes.json();
    if (postData.data?.episode?.sourceUrls) {
      console.log('Sources found:', postData.data.episode.sourceUrls.length);
      for (const src of postData.data.episode.sourceUrls) {
        const url = String(src.sourceUrl || '');
        const decoded = url.startsWith('--') ? decodeAmUrl(url).slice(0, 80) : url.slice(0, 80);
        console.log(`  ${src.sourceName} (priority ${src.priority}): ${decoded}...`);
      }
    } else {
      console.log('No sourceUrls in POST response');
      console.log('Response preview:', JSON.stringify(postData).slice(0, 300));
    }
  } catch (e) {
    console.log('POST error:', e.message);
  }
}

test();
