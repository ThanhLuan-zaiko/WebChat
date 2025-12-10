import { useState, useRef, useEffect } from 'react';
import { LogOut, KeyRound, User as UserIcon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ChangePasswordModal } from '../auth/ChangePasswordModal';

export const UserMenu = () => {
    const { user, logout, changePassword } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="hover:bg-gray-100 p-2 rounded-full transition-colors"
                title={user?.username}
            >
                {user?.avatar_url ? (
                    <img
                        src={user.avatar_url}
                        alt={user.username}
                        className="h-8 w-8 rounded-full object-cover"
                    />
                ) : (
                    <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-[#2AABEE]">
                        <UserIcon className="h-5 w-5" />
                    </div>
                )}
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute left-0 top-12 w-56 bg-white rounded-lg shadow-xl border border-gray-100 py-1 z-20 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-sm font-medium text-gray-900 truncate">
                            {user?.username}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                            {user?.email}
                        </p>
                    </div>

                    <button
                        onClick={() => {
                            setIsOpen(false);
                            setIsPasswordModalOpen(true);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                        <KeyRound className="h-4 w-4" />
                        Change Password
                    </button>

                    <button
                        onClick={() => {
                            setIsOpen(false);
                            logout();
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                        <LogOut className="h-4 w-4" />
                        Logout
                    </button>
                </div>
            )}

            <ChangePasswordModal
                isOpen={isPasswordModalOpen}
                onClose={() => setIsPasswordModalOpen(false)}
                onChangePassword={changePassword}
            />
        </div>
    );
};
