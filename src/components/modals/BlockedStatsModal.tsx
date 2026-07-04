import { useEffect, useState } from 'react';
import { Shield, X } from 'lucide-react';

interface BlockStats {
    sessionTotal: number;
    sessionDomains: [string, number][];
    alltimeTotal: number;
}

interface BlockedStatsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function BlockedStatsModal({ isOpen, onClose }: BlockedStatsModalProps) {
    const [stats, setStats] = useState<BlockStats | null>(null);

    useEffect(() => {
        if (!isOpen) return;

        const fetchStats = async () => {
            if ((window as any).electron?.ipcRenderer) {
                const data = await (window as any).electron.ipcRenderer.invoke('get-block-stats');
                setStats(data);
            }
        };

        fetchStats();

        const handleUpdate = (_event: any, update: Record<string, number>) => {
            setStats(prev => {
                if (!prev) return prev;
                const newTotal = prev.sessionTotal + Object.values(update).reduce((a, b) => a + b, 0);
                const newAllTime = prev.alltimeTotal + Object.values(update).reduce((a, b) => a + b, 0);
                
                const currentDomains = new Map(prev.sessionDomains);
                for (const [domain, count] of Object.entries(update)) {
                    currentDomains.set(domain, (currentDomains.get(domain) || 0) + count);
                }
                
                return {
                    sessionTotal: newTotal,
                    alltimeTotal: newAllTime,
                    sessionDomains: Array.from(currentDomains.entries()).sort((a, b) => b[1] - a[1])
                };
            });
        };

        if ((window as any).electron?.ipcRenderer) {
            (window as any).electron.ipcRenderer.on('blocked-stats-update', handleUpdate);
        }

        return () => {
            if ((window as any).electron?.ipcRenderer) {
                (window as any).electron.ipcRenderer.removeAllListeners('blocked-stats-update');
            }
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div 
                className="w-full max-w-md bg-[#161616] border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col" 
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#1a1a1a]">
                    <div className="flex items-center gap-2 text-green-400 font-medium">
                        <Shield className="w-5 h-5" />
                        <h2>Ads & Trackers Blocked</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors"
                        title="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="px-6 py-4 text-sm text-gray-300 border-b border-white/5">
                    {(stats?.sessionTotal || 0) > 0
                        ? `${stats?.sessionTotal} ad/tracker request${stats?.sessionTotal === 1 ? '' : 's'} blocked this session`
                        : "Start playing content to see blocked ads & trackers."}
                </div>

                <div className="flex-1 overflow-y-auto max-h-[400px] p-2 custom-scrollbar">
                    {!stats || stats.sessionDomains.length === 0 ? (
                        <div className="text-center py-8 text-gray-500 text-sm">
                            No ads or trackers blocked yet, play something to start.
                        </div>
                    ) : (
                        <div className="flex flex-col gap-1">
                            {stats.sessionDomains.map(([domain, count]) => (
                                <div key={domain} className="flex items-center justify-between px-4 py-2 hover:bg-white/5 rounded-lg transition-colors">
                                    <span className="text-gray-300 text-sm font-mono truncate mr-4">{domain}</span>
                                    <span className="text-green-400/80 bg-green-400/10 px-2 py-0.5 rounded text-xs font-medium min-w-[2rem] text-center">
                                        {count.toLocaleString()}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="px-6 py-4 border-t border-white/5 bg-[#1a1a1a] flex items-center gap-2 text-sm text-gray-400">
                    <Shield className="w-4 h-4 opacity-50" />
                    <span>All-time:</span>
                    <strong className="text-white">
                        {(stats?.alltimeTotal || 0).toLocaleString()} ad & tracker request{(stats?.alltimeTotal || 0) === 1 ? '' : 's'}
                    </strong>
                    <span>blocked</span>
                </div>
            </div>
        </div>
    );
}
