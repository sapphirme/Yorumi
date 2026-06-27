import fs from 'fs';
import path from 'path';
import { AppError } from '../../core/errors/app-error';

const isElectron = !!process.env.ELECTRON_RUN_AS_NODE;
const resourcesPath = typeof (process as any).resourcesPath === 'string' && (process as any).resourcesPath
    ? (process as any).resourcesPath
    : '';
const avatarsDir = isElectron 
    ? path.join(resourcesPath || path.join(__dirname, '../../../'), 'avatars')
    : path.join(__dirname, '../../../avatars');

if (isElectron && !fs.existsSync(avatarsDir)) {
    try { fs.mkdirSync(avatarsDir, { recursive: true }); } catch (e) {}
}
const getFilesRecursively = (dir: string): string[] => {
    let results: string[] = [];
    if (!fs.existsSync(dir)) return results;
    
    const list = fs.readdirSync(dir);

    for (const file of list) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            results = results.concat(getFilesRecursively(filePath));
            continue;
        }

        if (/\.(png|jpg|jpeg|gif|webp)$/i.test(file)) {
            results.push(path.relative(avatarsDir, filePath).replace(/\\/g, '/'));
        }
    }

    return results;
};

export const avatarService = {
    directory: avatarsDir,
    getRandomAvatar() {
        const files = getFilesRecursively(avatarsDir);
        if (files.length === 0) {
            throw new AppError('No avatars found', 404);
        }

        const randomFile = files[Math.floor(Math.random() * files.length)];
        return { url: `/avatars/${randomFile}` };
    },
};
