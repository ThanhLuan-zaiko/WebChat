import api from './api';

export const authService = {
    changePassword: async (oldPassword: string, newPassword: string) => {
        const response = await api.post('/auth/change-password', {
            old_password: oldPassword,
            new_password: newPassword
        });
        return response.data;
    }
};
