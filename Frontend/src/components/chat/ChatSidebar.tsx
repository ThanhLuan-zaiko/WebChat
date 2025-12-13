import { useState } from 'react';
import { cn } from '../ui';
import { UserMenu } from './UserMenu';
import { SearchBar } from './SearchBar';
import { SidebarItem } from './SidebarItem';
import { CreateGroupModal } from './CreateGroupModal';
import { Plus } from 'lucide-react';
import type { Chat, User } from '../../types';

interface ChatSidebarProps {
    chats: Chat[];
    selectedChatId: string | null;
    selectedUserForNewChat: User | null;
    isLoadingChats: boolean;
    isSidebarOpen: boolean;
    onChatSelect: (id: string) => void;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    searchResults: User[];
    onUserSelect: (user: User) => void;
    showSearchResults: boolean;
    setShowSearchResults: (show: boolean) => void;
    isSearching: boolean;
    onCreateGroup: (participantIds: string[], name?: string) => Promise<any>;
    currentUserId?: string;
}

export const ChatSidebar = ({
    chats,
    selectedChatId,
    selectedUserForNewChat,
    isLoadingChats,
    isSidebarOpen,
    onChatSelect,
    searchQuery,
    onSearchChange,
    searchResults,
    onUserSelect,
    showSearchResults,
    setShowSearchResults,
    isSearching,
    onCreateGroup,
    currentUserId
}: ChatSidebarProps) => {
    const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);

    return (
        <div className={cn(
            "flex flex-col border-r border-gray-200 bg-white transition-all duration-300 ease-in-out md:w-80 lg:w-96",
            (selectedChatId || selectedUserForNewChat) && !isSidebarOpen ? "hidden md:flex" : "w-full flex"
        )}>
            {/* Sidebar Header */}
            <div className="flex items-center gap-2 px-4 py-3">
                <UserMenu />
                <div className="flex-1">
                    <SearchBar
                        searchQuery={searchQuery}
                        onChange={onSearchChange}
                        searchResults={searchResults}
                        onUserSelect={onUserSelect}
                        showResults={showSearchResults}
                        setShowResults={setShowSearchResults}
                        isSearching={isSearching}
                    />
                </div>
                <button
                    onClick={() => setIsCreateGroupOpen(true)}
                    className="p-2 rounded-full hover:bg-gray-100 text-gray-500 hover:text-blue-600 transition-colors"
                    title="Create Group Chat"
                >
                    <Plus className="w-5 h-5" />
                </button>
            </div>

            <CreateGroupModal
                isOpen={isCreateGroupOpen}
                onClose={() => setIsCreateGroupOpen(false)}
                onCreateGroup={onCreateGroup}
                currentUserId={currentUserId}
            />

            {/* Chat List */}
            <div className="flex-1 overflow-y-auto space-y-1 py-2">
                {isLoadingChats ?

                    (
                        <div className="flex justify-center p-4">Loading...</div>
                    ) : chats.length === 0 ? (
                        <div className="flex justify-center p-4 text-gray-500">No chats found</div>
                    ) : (
                        chats.map(chat => (
                            <SidebarItem
                                key={chat.id}
                                chat={chat}
                                isSelected={selectedChatId === chat.id}
                                onClick={() => onChatSelect(chat.id)}
                            />
                        ))
                    )}
            </div>
        </div>
    );
};
