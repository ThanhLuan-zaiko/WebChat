import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { authService } from '../services/authService';

interface User {
    id: string;
    username: string;
    email: string;
    avatar_url?: string;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    login: (token: string) => Promise<void>;
    logout: () => void;
    changePassword: (oldPassword: string, newPassword: string) => Promise<any>;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        const initAuth = async () => {
            const storedToken = localStorage.getItem('token');
            if (storedToken) {
                try {
                    // Verify token and get user info
                    const response = await api.get('/auth/me');
                    setUser(response.data);
                    setToken(storedToken);
                } catch (error) {
                    console.error('Failed to fetch user', error);
                    logout();
                }
            }
            setIsLoading(false);
        };

        initAuth();
    }, []);

    const login = async (newToken: string) => {
        localStorage.setItem('token', newToken);
        setToken(newToken);
        try {
            const response = await api.get('/auth/me');
            setUser(response.data);
        } catch (error) {
            console.error('Login failed to fetch user', error);
            logout();
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
    };

    const changePassword = async (oldPassword: string, newPassword: string) => {
        return authService.changePassword(oldPassword, newPassword);
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                token,
                isLoading,
                login,
                logout,
                changePassword,
                isAuthenticated: !!user,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
