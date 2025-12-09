import React, { useState } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Eye, EyeOff } from 'lucide-react';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost';
    isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
    className,
    variant = 'primary',
    isLoading,
    children,
    ...props
}) => {
    const baseStyles = 'inline-flex items-center justify-center rounded-lg px-4 py-3 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

    const variants = {
        primary: 'bg-[#2AABEE] text-white hover:bg-[#229ED9] focus:ring-[#2AABEE]',
        secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-500',
        ghost: 'bg-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900',
    };

    return (
        <button
            className={cn(baseStyles, variants[variant], className)}
            disabled={isLoading || props.disabled}
            {...props}
        >
            {isLoading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
                children
            )}
        </button>
    );
};

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}

export const Input: React.FC<InputProps> = ({
    className,
    label,
    error,
    type = 'text',
    ...props
}) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';

    return (
        <div className="space-y-1.5">
            {label && (
                <label className="text-sm font-medium text-gray-700">
                    {label}
                </label>
            )}
            <div className="relative">
                <input
                    type={isPassword ? (showPassword ? 'text' : 'password') : type}
                    className={cn(
                        'flex w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-sm transition-colors',
                        'placeholder:text-gray-400',
                        'focus:outline-none focus:ring-2 focus:ring-[#2AABEE] focus:border-transparent',
                        'disabled:cursor-not-allowed disabled:opacity-50',
                        isPassword && 'pr-10', // Add padding for eye icon
                        error && 'border-red-500 focus:ring-red-500',
                        className
                    )}
                    {...props}
                />
                {isPassword && (
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none z-10 p-1"
                        tabIndex={-1}
                    >
                        {showPassword ? (
                            <EyeOff className="h-5 w-5" />
                        ) : (
                            <Eye className="h-5 w-5" />
                        )}
                    </button>
                )}
            </div>
            {error && (
                <p className="text-xs text-red-500 animate-in slide-in-from-top-1">
                    {error}
                </p>
            )}
        </div>
    );
};
