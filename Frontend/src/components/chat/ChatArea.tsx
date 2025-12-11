import { useRef, useState, useEffect } from 'react';
import { Search, MoreVertical, Paperclip, Smile, Mic, Phone, Send, ChevronDown } from 'lucide-react';
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
    isLoadingMessages: boolean;
    isSidebarOpen: boolean;
    onBackClick: () => void;
}

export const ChatArea = ({
    chat,
    displayName,
    messages,
    messageInput,
    onMessageInputChange,
    onSendMessage,
    isLoadingMessages,
    isSidebarOpen,
    onBackClick
}: ChatAreaProps) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const [hasNewMessage, setHasNewMessage] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        setHasNewMessage(false);
    };

    const checkIfNearBottom = () => {
        const container = messagesContainerRef.current;
        if (!container) return true; // Default to true if no container

        const threshold = 100; // pixels from bottom
        const isNearBottom =
            container.scrollHeight - container.scrollTop - container.clientHeight < threshold;

        return isNearBottom;
    };

    const handleScroll = () => {
        const isNearBottom = checkIfNearBottom();
        setShowScrollButton(!isNearBottom && messages.length > 0);

        // Clear new message indicator if scrolled to bottom
        if (isNearBottom) {
            setHasNewMessage(false);
        }
    };

    // Auto scroll logic when messages change
    useEffect(() => {
        if (messages.length === 0) return;

        const isNearBottom = checkIfNearBottom();
        const lastMessage = messages[messages.length - 1];
        const isOutgoing = lastMessage && !lastMessage.isIncoming;

        // Always scroll when user sends message (outgoing) OR when user is near bottom
        if (isOutgoing || isNearBottom) {
            scrollToBottom();
        } else {
            // User is scrolled up viewing old messages - show new message indicator
            setHasNewMessage(true);
        }
    }, [messages]);

    // Initial scroll to bottom when messages first load
    useEffect(() => {
        if (!isLoadingMessages && messages.length > 0) {
            // Use setTimeout to ensure DOM is rendered
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
            }, 100);
        }
    }, [isLoadingMessages]);

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files && files.length > 0) {
            const fileArray = Array.from(files);
            setSelectedFiles(prev => [...prev, ...fileArray]);
        }
        // Reset input so same file can be selected again
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleRemoveFile = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleSendWithFiles = () => {
        if (messageInput.trim() || selectedFiles.length > 0) {
            onSendMessage(selectedFiles);
            setSelectedFiles([]);
        }
    };

    // Drag and drop handlers
    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        // Only set dragging to false if leaving the main container
        if (e.currentTarget === e.target) {
            setIsDragging(false);
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const droppedFiles = Array.from(e.dataTransfer.files);
        if (droppedFiles.length > 0) {
            setSelectedFiles(prev => [...prev, ...droppedFiles]);
        }
    };

    return (
        <div
            className={cn(
                "flex flex-col bg-[#87A985] bg-opacity-20 bg-[url('https://web.telegram.org/img/bg_0.png')] w-full relative",
                isSidebarOpen && "hidden md:flex"
            )}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* Chat Header */}
            <div className="flex items-center justify-between bg-white px-4 py-2 border-b border-gray-200">
                <div className="flex items-center gap-3">
                    <button
                        className="md:hidden text-gray-500 mr-2"
                        onClick={onBackClick}
                    >
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </button>
                    <div className="flex flex-col">
                        <h3 className="font-semibold">{displayName}</h3>
                        <span className="text-xs text-blue-500">{chat?.isOnline ? 'Online' : 'Offline'}</span>
                    </div>
                </div>
                <div className="flex items-center gap-4 text-gray-500">
                    <Search className="h-5 w-5 cursor-pointer hover:text-gray-700" />
                    <Phone className="h-5 w-5 cursor-pointer hover:text-gray-700" />
                    <MoreVertical className="h-5 w-5 cursor-pointer hover:text-gray-700" />
                </div>
            </div>

            {/* Messages Area */}
            <div
                ref={messagesContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-4 flex flex-col gap-1 relative"
            >
                {isLoadingMessages ? (
                    <div className="flex justify-center p-4">Loading messages...</div>
                ) : (
                    <>
                        {messages.map(msg => (
                            <MessageBubble key={msg.id} message={msg} />
                        ))}
                        <div ref={messagesEndRef} />
                    </>
                )}

                {/* Scroll to Bottom Button */}
                {showScrollButton && (
                    <button
                        onClick={scrollToBottom}
                        className="sticky bottom-4 ml-auto mr-4 bg-[#2AABEE] rounded-full p-2 shadow-md hover:shadow-lg transition-all z-10 w-8 h-8 flex items-center justify-center"
                    >
                        <ChevronDown className="h-4 w-4 text-white" />
                        {hasNewMessage && (
                            <span className="absolute -top-0.5 -right-0.5 bg-red-500 rounded-full w-3 h-3"></span>
                        )}
                    </button>
                )}
            </div>

            {/* Input Area */}
            <div className="bg-white p-3 max-w-4xl mx-auto w-full mb-4 rounded-xl shadow-lg border border-gray-100">
                {/* File Preview */}
                {selectedFiles.length > 0 && (
                    <div className="mb-3">
                        <FilePreview files={selectedFiles} onRemove={handleRemoveFile} />
                    </div>
                )}

                {/* Input Row */}
                <div className="flex items-end gap-3">
                    <button className="text-gray-500 hover:text-gray-700 p-2">
                        <Smile className="h-6 w-6" />
                    </button>
                    <input
                        type="text"
                        placeholder="Message"
                        value={messageInput}
                        onChange={(e) => onMessageInputChange(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendWithFiles()}
                        className="flex-1 py-2 bg-transparent focus:outline-none resize-none"
                    />
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        onChange={handleFileSelect}
                        className="hidden"
                        accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    />
                    <button
                        className="text-gray-500 hover:text-gray-700 p-2"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <Paperclip className="h-6 w-6" />
                    </button>
                    {messageInput.trim() || selectedFiles.length > 0 ? (
                        <button
                            onClick={handleSendWithFiles}
                            className="p-2 text-[#2AABEE] hover:text-[#229ED9] transition-colors"
                        >
                            <Send className="h-6 w-6" />
                        </button>
                    ) : (
                        <button className="p-2 text-gray-400 hover:text-gray-600">
                            <Mic className="h-6 w-6" />
                        </button>
                    )}
                </div>
            </div>

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
        </div>
    );
};
