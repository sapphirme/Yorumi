import { API_BASE } from '../config/api';

export type YumiChatMessage = {
    role: 'user' | 'assistant';
    content: string;
};

type YumiChatResponse = {
    success: boolean;
    data?: {
        reply?: string;
    };
    error?: string;
};

export async function askYumi(messages: YumiChatMessage[]) {
    const response = await fetch(`${API_BASE}/chat/yumi`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages }),
    });

    const payload = await response.json().catch(() => null) as YumiChatResponse | null;

    if (!response.ok || !payload?.success || !payload.data?.reply) {
        throw new Error(payload?.error || 'Yumi is taking a quick break. Try again in a moment.');
    }

    return payload.data.reply;
}
