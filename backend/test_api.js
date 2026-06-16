const axios = require('axios');

const SEARCH_GQL = `query($search:SearchInput $limit:Int $page:Int $translationType:VaildTranslationTypeEnumType $countryOrigin:VaildCountryOriginEnumType){shows(search:$search limit:$limit page:$page translationType:$translationType countryOrigin:$countryOrigin){edges{_id name availableEpisodes __typename}}}`;

const REFERERS = [
    'https://allanimenews.com',
    'https://allmanga.to',
    'https://allanime.to',
    'https://youtu-chan.com',
];

async function test() {
    for (const referer of REFERERS) {
        console.log(`\n--- Testing Referer: ${referer} ---`);
        try {
            const res = await axios.post('https://api.allanime.day/api', {
                variables: {
                    search: { allowAdult: true, allowUnknown: false, query: 'frieren' },
                    limit: 5,
                    page: 1,
                    translationType: 'sub',
                    countryOrigin: 'ALL',
                },
                query: SEARCH_GQL,
            }, {
                timeout: 12000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
                    Referer: referer,
                    Origin: referer,
                    Accept: '*/*',
                    'Content-Type': 'application/json',
                },
            });
            console.log('Status:', res.status);
            console.log('Data:', JSON.stringify(res.data).slice(0, 400));
        } catch (e) {
            console.log('Error:', e.response?.status, JSON.stringify(e.response?.data || e.message).slice(0, 300));
        }
    }
}

test();
