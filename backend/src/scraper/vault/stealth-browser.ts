import puppeteer from 'puppeteer-extra';
// @ts-ignore
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use((StealthPlugin as any)());

export default puppeteer;
