import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, RefreshCw, X, AlertCircle } from 'lucide-react';

export default function OTAUpdateModal() {
    const [status, setStatus] = useState<'idle' | 'available' | 'downloading' | 'downloaded' | 'error'>('idle');
    const [updateInfo, setUpdateInfo] = useState<any>(null);
    const [progress, setProgress] = useState<{ percent: number, bytesPerSecond: number } | null>(null);
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        if (!(window as any).electron) return;

        const handleAvailable = (_: any, info: any) => {
            setUpdateInfo(info);
            setStatus('available');
        };

        const handleProgress = (_: any, progObj: any) => {
            setProgress(progObj);
            setStatus('downloading');
        };

        const handleDownloaded = () => {
            setStatus('downloaded');
        };

        const handleError = (_: any, err: string) => {
            setErrorMsg(err);
            setStatus('error');
        };

        (window as any).electron.ipcRenderer.on('update-available', handleAvailable);
        (window as any).electron.ipcRenderer.on('update-progress', handleProgress);
        (window as any).electron.ipcRenderer.on('update-downloaded', handleDownloaded);
        (window as any).electron.ipcRenderer.on('update-error', handleError);

        return () => {
            (window as any).electron.ipcRenderer.removeAllListeners('update-available');
            (window as any).electron.ipcRenderer.removeAllListeners('update-progress');
            (window as any).electron.ipcRenderer.removeAllListeners('update-downloaded');
            (window as any).electron.ipcRenderer.removeAllListeners('update-error');
        };
    }, []);

    const handleDownload = () => {
        setStatus('downloading');
        (window as any).electron.ipcRenderer.invoke('download-update');
    };

    const handleInstall = () => {
        (window as any).electron.ipcRenderer.invoke('install-update');
    };

    const handleClose = () => {
        setStatus('idle');
    };

    if (status === 'idle') return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />

                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="relative w-full max-w-md overflow-hidden rounded-2xl bg-yorumi-bg border border-white/10 shadow-2xl p-6"
                >
                    {status !== 'downloading' && status !== 'downloaded' && (
                        <button
                            onClick={handleClose}
                            className="absolute top-4 right-4 rounded-full bg-black/20 p-2 text-white/70 hover:bg-black/40 hover:text-white transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    )}

                    <div className="flex flex-col items-center text-center">
                        {status === 'available' && (
                            <>
                                <div className="h-16 w-16 bg-yorumi-accent/20 rounded-full flex items-center justify-center mb-4 text-yorumi-accent">
                                    <Download className="h-8 w-8" />
                                </div>
                                <h2 className="text-xl font-bold text-white mb-2">Update Available!</h2>
                                <p className="text-gray-300 text-sm mb-6">
                                    Version <span className="font-bold text-white">{updateInfo?.version || 'New'}</span> is ready to download. Get the latest features and bug fixes!
                                </p>
                                <div className="flex gap-3 w-full">
                                    <button
                                        onClick={handleClose}
                                        className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium transition-colors"
                                    >
                                        Later
                                    </button>
                                    <button
                                        onClick={handleDownload}
                                        className="flex-1 py-2.5 rounded-xl bg-yorumi-accent hover:bg-yorumi-accent/80 text-white font-bold shadow-lg shadow-yorumi-accent/20 transition-all active:scale-95"
                                    >
                                        Download Now
                                    </button>
                                </div>
                            </>
                        )}

                        {status === 'downloading' && (
                            <>
                                <div className="h-16 w-16 bg-blue-500/20 rounded-full flex items-center justify-center mb-4 text-blue-400">
                                    <RefreshCw className="h-8 w-8 animate-spin" />
                                </div>
                                <h2 className="text-xl font-bold text-white mb-2">Downloading Update...</h2>
                                <p className="text-gray-400 text-sm mb-6">Please keep the app open.</p>
                                
                                <div className="w-full bg-black/40 rounded-full h-3 overflow-hidden mb-2">
                                    <motion.div 
                                        className="h-full bg-yorumi-accent"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${progress?.percent || 0}%` }}
                                        transition={{ ease: "linear", duration: 0.5 }}
                                    />
                                </div>
                                <div className="w-full flex justify-between text-xs text-gray-500 font-mono">
                                    <span>{Math.round(progress?.percent || 0)}%</span>
                                    <span>{(progress?.bytesPerSecond ? (progress.bytesPerSecond / 1024 / 1024).toFixed(2) : 0)} MB/s</span>
                                </div>
                            </>
                        )}

                        {status === 'downloaded' && (
                            <>
                                <div className="h-16 w-16 bg-green-500/20 rounded-full flex items-center justify-center mb-4 text-green-400">
                                    <Download className="h-8 w-8" />
                                </div>
                                <h2 className="text-xl font-bold text-white mb-2">Ready to Install!</h2>
                                <p className="text-gray-300 text-sm mb-6">
                                    The update has been downloaded. Restart the app to apply the changes.
                                </p>
                                <button
                                    onClick={handleInstall}
                                    className="w-full py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white font-bold shadow-lg shadow-green-500/20 transition-all active:scale-95"
                                >
                                    Install & Restart
                                </button>
                            </>
                        )}

                        {status === 'error' && (
                            <>
                                <div className="h-16 w-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4 text-red-400">
                                    <AlertCircle className="h-8 w-8" />
                                </div>
                                <h2 className="text-xl font-bold text-white mb-2">Update Failed</h2>
                                <p className="text-red-400 text-sm mb-6 bg-red-500/10 p-3 rounded-lg text-left overflow-hidden overflow-wrap break-words max-w-full">
                                    {errorMsg || 'An unknown error occurred while updating.'}
                                </p>
                                <button
                                    onClick={handleClose}
                                    className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium transition-colors"
                                >
                                    Dismiss
                                </button>
                            </>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
