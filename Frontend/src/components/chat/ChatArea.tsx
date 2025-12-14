import { useState, useEffect } from 'react';
import { cn } from '../ui';
import type { Chat, Message } from '../../types';
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { BlockUserModal } from './BlockUserModal';
import { DragDropOverlay } from './DragDropOverlay';
import { GroupInfoModal } from './GroupInfoModal';
import { AddMemberModal } from './AddMemberModal';

interface ChatAreaProps {
    chat: Chat | undefined;
    displayName: string;
    messages: Message[];
    messageInput: string;
    onMessageInputChange: (value: string) => void;
    onSendMessage: (files?: File[]) => void;
    onRecallMessage: (messageId: string) => void;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    searchResults: Message[];
    isLoadingMessages: boolean;
    isSidebarOpen: boolean;
    onBackClick: () => void;
    blockedUsers: string[];
    onBlockUser: (userId: string) => void;
    onUnblockUser: (userId: string) => void;
    currentUserId: string | undefined;
    onLeaveGroup: (chatId: string) => void;
    onKickMember: (chatId: string, userId: string) => void;
    onDeleteGroup: (chatId: string) => void;
    onAddMembers: (chatId: string, userIds: string[]) => void;
    onToggleReaction: (messageId: string, emoji: string) => void;
}

export const ChatArea = ({
    chat,
    displayName,
    messages,
    messageInput,
    onMessageInputChange,
    onSendMessage,
    onRecallMessage,
    searchQuery,
    onSearchChange,
    searchResults,
    isLoadingMessages,
    isSidebarOpen,
    onBackClick,
    blockedUsers,
    onBlockUser,
    onUnblockUser,
    currentUserId,
    onLeaveGroup,
    onKickMember,
    onDeleteGroup,
    onAddMembers,
    onToggleReaction
}: ChatAreaProps) => {
    const [isDragging, setIsDragging] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);

    // New UI States
    const [showBlockConfirm, setShowBlockConfirm] = useState(false);
    const [showGroupInfo, setShowGroupInfo] = useState(false);
    const [showAddMemberModal, setShowAddMemberModal] = useState(false);

    // Filter messages for display
    const displayMessages = (isSearching && localSearchQuery) ? searchResults : messages;

    // Debounce search
    useEffect(() => {
        const handler = setTimeout(() => {
            if (localSearchQuery !== searchQuery) {
                onSearchChange(localSearchQuery);
            }
        }, 500);
        return () => clearTimeout(handler);
    }, [localSearchQuery, onSearchChange, searchQuery]);

    // Sync local state
    useEffect(() => {
        if (searchQuery !== localSearchQuery) {
            setLocalSearchQuery(searchQuery);
        }
    }, [searchQuery]);

    const handleJumpToMessage = (messageId: string) => {
        setIsSearching(false);
        setLocalSearchQuery('');
        onSearchChange('');
        setTimeout(() => {
            const element = document.getElementById(`message-${messageId}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                element.classList.add('bg-yellow-100/50');
                setTimeout(() => element.classList.remove('bg-yellow-100/50'), 2000);
            }
        }, 100);
    };

    // Drag and Drop
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };
    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files) {
            setSelectedFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
        }
    };

    if (!chat) {
        return (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
                <p className="text-gray-500">Select a chat to start messaging</p>
            </div>
        );
    }

    const otherParticipant = chat.participants?.find(p => p.id !== currentUserId);
    const isBlocked = otherParticipant ? blockedUsers.includes(otherParticipant.id) : false;
    const amIBlocked = chat.isBlockedBy;

    return (
        <div
            className={cn(
                "flex flex-col bg-[#87A985] bg-opacity-20 bg-[url('https://web.telegram.org/img/bg_0.png')] w-full relative",
                isSidebarOpen && "hidden md:flex"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <ChatHeader
                chat={chat}
                displayName={displayName}
                onBackClick={onBackClick}
                isSearching={isSearching}
                setIsSearching={setIsSearching}
                searchQuery={localSearchQuery}
                onSearchChange={setLocalSearchQuery}
                otherParticipant={otherParticipant}
                isBlocked={isBlocked}
                onBlockUser={() => setShowBlockConfirm(true)}
                onUnblockUser={onUnblockUser}
                onGroupInfo={() => setShowGroupInfo(true)}
                onLeaveGroup={() => onLeaveGroup(chat.id)}
                onDeleteGroup={() => onDeleteGroup(chat.id)}
                onAddMembers={() => setShowAddMemberModal(true)}
            />

            <MessageList
                messages={displayMessages}
                isLoading={isLoadingMessages}
                onRecallMessage={onRecallMessage}
                isSearching={isSearching}
                onJumpToMessage={handleJumpToMessage}
                isGroup={!!chat.isGroup}
                onToggleReaction={onToggleReaction}
            />

            <ChatInput
                messageInput={messageInput}
                onMessageInputChange={onMessageInputChange}
                onSendMessage={onSendMessage}
                isBlocked={isBlocked}
                amIBlocked={!!amIBlocked}
                onUnblockUser={() => otherParticipant && onUnblockUser(otherParticipant.id)}
                selectedFiles={selectedFiles}
                setSelectedFiles={setSelectedFiles}
            />

            <DragDropOverlay isDragging={isDragging} />

            {showBlockConfirm && (
                <BlockUserModal
                    onClose={() => setShowBlockConfirm(false)}
                    onConfirm={() => {
                        if (otherParticipant) onBlockUser(otherParticipant.id);
                        setShowBlockConfirm(false);
                    }}
                />
            )}

            {showGroupInfo && chat && currentUserId && (
                <GroupInfoModal
                    isOpen={showGroupInfo}
                    onClose={() => setShowGroupInfo(false)}
                    chat={chat}
                    currentUserId={currentUserId}
                    onLeaveGroup={() => {
                        onLeaveGroup(chat.id);
                        setShowGroupInfo(false);
                    }}
                    onKickMember={(userId) => onKickMember(chat.id, userId)}
                    onDeleteGroup={() => {
                        onDeleteGroup(chat.id);
                        setShowGroupInfo(false);
                    }}
                    onAddMembers={(userIds) => onAddMembers(chat.id, userIds)}
                />
            )}

            {showAddMemberModal && chat && (
                <AddMemberModal
                    isOpen={showAddMemberModal}
                    onClose={() => setShowAddMemberModal(false)}
                    onAddMembers={(userIds) => {
                        onAddMembers(chat.id, userIds);
                        setShowAddMemberModal(false);
                    }}
                    currentMemberIds={chat.participants?.map(p => p.id) || []}
                />
            )}
        </div>
    );
};
