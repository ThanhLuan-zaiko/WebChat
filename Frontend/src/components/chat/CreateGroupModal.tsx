import { useState, useEffect } from 'react';
import { X, Search, Check, UserPlus } from 'lucide-react';
import { useUserSearch } from '../../hooks/useUserSearch';
import type { User } from '../../types';

interface CreateGroupModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreateGroup: (participantIds: string[], name?: string) => Promise<any>;
    currentUserId?: string;
}

export const CreateGroupModal = ({ isOpen, onClose, onCreateGroup, currentUserId }: CreateGroupModalProps) => {
    const [groupName, setGroupName] = useState('');
    const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
    const {
        searchQuery,
        setSearchQuery,
        searchResults,
        isSearching
    } = useUserSearch(() => { }); // Pass no-op as we handle selection manually

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setGroupName('');
            setSelectedUsers([]);
            setSearchQuery('');
        }
    }, [isOpen, setSearchQuery]);

    const handleUserToggle = (user: User) => {
        if (selectedUsers.some(u => u.id === user.id)) {
            setSelectedUsers(prev => prev.filter(u => u.id !== user.id));
        } else {
            setSelectedUsers(prev => [...prev, user]);
        }
    };

    const handleSubmit = async () => {
        if (selectedUsers.length < 2) return;

        try {
            await onCreateGroup(selectedUsers.map(u => u.id), groupName || undefined);
            onClose();
        } catch (error) {
            console.error("Failed to create group:", error);
            // Could add error state here to show in UI
        }
    };

    // Filter out current user from search results if they appear
    const filteredResults = searchResults.filter(u => u.id !== currentUserId);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900">Create Group Chat</h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 text-gray-500">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-4 space-y-4 flex-1 overflow-hidden flex flex-col">
                    {/* Group Name Input */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Group Name (Optional)</label>
                        <input
                            type="text"
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            placeholder="My Awesome Group"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        />
                    </div>

                    {/* User Search */}
                    <div className="flex-1 flex flex-col min-h-0">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Add Members</label>
                        <div className="relative mb-2">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search people..."
                                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            />
                        </div>

                        {/* Selected Users Tags */}
                        {selectedUsers.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-2 max-h-20 overflow-y-auto">
                                {selectedUsers.map(user => (
                                    <div key={user.id} className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded-full text-xs font-medium border border-blue-100">
                                        <span>{user.username}</span>
                                        <button
                                            onClick={() => handleUserToggle(user)}
                                            className="hover:bg-blue-200 rounded-full p-0.5"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Search Results */}
                        <div className="flex-1 overflow-y-auto border border-gray-100 rounded-lg p-1">
                            {isSearching ? (
                                <div className="text-center py-4 text-gray-500 text-sm">Searching...</div>
                            ) : filteredResults.length > 0 ? (
                                <div className="space-y-1">
                                    {filteredResults.map(user => {
                                        const isSelected = selectedUsers.some(u => u.id === user.id);
                                        return (
                                            <div
                                                key={user.id}
                                                onClick={() => handleUserToggle(user)}
                                                className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                                                    }`}
                                            >
                                                <div className="relative">
                                                    {user.avatar ? (
                                                        <img src={user.avatar} alt={user.username} className="w-8 h-8 rounded-full object-cover" />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-sm font-medium">
                                                            {user.username[0].toUpperCase()}
                                                        </div>
                                                    )}
                                                    {isSelected && (
                                                        <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white rounded-full p-0.5 border-2 border-white">
                                                            <Check className="w-2 h-2" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-gray-900 truncate">{user.username}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : searchQuery ? (
                                <div className="text-center py-4 text-gray-500 text-sm">No users found</div>
                            ) : (
                                <div className="text-center py-4 text-gray-500 text-sm">Type to search users</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={selectedUsers.length < 2}
                        className={`px-4 py-2 text-sm font-medium text-white rounded-lg flex items-center gap-2 transition-all ${selectedUsers.length < 2
                            ? 'bg-blue-300 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl'
                            }`}
                    >
                        <UserPlus className="w-4 h-4" />
                        Create Group ({selectedUsers.length + 1})
                    </button>
                </div>
            </div>
        </div>
    );
};
