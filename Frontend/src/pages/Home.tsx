import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useChat } from '../hooks/useChat';
import { useUserSearch } from '../hooks/useUserSearch';
import { ChatSidebar } from '../components/chat/ChatSidebar';
import { ChatArea } from '../components/chat/ChatArea';
import { EmptyState } from '../components/chat/EmptyState';

const HomePage = () => {
    const { user } = useAuth();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    // Custom hooks
    const {
        chats,
        messages,
        selectedChatId,
        selectedUserForNewChat,
        selectedChat,
        messageInput,
        isLoadingChats,
        isLoadingMessages,
        setMessageInput,
        handleChatSelect,
        handleSendMessage,
        handleUserSelect: handleUserSelectFromChat,
    } = useChat(user);

    const {
        searchQuery,
        searchResults,
        isSearching,
        showSearchResults,
        setSearchQuery,
        setShowSearchResults,
        handleUserSelect: handleUserSelectFromSearch,
    } = useUserSearch(handleUserSelectFromChat);

    const displayName = selectedChat?.name || selectedUserForNewChat?.username || 'Chat';

    const handleBackClick = () => {
        setIsSidebarOpen(true);
    };

    return (
        <div className="flex h-screen overflow-hidden bg-white">
            <ChatSidebar
                chats={chats}
                selectedChatId={selectedChatId}
                selectedUserForNewChat={selectedUserForNewChat}
                isLoadingChats={isLoadingChats}
                isSidebarOpen={isSidebarOpen}
                onChatSelect={(id) => {
                    handleChatSelect(id);
                    if (window.innerWidth < 768) {
                        setIsSidebarOpen(false);
                    }
                }}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                searchResults={searchResults}
                onUserSelect={(user) => {
                    handleUserSelectFromSearch(user);
                    if (window.innerWidth < 768) {
                        setIsSidebarOpen(false);
                    }
                }}
                showSearchResults={showSearchResults}
                setShowSearchResults={setShowSearchResults}
                isSearching={isSearching}
            />

            {(selectedChatId || selectedUserForNewChat) ? (
                <ChatArea
                    chat={selectedChat}
                    displayName={displayName}
                    messages={messages}
                    messageInput={messageInput}
                    onMessageInputChange={setMessageInput}
                    onSendMessage={handleSendMessage}
                    isLoadingMessages={isLoadingMessages}
                    isSidebarOpen={isSidebarOpen}
                    onBackClick={handleBackClick}
                />
            ) : (
                <EmptyState />
            )}
        </div>
    );
};

export default HomePage;
