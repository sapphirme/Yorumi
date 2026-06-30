import { Router } from 'express';
import axios from 'axios';

const router = Router();

/**
 * Image Proxy to bypass hotlinking protection (Referer checks)
 * GET /api/image/proxy?url=HTTPS_URL
 */
router.get('/proxy', async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== 'string') {
        return res.status(400).send('URL is required');
    }

    try {
        const decodedUrl = decodeURIComponent(url);
        
        // Anti-abuse check: only allow images from known domains or relative to scraper BASE_URLs
        const allowedDomains = ['mangakatana.com', 's4.anilist.co', 'media.kitsu.io', 'allanime.day', 'allmanga.to', 'wp.youtube-anime.com'];
        const urlObj = new URL(decodedUrl);
        
        if (!allowedDomains.includes(urlObj.hostname) && !urlObj.hostname.endsWith('mangakatana.com')) {
           // We'll allow it for now but log it
           console.log(`[Image Proxy] Proxying non-allowlisted domain: ${urlObj.hostname}`);
        }

        let referer = urlObj.origin;
        let origin = urlObj.origin;

        if (urlObj.hostname.includes('allanime') || urlObj.hostname.includes('youtube-anime')) {
            referer = 'https://allmanga.to/';
            origin = 'https://allmanga.to';
        } else if (urlObj.hostname.includes('tnlycdn.com') || urlObj.hostname.includes('toonily.com')) {
            referer = 'https://toonily.com/';
            origin = 'https://toonily.com';
        } else if (urlObj.hostname.includes('hanime-cdn')) {
            referer = 'https://hanime.tv/';
            origin = 'https://hanime.tv';
        } else if (urlObj.hostname.includes('manread.xyz') || urlObj.hostname.includes('mancover.xyz') || urlObj.hostname.includes('manhwaread.com')) {
            referer = 'https://manhwaread.com/';
            origin = 'https://manhwaread.com';
        }

        const response = await axios.get(decodedUrl, {
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Referer': referer,
                'Origin': origin,
            },
            timeout: 10000,
        });

        res.set('Content-Type', response.headers['content-type'] || 'image/jpeg');
        res.set('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
        res.send(Buffer.from(response.data));
    } catch (error: any) {
        console.error('[Image Proxy] Error:', error.message);
        res.status(500).send('Failed to proxy image');
    }
});

export default router;
