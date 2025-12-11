import { useState, useEffect } from 'react';
import {
    Search, MoreVertical, Paperclip,
    Smile, Mic, Phone, Send
} from 'lucide-react';
import { cn } from '../components/ui';
import { SidebarItem } from '../components/chat/SidebarItem';
import { MessageBubble } from '../components/chat/MessageBubble';
import { UserMenu } from '../components/chat/UserMenu';
import { chatService } from '../services/chatService';
import { userService } from '../services/userService';
import { webSocketService } from '../services/websocketService';
import { useAuth } from '../contexts/AuthContext';
import type { Chat, Message, User } from '../types';

const HomePage = () => {
    const { user } = useAuth();
    const [chats, setChats] = useState<Chat[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [messageInput, setMessageInput] = useState('');
    const [isLoadingChats, setIsLoadingChats] = useState(false);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);

    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<User[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showSearchResults, setShowSearchResults] = useState(false);

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

    }, [selectedChatId, user?.id]);

    // WebSocket Connection & Real-time Updates
    useEffect(() => {
        if (!user) return;

        // Connect to WebSocket
        const token = localStorage.getItem('token'); // Or however we get the token strictly
        if (token) {
            webSocketService.connect(token);
        }

        // Handle incoming messages
        const removeListener = webSocketService.addMessageHandler((msg: Message) => {
            // Recompute isIncoming based on current user
            const isIncoming = msg.senderId !== user.id;
            const processedMsg = { ...msg, isIncoming };

            // 1. Update Messages Area if chat is open
            if (selectedChatId === msg.chatId) {
                setMessages(prev => {
                    // Deduplicate based on ID
                    if (prev.some(m => m.id === msg.id)) {
                        return prev;
                    }
                    return [...prev, processedMsg];
                });
            }

            // 2. Update Chat List (Sidebar)
            setChats(prevChats => {
                const chatIndex = prevChats.findIndex(c => c.id === msg.chatId);
                if (chatIndex === -1) {
                    // Start new chat scenario: Ideally fetch chat details or partial update
                    // For now, if chat not in list, we might need to fetch it or ignore
                    // A simple fetch logic could be triggered here if needed.
                    // Let's just ignore for now or move to top if found.
                    return prevChats;
                }

                const updatedChat = {
                    ...prevChats[chatIndex],
                    lastMessage: processedMsg.text,
                    time: processedMsg.time,
                    unreadCount: (selectedChatId !== msg.chatId) ? (prevChats[chatIndex].unreadCount || 0) + 1 : 0
                };

                // Move to top
                const newChats = [...prevChats];
                newChats.splice(chatIndex, 1);
                return [updatedChat, ...newChats];
            });
        });

        return () => {
            removeListener();
            webSocketService.disconnect();
        };
    }, [user, selectedChatId]); // Re-run if user changes. selectedChatId dependency strictly not needed for listener definition but safe.

    // Search users
    // Search users (and suggestions)
    useEffect(() => {
        const searchUsers = async () => {
            setIsSearching(true);
            try {
                const results = await userService.searchUsers(searchQuery);
                setSearchResults(results);
            } catch (error) {
                console.error("Failed to search users:", error);
            } finally {
                setIsSearching(false);
            }
        };

        const timeoutId = setTimeout(searchUsers, 500);
        return () => clearTimeout(timeoutId);
    }, [searchQuery]);

    const handleUserSelect = async (selectedUser: User) => {
        // Close search results
        setShowSearchResults(false);
        setSearchQuery('');

        try {
            // Check if chat already exists
            const existingChat = chats.find(c =>
                !c.isGroup && c.participants?.some(p => p.id === selectedUser.id)
            );

            if (existingChat) {
                handleChatSelect(existingChat.id);
            } else {
                // Create new chat
                const newChat = await chatService.createChat(selectedUser.id);
                setChats(prev => [newChat, ...prev]);
                handleChatSelect(newChat.id);
            }
        } catch (error) {
            console.error("Failed to start chat:", error);
        }
    };

    const handleChatSelect = (id: string) => {
        setSelectedChatId(id);
        if (window.innerWidth < 768) {
            setIsSidebarOpen(false);
        }
    };

    const handleSendMessage = async () => {
        if (!messageInput.trim() || !selectedChatId) return;

        try {
            await chatService.sendMessage(selectedChatId, messageInput);
            // setMessages handled by WebSocket listener
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
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onFocus={() => setShowSearchResults(true)}
                            onBlur={() => setTimeout(() => setShowSearchResults(false), 200)} // Delay to allow click
                            className="w-full rounded-full bg-gray-100 py-2 pl-10 pr-4 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2AABEE]"
                        />

                        {/* Search Results Dropdown */}
                        {showSearchResults && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-100 z-50 max-h-64 overflow-y-auto">
                                {!searchQuery && searchResults.length > 0 && (
                                    <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-50 border-b border-gray-100">
                                        Suggested Users
                                    </div>
                                )}

                                {isSearching ? (
                                    <div className="p-4 text-center text-gray-500 text-sm">Searching...</div>
                                ) : searchResults.length > 0 ? (
                                    searchResults.map(result => (
                                        <div
                                            key={result.id}
                                            onMouseDown={(e) => e.preventDefault()} // Prevent blur before click
                                            onClick={() => handleUserSelect(result)}
                                            className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                                        >
                                            <div className="w-8 h-8 rounded-full bg-[#2AABEE] text-white flex items-center justify-center text-sm font-medium">
                                                {result.avatar ? (
                                                    <img src={result.avatar} alt={result.username} className="w-full h-full rounded-full object-cover" />
                                                ) : (
                                                    result.username.charAt(0).toUpperCase()
                                                )}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-gray-900">{result.username}</span>
                                            </div>
                                        </div>
                                    ))
                                ) : searchQuery ? (
                                    <div className="p-4 text-center text-gray-500 text-sm">User not found</div>
                                ) : (
                                    <div className="p-4 text-center text-gray-500 text-sm">No users available</div>
                                )}
                            </div>
                        )}
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
                        {messageInput.trim() ? (
                            <button
                                onClick={handleSendMessage}
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
