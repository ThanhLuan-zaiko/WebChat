import api from './api';
import type { User } from '../types';

export const userService = {
    searchUsers: async (query: string = ""): Promise<User[]> => {
        const response = await api.get<User[]>(`/users/search?query=${query}`);
        return response.data;
    },
};
