import { useRef, useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import type { Message } from '../../types';

interface MessageListProps {
    messages: Message[];
    isLoading: boolean;
    onRecallMessage: (messageId: string) => void;
    isSearching: boolean;
    onJumpToMessage: (messageId: string) => void;
    isGroup: boolean;
}

export const MessageList = ({
    messages,
    isLoading,
    onRecallMessage,
    isSearching,
    onJumpToMessage,
    isGroup
}: MessageListProps) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const [hasNewMessage, setHasNewMessage] = useState(false);

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
        if (!isLoading && messages.length > 0) {
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
            }, 100);
        }
    }, [isLoading]);

    return (
        <div ref={messagesContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 flex flex-col gap-1 relative">
            {isLoading ? (
                <div className="flex justify-center p-4">Loading messages...</div>
            ) : (
                <>
                    {messages.map(msg => (
                        <MessageBubble
                            key={msg.id}
                            message={msg}
                            onRecallMessage={onRecallMessage}
                            onClick={isSearching ? () => onJumpToMessage(msg.id) : undefined}
                            isGroup={isGroup}
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
    );
};
