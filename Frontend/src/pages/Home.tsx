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
        handleRecallMessage,
        messageSearchQuery,
        setMessageSearchQuery,
        searchResults: messageSearchResults,
        blockedUsers,
        handleBlockUser,
        handleUnblockUser,
        handleCreateGroupChat,
        handleLeaveGroup,
        handleKickMember,
        handleDeleteGroup,
        handleAddMembers,
        handleToggleReaction,
        encryptionKey,
        setEncryptionKey,
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

    const activeChat = selectedChat || (selectedUserForNewChat ? {
        id: 'new',
        name: selectedUserForNewChat.username,
        avatar: selectedUserForNewChat.avatar,
        participants: [selectedUserForNewChat],
        isGroup: false,
        unreadCount: 0,
        isOnline: selectedUserForNewChat.isOnline
    } as any : undefined);

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
                onCreateGroup={handleCreateGroupChat}
                currentUserId={user?.id}
            />

            {(selectedChatId || selectedUserForNewChat) ? (
                <ChatArea
                    chat={activeChat}
                    displayName={displayName}
                    messages={messages}
                    messageInput={messageInput}
                    onMessageInputChange={setMessageInput}
                    onSendMessage={handleSendMessage}
                    onRecallMessage={handleRecallMessage}
                    searchQuery={messageSearchQuery}
                    onSearchChange={setMessageSearchQuery}
                    searchResults={messageSearchResults}
                    isLoadingMessages={isLoadingMessages}
                    isSidebarOpen={isSidebarOpen}
                    onBackClick={handleBackClick}
                    blockedUsers={blockedUsers}
                    onBlockUser={handleBlockUser}
                    onUnblockUser={handleUnblockUser}
                    currentUserId={user?.id}
                    onLeaveGroup={handleLeaveGroup}
                    onKickMember={handleKickMember}
                    onDeleteGroup={handleDeleteGroup}
                    onAddMembers={handleAddMembers}
                    onToggleReaction={handleToggleReaction}
                    encryptionKey={encryptionKey}
                    onSetEncryptionKey={setEncryptionKey}
                />
            ) : (
                <EmptyState />
            )}
        </div>
    );
};

export default HomePage;
