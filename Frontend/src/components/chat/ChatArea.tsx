import { useRef, useState, useEffect } from 'react';
import { Search, MoreVertical, Paperclip, Smile, Mic, Phone, Send, ChevronDown } from 'lucide-react';
import EmojiPicker, { type EmojiClickData } from 'emoji-picker-react';
import { cn } from '../ui';
import { MessageBubble } from './MessageBubble';
import { FilePreview } from './FilePreview';
import type { Chat, Message } from '../../types';

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
    currentUserId
}: ChatAreaProps) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const emojiPickerRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const [showScrollButton, setShowScrollButton] = useState(false);
    const [hasNewMessage, setHasNewMessage] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);

    // New UI States
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [showBlockConfirm, setShowBlockConfirm] = useState(false);

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

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        setHasNewMessage(false);
    };

    const checkIfNearBottom = () => {
        const container = messagesContainerRef.current;
        if (!container) return true;
        return container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    };

    const handleScroll = () => {
        const isNearBottom = checkIfNearBottom();
        setShowScrollButton(!isNearBottom && messages.length > 0);
        if (isNearBottom) setHasNewMessage(false);
    };

    // Auto scroll logic
    useEffect(() => {
        if (messages.length === 0) return;
        const isNearBottom = checkIfNearBottom();
        const lastMessage = messages[messages.length - 1];
        const isOutgoing = lastMessage && !lastMessage.isIncoming;
        if (isOutgoing || isNearBottom) scrollToBottom();
        else setHasNewMessage(true);
    }, [messages]);

    // Initial load scroll
    useEffect(() => {
        if (!isLoadingMessages && messages.length > 0) {
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
            }, 100);
        }
    }, [isLoadingMessages]);

    // Handle clicks outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
                setShowEmojiPicker(false);
            }
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showEmojiPicker, isMenuOpen]);

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files?.length) {
            setSelectedFiles(prev => [...prev, ...Array.from(event.target.files!)]);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleRemoveFile = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleSendWithFiles = () => {
        if (messageInput.trim() || selectedFiles.length > 0) {
            onSendMessage(selectedFiles);
            setSelectedFiles([]);
            setShowEmojiPicker(false);
        }
    };

    const onEmojiClick = (emojiObject: EmojiClickData) => {
        onMessageInputChange(messageInput + emojiObject.emoji);
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

    const handleBlockAction = () => {
        if (!otherParticipant) return;
        if (isBlocked) {
            onUnblockUser(otherParticipant.id);
        } else {
            setShowBlockConfirm(true);
        }
        setIsMenuOpen(false);
    };

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
            {/* Header */}
            <div className="flex items-center justify-between bg-white px-4 py-2 border-b border-gray-200">
                <div className="flex items-center gap-3">
                    <button className="md:hidden text-gray-500 mr-2" onClick={onBackClick}>
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </button>
                    <div className="flex flex-col">
                        <h3 className="font-semibold">{displayName}</h3>
                        <span className="text-xs text-blue-500">{chat.isOnline ? 'Online' : 'Offline'}</span>
                    </div>
                </div>

                <div className="flex items-center gap-4 text-gray-500">
                    {isSearching ? (
                        <div className="flex items-center bg-gray-100 rounded-full px-3 py-1 animate-in fade-in slide-in-from-right-5">
                            <input
                                autoFocus
                                type="text"
                                placeholder="Search..."
                                value={localSearchQuery}
                                onChange={(e) => setLocalSearchQuery(e.target.value)}
                                className="bg-transparent border-none outline-none text-sm w-32 md:w-48 text-gray-700 placeholder-gray-400"
                                onKeyDown={(e) => {
                                    if (e.key === 'Escape') {
                                        setIsSearching(false);
                                        setLocalSearchQuery('');
                                        onSearchChange('');
                                    }
                                }}
                            />
                            <button onClick={() => { setIsSearching(false); setLocalSearchQuery(''); onSearchChange(''); }} className="ml-2 hover:text-gray-700">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    ) : (
                        <Search className="h-5 w-5 cursor-pointer hover:text-gray-700" onClick={() => setIsSearching(true)} />
                    )}
                    <Phone className="h-5 w-5 cursor-pointer hover:text-gray-700" />

                    {/* Menu with Click Toggle */}
                    <div className="relative" ref={menuRef}>
                        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="focus:outline-none">
                            <MoreVertical className="h-5 w-5 cursor-pointer hover:text-gray-700" />
                        </button>
                        {isMenuOpen && otherParticipant && (
                            <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-100 animate-in fade-in zoom-in-95 duration-100">
                                <button
                                    onClick={handleBlockAction}
                                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                    {isBlocked ? "Unblock User" : "Block User"}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Messages Area */}
            <div ref={messagesContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 flex flex-col gap-1 relative">
                {isLoadingMessages ? (
                    <div className="flex justify-center p-4">Loading messages...</div>
                ) : (
                    <>
                        {displayMessages.map(msg => (
                            <MessageBubble
                                key={msg.id}
                                message={msg}
                                onRecallMessage={onRecallMessage}
                                onClick={isSearching ? () => handleJumpToMessage(msg.id) : undefined}
                            />
                        ))}
                        {!isSearching && <div ref={messagesEndRef} />}
                    </>
                )}
                {showScrollButton && (
                    <button onClick={scrollToBottom} className="sticky bottom-4 ml-auto mr-4 bg-[#2AABEE] rounded-full p-2 shadow-md hover:shadow-lg transition-all z-10 w-8 h-8 flex items-center justify-center">
                        <ChevronDown className="h-4 w-4 text-white" />
                        {hasNewMessage && <span className="absolute -top-0.5 -right-0.5 bg-red-500 rounded-full w-3 h-3"></span>}
                    </button>
                )}
            </div>

            {/* Input / Block Status */}
            {(() => {
                if (isBlocked) {
                    return (
                        <div className="p-4 bg-gray-50 text-center text-gray-500 text-sm mb-4 rounded-xl border border-gray-100 shadow-sm mx-auto w-full max-w-4xl">
                            You have blocked this user. <button onClick={() => otherParticipant && onUnblockUser(otherParticipant.id)} className="text-blue-500 hover:underline">Unblock</button> to send messages.
                        </div>
                    );
                }
                if (amIBlocked) {
                    return (
                        <div className="p-4 bg-red-50 text-center text-red-500 text-sm mb-4 rounded-xl border border-red-100 shadow-sm mx-auto w-full max-w-4xl">
                            You have been blocked by this user. You cannot send messages.
                        </div>
                    );
                }
                return (
                    <div className="bg-white p-3 max-w-4xl mx-auto w-full mb-4 rounded-xl shadow-lg border border-gray-100">
                        {selectedFiles.length > 0 && (
                            <div className="mb-3">
                                <FilePreview files={selectedFiles} onRemove={handleRemoveFile} />
                            </div>
                        )}
                        <div className="flex items-end gap-3">
                            <div className="relative" ref={emojiPickerRef}>
                                <button className="text-gray-500 hover:text-gray-700 p-2" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                                    <Smile className="h-6 w-6" />
                                </button>
                                {showEmojiPicker && (
                                    <div className="absolute bottom-12 left-0 z-50">
                                        <EmojiPicker onEmojiClick={onEmojiClick} />
                                    </div>
                                )}
                            </div>
                            <input
                                type="text"
                                placeholder="Message"
                                value={messageInput}
                                onChange={(e) => onMessageInputChange(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSendWithFiles()}
                                className="flex-1 py-2 bg-transparent focus:outline-none resize-none"
                            />
                            <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} className="hidden" />
                            <button className="text-gray-500 hover:text-gray-700 p-2" onClick={() => fileInputRef.current?.click()}>
                                <Paperclip className="h-6 w-6" />
                            </button>
                            {messageInput.trim() || selectedFiles.length > 0 ? (
                                <button onClick={handleSendWithFiles} className="p-2 text-[#2AABEE] hover:text-[#229ED9] transition-colors">
                                    <Send className="h-6 w-6" />
                                </button>
                            ) : (
                                <button className="p-2 text-gray-400 hover:text-gray-600">
                                    <Mic className="h-6 w-6" />
                                </button>
                            )}
                        </div>
                    </div>
                );
            })()}

            {/* Drag and Drop Overlay */}
            {isDragging && (
                <div className="absolute inset-0 bg-blue-500 bg-opacity-20 backdrop-blur-sm z-40 flex items-center justify-center border-4 border-dashed border-blue-500">
                    <div className="bg-white rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-4">
                        <div className="bg-blue-100 rounded-full p-6">
                            <Paperclip className="h-16 w-16 text-blue-500" />
                        </div>
                        <div className="text-center">
                            <h3 className="text-2xl font-bold text-gray-800 mb-2">Drag and drop your files</h3>
                            <p className="text-gray-600">Support image, PDF, Word, Excel...</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Block Confirmation Modal */}
            {showBlockConfirm && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm animate-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Block this user?</h3>
                        <p className="text-gray-500 mb-6 leading-relaxed">
                            They will not be able to send you messages.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowBlockConfirm(false)}
                                className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    if (otherParticipant) onBlockUser(otherParticipant.id);
                                    setShowBlockConfirm(false);
                                }}
                                className="px-5 py-2.5 bg-red-500 text-white hover:bg-red-600 rounded-xl font-medium shadow-md hover:shadow-lg transition-all"
                            >
                                Block User
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
