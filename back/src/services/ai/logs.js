export const normalizeAiError = (error) => {
    const err = error || {};
    const message = err?.message || 'Unknown AI error';
    const name = err?.name || 'AIError';
    const isMissingApiKey =
        name === 'AI_LoadAPIKeyError' ||
        message.toLowerCase().includes('api key is missing');

    if (isMissingApiKey) {
        return {
            statusCode: 500,
            code: 'OPENAI_API_KEY_MISSING',
            message: 'AI service is not configured. Missing OPENAI_API_KEY on backend.',
            details: message,
        };
    }

    return {
        statusCode: 500,
        code: name,
        message: 'AI request failed. Please try again.',
        details: message,
    };
};