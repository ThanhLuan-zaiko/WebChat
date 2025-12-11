import { Search, MoreVertical, Paperclip, Smile, Mic, Phone, Send } from 'lucide-react';
import { cn } from '../ui';
import { MessageBubble } from './MessageBubble';
import type { Chat, Message } from '../../types';

interface ChatAreaProps {
    chat: Chat | undefined;
    displayName: string;
    messages: Message[];
    messageInput: string;
    onMessageInputChange: (value: string) => void;
    onSendMessage: () => void;
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
}: ChatAreaProps) => (
    <div className={cn(
        "flex flex-col bg-[#87A985] bg-opacity-20 bg-[url('https://web.telegram.org/img/bg_0.png')] w-full",
        isSidebarOpen && "hidden md:flex"
    )}>
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
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-1">
            {isLoadingMessages ? (
                <div className="flex justify-center p-4">Loading messages...</div>
            ) : (
                messages.map(msg => (
                    <MessageBubble key={msg.id} message={msg} />
                ))
            )}
        </div>

        {/* Input Area */}
        <div className="bg-white p-3 flex items-end gap-3 max-w-4xl mx-auto w-full mb-4 rounded-xl shadow-lg border border-gray-100">
            <button className="text-gray-500 hover:text-gray-700 p-2">
                <Smile className="h-6 w-6" />
            </button>
            <input
                type="text"
                placeholder="Message"
                value={messageInput}
                onChange={(e) => onMessageInputChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onSendMessage()}
                className="flex-1 py-2 bg-transparent focus:outline-none resize-none"
            />
            <button className="text-gray-500 hover:text-gray-700 p-2">
                <Paperclip className="h-6 w-6" />
            </button>
            {messageInput.trim() ? (
                <button
                    onClick={onSendMessage}
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
);
