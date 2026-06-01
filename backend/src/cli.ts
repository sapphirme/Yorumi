#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import axios from 'axios';
import { AnimePaheScraper } from './scraper/animepahe.js';

type CliOptions = {
    download: boolean;
    title: string;
    episode: number;
    outputDir: string;
    quality: string;
    audio: 'sub' | 'dub';
    yes: boolean;
};

const HELP = `
Yorumi CLI

Usage:
  yorumi-cli download anime "Frieren" -e 1
  yorumi-cli download-anime "Frieren" --episode 1
  yorumi-cli -d "Frieren" -e 1
  yorumi-cli --download "One Piece" --episode 1089 --quality 720 --dub

Commands:
  download anime <title>   Search and download an anime episode
  download-anime <title>   Alias for "download anime"

Options:
  -d, --download <title>   Search and download an anime episode
  -e, --episode <number>   Episode number to download (default: 1)
  -o, --output <dir>       Output directory (default: downloads)
  -q, --quality <height>   Preferred quality, e.g. 1080, 720 (default: best)
      --dub                Prefer dubbed audio
      --sub                Prefer subbed audio (default)
  -y, --yes                Use the best search match without prompting
  -h, --help               Show this help
`;

const parseArgs = (argv: string[]): CliOptions => {
    const options: CliOptions = {
        download: false,
        title: '',
        episode: 1,
        outputDir: 'downloads',
        quality: 'best',
        audio: 'sub',
        yes: false,
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        const next = argv[index + 1];
        const third = argv[index + 2];

        if (arg === '-h' || arg === '--help') {
            console.log(HELP.trim());
            process.exit(0);
        }

        if (arg === 'download-anime') {
            options.download = true;
            if (next && !next.startsWith('-')) {
                options.title = next;
                index += 1;
            }
            continue;
        }

        if (arg === 'download' && next === 'anime') {
            options.download = true;
            if (third && !third.startsWith('-')) {
                options.title = third;
                index += 2;
            } else {
                index += 1;
            }
            continue;
        }

        if (arg === '-d' || arg === '--download') {
            options.download = true;
            if (next && !next.startsWith('-')) {
                options.title = next;
                index += 1;
            }
            continue;
        }

        if (arg === '-e' || arg === '--episode') {
            options.episode = Number(next || 1) || 1;
            index += 1;
            continue;
        }

        if (arg === '-o' || arg === '--output') {
            options.outputDir = next || options.outputDir;
            index += 1;
            continue;
        }

        if (arg === '-q' || arg === '--quality') {
            options.quality = next || options.quality;
            index += 1;
            continue;
        }

        if (arg === '--dub') {
            options.audio = 'dub';
            continue;
        }

        if (arg === '--sub') {
            options.audio = 'sub';
            continue;
        }

        if (arg === '-y' || arg === '--yes') {
            options.yes = true;
            continue;
        }

        if (!arg.startsWith('-') && !options.title) {
            options.title = arg;
        }
    }

    return options;
};

const sanitizeFilePart = (value: string) =>
    String(value || 'anime')
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 120) || 'anime';

const getQualityNumber = (value: unknown) => Number(String(value || '').replace(/[^\d]/g, '')) || 0;

const scoreStream = (stream: any, options: CliOptions) => {
    const quality = getQualityNumber(stream?.quality);
    const preferredQuality = options.quality === 'best' ? 0 : getQualityNumber(options.quality);
    const audio = String(stream?.audio || '').toLowerCase().includes('dub') ? 'dub' : 'sub';
    const audioScore = audio === options.audio ? 100_000 : 0;
    const directScore = stream?.directUrl ? 10_000 : 0;

    if (preferredQuality > 0) {
        return audioScore + directScore - Math.abs(preferredQuality - quality);
    }

    return audioScore + directScore + quality;
};

