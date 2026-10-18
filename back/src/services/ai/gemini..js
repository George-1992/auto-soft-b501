import { logger } from '#src/utils/logger.js';

const API_Key = process.env.GOOGLE_API_KEY || '';

const askGemini = async ({
    messages,
    model = 'gemini-2.0-flash',
    apiKey = API_Key,
    maxTokens = 1000,
    temperature = 0.7
}) => {

    let resObj = {
        success: false,
        message: '',
        data: null
    }

    if (!messages || (Array.isArray(messages) && messages.length === 0)) {
        resObj.message = 'Messages are required';
        return resObj;
    }


    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: messages
                }],
                generationConfig: {
                    temperature: temperature,
                    maxOutputTokens: maxTokens,
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            logger.error(`Gemini API error: ${response.status} ${errorText}`);
            resObj.message = `Gemini API error: ${response.status} ${errorText}`;
            return resObj;
        }

        const data = await response.json();
        logger.info('Gemini API response data:', data);

        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
            resObj.success = true;
            resObj.data = data.candidates[0].content.parts[0].text;
            return resObj;
        } else {
            logger.error('No response from Gemini API');
            resObj.message = 'No response from Gemini API';
            return resObj;
        }
    } catch (error) {
        logger.error('Error calling Gemini API:', error);
        throw error;
    }
};

// Example usage:
// askGemini({ prompt: 'Hello, how are you?' })
//     .then(response => logger.info(response))
//     .catch(error => logger.error(error));

export { askGemini };
