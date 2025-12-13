import api from './api';
import type { Chat, Message } from '../types';

export const chatService = {
    getChats: async (): Promise<Chat[]> => {
        const response = await api.get('/chats');
        return response.data;
    },

    getMessages: async (chatId: string, query?: string): Promise<Message[]> => {
        const url = query
            ? `/chats/${chatId}/messages?query=${encodeURIComponent(query)}`
            : `/chats/${chatId}/messages`;
        const response = await api.get(url);
        return response.data;
    },

    sendMessage: async (chatId: string, text: string, files?: File[]): Promise<Message> => {
        const formData = new FormData();

        if (text) {
            formData.append('text', text);
        }

        if (files && files.length > 0) {
            files.forEach(file => {
                formData.append('files', file);
            });
        }

        const response = await api.post(`/chats/${chatId}/messages?text=${encodeURIComponent(text || '')}`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },

    createChat: async (participantId: string): Promise<Chat> => {
        const response = await api.post('/chats', { participantId });
        return response.data;
    },

    createGroupChat: async (participantIds: string[], name?: string): Promise<Chat> => {
        const response = await api.post('/chats/group', { participantIds, name });
        return response.data;
    },

    markAsRead: async (chatId: string): Promise<void> => {
        await api.post(`/chats/${chatId}/read`);
    },

    deleteMessage: async (chatId: string, messageId: string): Promise<void> => {
        await api.delete(`/chats/${chatId}/messages/${messageId}`);
    },

    blockUser: async (userId: string): Promise<void> => {
        await api.post(`/users/${userId}/block`);
    },

    unblockUser: async (userId: string): Promise<void> => {
        await api.delete(`/users/${userId}/block`);
    },

    getBlockedUsers: async (): Promise<any[]> => {
        const response = await api.get('/users/blocked');
        return response.data;
    },

    leaveGroup: async (chatId: string): Promise<void> => {
        await api.post(`/chats/${chatId}/leave`);
    },

    kickMember: async (chatId: string, userId: string): Promise<void> => {
        await api.delete(`/chats/${chatId}/participants/${userId}`);
    },

    deleteGroup: async (chatId: string): Promise<void> => {
        await api.delete(`/chats/${chatId}`);
    }
};
