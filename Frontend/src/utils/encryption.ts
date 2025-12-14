import CryptoJS from 'crypto-js';

export const encryptMessage = (text: string, key: string): string => {
    if (!key || !text) return text;
    try {
        return CryptoJS.AES.encrypt(text, key).toString();
    } catch (e) {
        console.error("Encryption failed", e);
        return text;
    }
};

export const decryptMessage = (ciphertext: string, key: string): string => {
    if (!key || !ciphertext) return ciphertext;
    try {
        const bytes = CryptoJS.AES.decrypt(ciphertext, key);
        const originalText = bytes.toString(CryptoJS.enc.Utf8);
        if (!originalText) return "Failed to decrypt"; // Wrong key likely
        return originalText;
    } catch (e) {
        console.error("Decryption failed", e);
        return "Failed to decrypt";
    }
};