const runFfmpeg = (inputUrl: string, outputPath: string) => new Promise<void>((resolve, reject) => {
    const args = [
        '-y',
        '-headers',
        'User-Agent: Mozilla/5.0\r\nReferer: https://animepahe.pw/\r\n',
        '-i',
        inputUrl,
        '-c',
        'copy',
        '-bsf:a',
        'aac_adtstoasc',
        outputPath,
    ];
    const child = spawn('ffmpeg', args, { stdio: 'inherit' });

    child.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') {
            reject(new Error('ffmpeg was not found. Install ffmpeg and make sure it is available on PATH.'));
            return;
        }
        reject(error);
    });
    child.on('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg exited with code ${code}`));
    });
});

const downloadFile = async (inputUrl: string, outputPath: string) => {
    const response = await axios.get(inputUrl, {
        responseType: 'stream',
        timeout: 30000,
        headers: {
            'User-Agent': 'Mozilla/5.0',
            Referer: 'https://animepahe.pw/',
        },
    });

    await pipeline(response.data, createWriteStream(outputPath));
};

const downloadAnime = async (options: CliOptions) => {
    if (!options.title) {
        throw new Error('Missing anime title. Example: yorumi-cli download anime "Frieren" -e 1');
    }

    const scraper = new AnimePaheScraper();

    try {
        console.log(`Searching for "${options.title}"...`);
        const results = await scraper.search(options.title);
        const anime = Array.isArray(results) ? results[0] : null;
        if (!anime) throw new Error(`No anime found for "${options.title}"`);

        const animeSession = String(anime.session || anime.id || '').trim();
        const animeTitle = String(anime.title || options.title).trim();
        console.log(`Selected: ${animeTitle}`);

        const episodePayload = await scraper.getEpisodes(animeSession);
        const episodes = Array.isArray(episodePayload?.episodes) ? episodePayload.episodes : [];
        const episode = episodes.find((item: any) => Number(item?.episodeNumber) === options.episode);
        if (!episode) throw new Error(`Episode ${options.episode} was not found for "${animeTitle}"`);

        console.log(`Resolving episode ${options.episode} stream...`);
        const episodeSession = String(episode.session || episode.id || '');
        const streams = await scraper.getLinks(animeSession, episodeSession);
        const stream = (Array.isArray(streams) ? streams : []).sort((a, b) => scoreStream(b, options) - scoreStream(a, options))[0];
        if (!stream) throw new Error('No downloadable stream was found for this episode');

        const inputUrl = String(stream.directUrl || await scraper.resolveStreamUrl(stream) || stream.url || '').trim();
        if (!inputUrl) throw new Error('The selected stream did not include a playable URL');

        const extension = /\.m3u8(?:[?#]|$)/i.test(inputUrl) || stream.isHls ? 'mp4' : path.extname(new URL(inputUrl).pathname).replace('.', '') || 'mp4';
        const outputDir = path.resolve(options.outputDir);
        await mkdir(outputDir, { recursive: true });
        const outputPath = path.join(outputDir, `${sanitizeFilePart(animeTitle)} - E${String(options.episode).padStart(2, '0')}.${extension}`);

        try {
            await stat(outputPath);
            if (!options.yes) {
                throw new Error(`Output already exists: ${outputPath}. Re-run with -y to overwrite.`);
            }
        } catch (error: any) {
            if (error?.code !== 'ENOENT') throw error;
        }

        console.log(`Downloading to ${outputPath}`);
        if (/\.m3u8(?:[?#]|$)/i.test(inputUrl) || stream.isHls) {
            await runFfmpeg(inputUrl, outputPath);
        } else {
            await downloadFile(inputUrl, outputPath);
        }

        console.log('Download complete.');
    } finally {
        await scraper.close();
    }
};

const main = async () => {
    const options = parseArgs(process.argv.slice(2));
    if (!options.download) {
        console.log(HELP.trim());
        return;
    }

    await downloadAnime(options);
};

main()
    .then(() => {
        process.exit(0);
    })
    .catch((error) => {
        console.error(`Error: ${error?.message || error}`);
        process.exit(1);
    });
