import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Send } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button, Input } from '../components/ui';
import api from '../services/api';

const LoginPage: React.FC = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const formData = new URLSearchParams();
            formData.append('username', username);
            formData.append('password', password);

            const response = await api.post('/auth/login', formData, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            await login(response.data.access_token);
            navigate('/');
        } catch (err: any) {
            console.error(err);
            setError(err.response?.data?.detail || 'Failed to login. Please check your credentials.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center p-4">
            <div className="w-full max-w-md space-y-8 rounded-2xl bg-white p-8 shadow-xl">
                <div className="flex flex-col items-center text-center">
                    <div className="mb-4 rounded-full bg-blue-50 p-4">
                        <Send className="h-10 w-10 text-[#2AABEE]" />
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900">
                        Sign in to WebChat
                    </h2>
                    <p className="mt-2 text-sm text-gray-600">
                        Welcome back! Please enter your details.
                    </p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div className="relative">
                            <Input
                                label="Username"
                                type="text"
                                placeholder="Enter your username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                disabled={isLoading}
                            />
                        </div>

                        <div className="relative">
                            <Input
                                label="Password"
                                type="password"
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                disabled={isLoading}
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="rounded-md bg-red-50 p-3 text-sm text-red-500">
                            {error}
                        </div>
                    )}

                    <Button
                        type="submit"
                        className="w-full"
                        isLoading={isLoading}
                    >
                        Sign in
                    </Button>
                </form>

                <div className="text-center text-sm">
                    <span className="text-gray-500">Don't have an account? </span>
                    <Link to="/register" className="font-semibold text-[#2AABEE] hover:text-[#229ED9]">
                        Sign up
                    </Link>
                </div>
            </div>
        </div>

    );
};

export default LoginPage;
