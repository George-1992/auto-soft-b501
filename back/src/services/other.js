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