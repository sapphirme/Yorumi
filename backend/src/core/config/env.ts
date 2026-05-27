import dotenv from 'dotenv';
import path from 'node:path';

const cwd = process.cwd();

dotenv.config({ path: path.resolve(cwd, '.env') });
dotenv.config({ path: path.resolve(cwd, 'backend', '.env') });
