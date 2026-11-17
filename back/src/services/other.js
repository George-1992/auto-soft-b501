export const getRandomString = (length, { onlyNumbers = false, onlyLetters = false } = {}) => {
    const characters = onlyNumbers ? '0123456789' : onlyLetters ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
};

export const getRandomSku = () => {
    const part1 = getRandomString(3, { onlyLetters: true });
    const part2 = getRandomString(10, { onlyNumbers: true });
    return `${part1}-${part2}`;
}

export const fileToBase64 = async (file, mimeType = 'application/octet-stream') => {
    try {
        // 1. Browser Environment (File or Blob)
        if (typeof FileReader !== 'undefined' && file instanceof Blob) {
            return await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result);
                reader.onerror = (error) => reject(error);
            });
        }

        // 2. Node.js / Backend Environment (Buffer, ArrayBuffer, or File path)
        if (typeof Buffer !== 'undefined') {
            let buffer;

            if (Buffer.isBuffer(file)) {
                buffer = file;
            } else if (file instanceof ArrayBuffer) {
                buffer = Buffer.from(file);
            } else if (typeof file?.arrayBuffer === 'function') {
                // Works for Web File/Blob objects in Node 18+ (e.g., FormData uploads)
                buffer = Buffer.from(await file.arrayBuffer());
                mimeType = file.type || mimeType;
            } else if (typeof file === 'string') {
                // If passing a local file path on the server
                const fs = await import('node:fs/promises');
                buffer = await fs.readFile(file);
            } else {
                throw new Error('Unsupported file input type');
            }

            return `data:${mimeType};base64,${buffer.toString('base64')}`;
        }

        throw new Error('Unsupported environment');
    } catch (error) {
        logger.error('fileToBase64 error ==> ', error);
        return null;
    }
};