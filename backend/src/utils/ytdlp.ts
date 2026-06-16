import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function extractNativeHlsWithYtDlp(url: string): Promise<string | null> {
    if (!url || !/^https?:\/\//i.test(url)) return null;

    try {
        const { stdout } = await execAsync(`yt-dlp -g --no-warnings "${url}"`, { timeout: 15000 });
        const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
        const streamUrl = lines[lines.length - 1]; // usually the best quality or master playlist
        
        if (streamUrl && /^https?:\/\//i.test(streamUrl)) {
            return streamUrl;
        }
        return null;
    } catch (error) {
        console.warn(`[yt-dlp] Failed to extract stream for ${url}:`, error instanceof Error ? error.message : String(error));
        return null;
    }
}
