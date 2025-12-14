import { useState, useEffect } from 'react';
import { Search, X, Check, UserPlus } from 'lucide-react';
import type { User } from '../../types';
import { cn } from '../ui';
import axios from 'axios';

interface AddMemberModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAddMembers: (userIds: string[]) => void;
    currentMemberIds: string[];
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

export const AddMemberModal = ({ isOpen, onClose, onAddMembers, currentMemberIds }: AddMemberModalProps) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<User[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const searchUsers = async () => {
            if (!searchQuery.trim()) {
                setSearchResults([]);
                return;
            }

            setIsLoading(true);
            try {
                const token = localStorage.getItem('token');
                if (!token) return;

                const response = await axios.get(`${API_BASE_URL}/users/search`, {
                    params: { q: searchQuery },
                    headers: { Authorization: `Bearer ${token}` }
                });

                // Filter out users who are already in the group
                // Also ensure response.data is an array.
                const results = Array.isArray(response.data) ? response.data : [];
                const availableUsers = results.filter((u: User) => !currentMemberIds.includes(u.id));
                setSearchResults(availableUsers);
            } catch (error) {
                console.error('Error searching users:', error);
            } finally {
                setIsLoading(false);
            }
        };

        const timeoutId = setTimeout(searchUsers, 300);
        return () => clearTimeout(timeoutId);
    }, [searchQuery, currentMemberIds]);

    const toggleUser = (user: User) => {
        if (selectedUsers.find(u => u.id === user.id)) {
            setSelectedUsers(selectedUsers.filter(u => u.id !== user.id));
        } else {
            setSelectedUsers([...selectedUsers, user]);
        }
    };

    const handleAdd = () => {
        onAddMembers(selectedUsers.map(u => u.id));
        setSelectedUsers([]);
        setSearchQuery('');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200">
                <div className="p-4 border-b flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900">Add Members</h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="p-4 border-b space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            placeholder="Search users..."
                            value={searchQuery}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                            className={cn(
                                "flex w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 pl-9 text-sm transition-colors",
                                "focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            )}
                            autoFocus
                        />
                    </div>

                    {/* Selected Users Pills */}
                    {selectedUsers.length > 0 && (
                        <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                            {selectedUsers.map(user => (
                                <div key={user.id} className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded-full text-sm animate-in zoom-in duration-200">
                                    <span className="max-w-[100px] truncate">{user.username}</span>
                                    <button onClick={() => toggleUser(user)} className="hover:bg-blue-100 rounded-full p-0.5">
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                    {isLoading ? (
                        <div className="flex justify-center p-4"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div></div>
                    ) : (
                        <div className="space-y-1">
                            {searchResults.length === 0 && searchQuery && (
                                <p className="text-center text-gray-500 p-4">No users found</p>
                            )}
                            {searchResults.map(user => {
                                const isSelected = selectedUsers.some(u => u.id === user.id);
                                return (
                                    <button
                                        key={user.id}
                                        onClick={() => toggleUser(user)}
                                        className={cn(
                                            "w-full flex items-center gap-3 p-2 rounded-lg transition-colors",
                                            isSelected ? "bg-blue-50" : "hover:bg-gray-50"
                                        )}
                                    >
                                        <div className="relative">
                                            {user.avatar ? (
                                                <img src={user.avatar} alt={user.username} className="w-10 h-10 rounded-full object-cover" />
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium">
                                                    {user.username[0].toUpperCase()}
                                                </div>
                                            )}
                                            {isSelected && (
                                                <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white rounded-full p-0.5 border-2 border-white">
                                                    <Check className="w-3 h-3" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 text-left">
                                            <p className={cn("font-medium", isSelected ? "text-blue-700" : "text-gray-900")}>
                                                {user.username}
                                            </p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t bg-gray-50 rounded-b-xl flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleAdd}
                        disabled={selectedUsers.length === 0}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <UserPlus className="w-4 h-4" />
                        Add {selectedUsers.length > 0 ? `(${selectedUsers.length})` : ''}
                    </button>
                </div>
            </div>
        </div>
    );
};
