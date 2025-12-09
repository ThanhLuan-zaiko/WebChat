import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Send } from 'lucide-react';
import { Button, Input } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';


const RegisterPage: React.FC = () => {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const { login } = useAuth(); // Destructured login from useAuth
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setIsLoading(true);

        try {
            await api.post('/auth/register', {
                username,
                email,
                password,
            });

            // Auto login after registration
            const loginFormData = new URLSearchParams();
            loginFormData.append('username', username);
            loginFormData.append('password', password);

            const loginResponse = await api.post('/auth/login', loginFormData, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            // Login using context
            await login(loginResponse.data.access_token);
            navigate('/', { state: { message: 'Registration successful! Welcome.' } });

        } catch (err: any) {
            console.error(err);
            setError(err.response?.data?.detail || 'Failed to register. Please try again.');
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
                        Create an Account
                    </h2>
                    <p className="mt-2 text-sm text-gray-600">
                        Join WebChat today!
                    </p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div className="relative">
                            <Input
                                label="Username"
                                type="text"
                                placeholder="Choose a username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                disabled={isLoading}
                            />
                        </div>

                        <div className="relative">
                            <Input
                                label="Email"
                                type="email"
                                placeholder="Enter your email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                disabled={isLoading}
                            />
                        </div>

                        <div className="relative">
                            <Input
                                label="Password"
                                type="password"
                                placeholder="Create a password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                disabled={isLoading}
                            />
                        </div>

                        <div className="relative">
                            <Input
                                label="Confirm Password"
                                type="password"
                                placeholder="Confirm your password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
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
                        Register
                    </Button>
                </form>

                <div className="text-center text-sm">
                    <span className="text-gray-500">Already have an account? </span>
                    <Link to="/login" className="font-semibold text-[#2AABEE] hover:text-[#229ED9]">
                        Sign in
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default RegisterPage;
