import { Router } from 'express';
import { sendError, sendSuccess } from '../../core/http/api-response';

type YumiMessage = {
    role: 'user' | 'assistant';
    content: string;
};

const router = Router();

const SYSTEM_PROMPT = `You are Yumi, a friendly AI anime recommendation assistant.

PERSONALITY:
- You are warm, casual, and knowledgeable, like an anime-loving friend.
- Keep replies short, helpful, and fun.
- Explain recommendations based on mood, genre, pacing, themes, or similar shows.
- Avoid spoilers unless the user directly asks for them.
- Interpret casual wording naturally. For example, "aura farming" usually means characters with strong presence, confidence, hype entrances, or cool power energy, not literal aura harvesting unless the user says so.

RECOMMENDATION RULES:
- When the user asks for anime recommendations, ALWAYS include an [ANIME] block.
- If the latest user message is a short refinement or mood after an earlier recommendation request, treat it as a recommendation request and include an [ANIME] block.
- Inside the [ANIME] block, put a JSON array of exact anime title strings.
- Put the [ANIME] block at the END of your response.
- If the user is asking anime trivia, factual questions, definitions, release/order questions, or quiz/trick questions, answer directly WITHOUT an [ANIME] block unless they explicitly ask for recommendations too.
- If a question contains a false premise, correct it plainly instead of trying to satisfy it. Example: no Hayao Miyazaki movie won 5 Oscars; Spirited Away won 1 Academy Award for Best Animated Feature.
- If the user is just chatting or asking a non-recommendation question, respond normally WITHOUT an [ANIME] block.
- Remember previous conversation context to refine recommendations.
- Prefer official English titles or widely recognized romaji titles.
- Use a broad anime knowledge base across eras, formats, and studios; do not keep returning the same small set of famous titles.
- For broad requests, vary picks across mainstream, mid-popularity, older, newer, and hidden-gem titles.
- Avoid DVD specials, recap episodes, chibi specials, side-story OVAs, and franchise extras unless the user explicitly asks for specials/OVAs/completionist watch order.
- Prefer main TV series, movies, or standalone works that a user can reasonably start watching.
- Recommend a mix of popular anime and hidden gems when appropriate.
- Recommend high-confidence real anime titles that strongly match the request.
- If a recommendation contains mature violence, horror, or sensitive themes, mention a brief content note without graphic detail.
- Do not provide explicit sexual content, erotic roleplay, hateful content, illegal instructions, self-harm instructions, or graphic descriptions.

FORMAT EXAMPLE:
If you want emotional anime with beautiful storytelling, these should hit hard.

[ANIME]["Violet Evergarden", "A Silent Voice", "Your Lie in April", "March Comes in Like a Lion", "Anohana: The Flower We Saw That Day"][/ANIME]

IMPORTANT: The [ANIME] block must contain ONLY a valid JSON array of title strings. No markdown, no backticks, no explanations inside the block.`;

const isYumiMessage = (value: unknown): value is YumiMessage => {
    if (!value || typeof value !== 'object') return false;

    const candidate = value as Partial<YumiMessage>;
    return (
        (candidate.role === 'user' || candidate.role === 'assistant') &&
        typeof candidate.content === 'string' &&
        candidate.content.trim().length > 0
    );
};

const normalizeMessages = (messages: unknown): YumiMessage[] => {
    if (!Array.isArray(messages)) return [];

    return messages
        .filter(isYumiMessage)
        .slice(-6)
        .map((message) => ({
            role: message.role,
            content: message.content.trim().slice(0, 800),
        }));
};

const INAPPROPRIATE_PATTERN = /\b(?:nsfw|hentai|porn|erotic|sex|sexy|nude|naked|fetish|incest|loli|shota|gore instructions?|self[-\s]?harm|suicide|kill myself)\b/i;

const getBoundaryReply = (content: string) => {
    if (INAPPROPRIATE_PATTERN.test(content)) {
        return 'I can only help with safe anime recommendations. Tell me an anime genre, mood, or title you like and I will suggest something fitting.';
    }

    return null;
};

const getFactualShortcutReply = (content: string) => {
    const normalized = content.toLowerCase();
    if (
        /\bmiyazaki\b/.test(normalized) &&
        /\b5\s+oscars?\b/.test(normalized)
    ) {
        return 'None. No Hayao Miyazaki movie has won 5 Oscars. The Oscar-winning Miyazaki film is Spirited Away, which won 1 Academy Award for Best Animated Feature.';
    }

    return null;
};

router.post('/yumi', async (req, res) => {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        return sendError(res, 'Yumi is not configured. Set GROQ_API_KEY on the backend.', 503);
    }

    const messages = normalizeMessages(req.body?.messages);
    if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
        return sendError(res, 'Send at least one user message for Yumi.', 400);
    }

    const latestUserMessage = messages[messages.length - 1].content;
    const boundaryReply = getBoundaryReply(latestUserMessage);
    if (boundaryReply) {
        return sendSuccess(res, { reply: boundaryReply });
    }

    const factualShortcutReply = getFactualShortcutReply(latestUserMessage);
    if (factualShortcutReply) {
        return sendSuccess(res, { reply: factualShortcutReply });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            signal: controller.signal,
            body: JSON.stringify({
                model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
                temperature: 0.55,
                max_completion_tokens: 420,
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    ...messages,
                ],
            }),
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            return sendError(
                res,
                errorText || `Groq request failed with status ${response.status}`,
                response.status >= 500 ? 502 : response.status
            );
        }

        const payload = await response.json() as {
            choices?: Array<{ message?: { content?: string } }>;
        };
        const reply = payload.choices?.[0]?.message?.content?.trim();

        if (!reply) {
            return sendError(res, 'Yumi did not return a recommendation.', 502);
        }

        return sendSuccess(res, { reply });
    } catch (error) {
        const message = error instanceof Error && error.name === 'AbortError'
            ? 'Yumi took too long to respond.'
            : 'Yumi could not respond right now.';
        return sendError(res, message, 502);
    } finally {
        clearTimeout(timeout);
    }
});

export default router;
