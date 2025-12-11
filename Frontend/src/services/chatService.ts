import api from './api';
import type { Chat, Message } from '../types';

export const chatService = {
    getChats: async (): Promise<Chat[]> => {
        const response = await api.get('/chats');
        return response.data;
    },

    getMessages: async (chatId: string): Promise<Message[]> => {
        const response = await api.get(`/chats/${chatId}/messages`);
        return response.data;
    },

    sendMessage: async (chatId: string, text: string): Promise<Message> => {
        const response = await api.post(`/chats/${chatId}/messages`, { text });
        return response.data;
    },

    createChat: async (participantId: string): Promise<Chat> => {
        const response = await api.post('/chats', { participantId });
        return response.data;
    },

    markAsRead: async (chatId: string): Promise<void> => {
        await api.post(`/chats/${chatId}/read`);
    }
};
