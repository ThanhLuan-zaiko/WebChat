import { useState, useEffect } from 'react';
import {
    Search, MoreVertical, Paperclip,
    Smile, Mic, Phone
} from 'lucide-react';
import { cn } from '../components/ui';
import { SidebarItem } from '../components/chat/SidebarItem';
import { MessageBubble } from '../components/chat/MessageBubble';
import { UserMenu } from '../components/chat/UserMenu';
import type { Chat, Message } from '../types';
import { chatService } from '../services/chatService';
import { useAuth } from '../contexts/AuthContext';

const HomePage = () => {
    const { user } = useAuth();
    const [chats, setChats] = useState<Chat[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [messageInput, setMessageInput] = useState('');
    const [isLoadingChats, setIsLoadingChats] = useState(false);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);

    // Fetch chats on mount
    useEffect(() => {
        const fetchChats = async () => {
            try {
                setIsLoadingChats(true);
                const data = await chatService.getChats();
                setChats(data);
            } catch (error) {
                console.error("Failed to fetch chats:", error);
                // Optionally handle error UI here
            } finally {
                setIsLoadingChats(false);
            }
        };

        fetchChats();
    }, []);

    // Fetch messages when a chat is selected
    useEffect(() => {
        if (!selectedChatId) return;

        const fetchMessages = async () => {
            try {
                setIsLoadingMessages(true);
                const data = await chatService.getMessages(selectedChatId);
                // Map senderId to isIncoming if necessary, or assume backend provides it.
                // If backend provides raw data, we might need to map it:
                // const mappedMessages = data.map(m => ({ ...m, isIncoming: m.senderId !== user?.id }));
                setMessages(data);
            } catch (error) {
                console.error("Failed to fetch messages:", error);
            } finally {
                setIsLoadingMessages(false);
            }
        };

        fetchMessages();

        // Polling for new messages (simple real-time simulation)
        const interval = setInterval(fetchMessages, 3000);
        return () => clearInterval(interval);

    }, [selectedChatId, user?.id]);

    const handleChatSelect = (id: string) => {
        setSelectedChatId(id);
        if (window.innerWidth < 768) {
            setIsSidebarOpen(false);
        }
    };

    const handleSendMessage = async () => {
        if (!messageInput.trim() || !selectedChatId) return;

        try {
            const newMessage = await chatService.sendMessage(selectedChatId, messageInput);
            setMessages(prev => [...prev, newMessage]);
            setMessageInput('');
        } catch (error) {
            console.error("Failed to send message:", error);
        }
    };

    const selectedChat = chats.find(c => c.id === selectedChatId);

    return (
        <div className="flex h-screen overflow-hidden bg-white">
            {/* Sidebar */}
            <div className={cn(
                "flex flex-col border-r border-gray-200 bg-white transition-all duration-300 ease-in-out md:w-80 lg:w-96",
                selectedChatId && !isSidebarOpen ? "hidden md:flex" : "w-full flex"
            )}>
                {/* Sidebar Header */}
                <div className="flex items-center gap-4 px-4 py-3">
                    <UserMenu />
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search"
                            className="w-full rounded-full bg-gray-100 py-2 pl-10 pr-4 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2AABEE]"
                        />
                    </div>
                </div>

                {/* Chat List */}
                <div className="flex-1 overflow-y-auto space-y-1 py-2">
                    {isLoadingChats ? (
                        <div className="flex justify-center p-4">Loading...</div>
                    ) : chats.length === 0 ? (
                        <div className="flex justify-center p-4 text-gray-500">No chats found</div>
                    ) : (
                        chats.map(chat => (
                            <SidebarItem
                                key={chat.id}
                                chat={chat}
                                isSelected={selectedChatId === chat.id}
                                onClick={() => handleChatSelect(chat.id)}
                            />
                        ))
                    )}
                </div>
            </div>

            {/* Chat Area */}
            {selectedChatId ? (
                <div className={cn(
                    "flex flex-col bg-[#87A985] bg-opacity-20 bg-[url('https://web.telegram.org/img/bg_0.png')] w-full",
                    isSidebarOpen && "hidden md:flex"
                )}>
                    {/* Chat Header */}
                    <div className="flex items-center justify-between bg-white px-4 py-2 border-b border-gray-200">
                        <div className="flex items-center gap-3">
                            <button
                                className="md:hidden text-gray-500 mr-2"
                                onClick={() => setIsSidebarOpen(true)}
                            >
                                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                            </button>
                            <div className="flex flex-col">
                                <h3 className="font-semibold">{selectedChat?.name || 'Chat'}</h3>
                                <span className="text-xs text-blue-500">{selectedChat?.isOnline ? 'Online' : 'Offline'}</span>
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
                            onChange={(e) => setMessageInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                            className="flex-1 py-2 bg-transparent focus:outline-none resize-none"
                        />
                        <button className="text-gray-500 hover:text-gray-700 p-2">
                            <Paperclip className="h-6 w-6" />
                        </button>
                        <button
                            onClick={handleSendMessage}
                            className={cn("p-2", messageInput.trim() ? "text-[#2AABEE] hover:text-[#229ED9]" : "text-gray-400")}
                        >
                            <Mic className="h-6 w-6" />
                        </button>
                    </div>
                </div>
            ) : (
                /* Empty State (Desktop) */
                <div className="hidden md:flex flex-1 items-center justify-center bg-gray-50 flex-col gap-4">
                    <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center text-gray-400">
                        <span className="text-4xl font-bold">W</span>
                    </div>
                    <p className="text-gray-500 bg-gray-200 px-4 py-1 rounded-full text-sm">
                        Select a chat to start messaging
                    </p>
                </div>
            )}
        </div>
    );
};

export default HomePage;
