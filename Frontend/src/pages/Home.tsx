
import { useState } from 'react';
import {
    Menu, Search, MoreVertical, Paperclip,
    Smile, Mic, Phone, CheckCheck
} from 'lucide-react';
// import { useAuth } from '../contexts/AuthContext';
import { cn } from '../components/ui';

// Mock Data
const MOCK_CHATS = [
    {
        id: '1',
        name: 'Telegram',
        avatar: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Telegram_logo.svg/1024px-Telegram_logo.svg.png',
        lastMessage: 'Login code: 24058. Do not give this code to anyone.',
        time: '20:57',
        unreadCount: 0,
        isOnline: true,
        isVerified: true
    },
    {
        id: '2',
        name: 'Frontend Team',
        avatar: 'https://ui-avatars.com/api/?name=FT&background=random',
        lastMessage: 'Alice: Have you checked the latest PR?',
        time: '18:30',
        unreadCount: 3,
        isGroup: true
    },
    {
        id: '3',
        name: 'John Doe',
        avatar: 'https://ui-avatars.com/api/?name=John+Doe&background=random',
        lastMessage: 'Sure, let\'s meet tomorrow.',
        time: 'Yesterday',
        unreadCount: 0,
        isOnline: false
    }
];

const MOCK_MESSAGES = [
    {
        id: 'm1',
        sender: 'Telegram',
        text: 'Login code: 24058. Do not give this code to anyone, even if they say they are from Telegram!\n\nThis code can be used to log in to your Telegram account. We never ask it for anything else.\n\nIf you didn\'t request this code by trying to log in on another device, simply ignore this message.',
        time: '20:57',
        isIncoming: true
    },
    {
        id: 'm2',
        sender: 'Me',
        text: 'Thanks!',
        time: '20:58',
        isIncoming: false,
        isRead: true
    }
];

const SidebarItem = ({ chat, isSelected, onClick }: any) => (
    <div
        onClick={onClick}
        className={cn(
            "flex cursor-pointer items-center p-2 rounded-lg transition-colors mx-2",
            isSelected ? "bg-[#2AABEE] text-white" : "hover:bg-gray-100"
        )}
    >
        <img
            src={chat.avatar}
            alt={chat.name}
            className="h-12 w-12 rounded-full object-cover mr-3"
        />
        <div className="flex-1 min-w-0">
            <div className="flex justify-between items-baseline">
                <h3 className="font-semibold truncate">{chat.name}</h3>
                <span className={cn("text-xs", isSelected ? "text-blue-100" : "text-gray-500")}>
                    {chat.time}
                </span>
            </div>
            <p className={cn("text-sm truncate", isSelected ? "text-blue-100" : "text-gray-500")}>
                {chat.lastMessage}
            </p>
        </div>
        {chat.unreadCount > 0 && (
            <div className={cn(
                "ml-2 min-w-[20px] h-5 rounded-full flex items-center justify-center text-xs font-bold px-1.5",
                isSelected ? "bg-white text-[#2AABEE]" : "bg-gray-400 text-white"
            )}>
                {chat.unreadCount}
            </div>
        )}
    </div>
);

const MessageBubble = ({ message }: any) => (
    <div className={cn(
        "flex mb-2 max-w-[80%]",
        message.isIncoming ? "self-start" : "self-end"
    )}>
        {!message.isIncoming && <div className="flex-1" />}
        <div className={cn(
            "px-3 py-1.5 rounded-lg shadow-sm relative",
            message.isIncoming ? "bg-white rounded-tl-none" : "bg-[#EFFDDE] rounded-tr-none"
        )}>
            <p className="whitespace-pre-wrap text-[15px]">{message.text}</p>
            <div className="flex justify-end items-center gap-1 mt-1">
                <span className={cn("text-xs", message.isIncoming ? "text-gray-500" : "text-[#4fae4e]")}>
                    {message.time}
                </span>
                {!message.isIncoming && <CheckCheck className="h-3 w-3 text-[#4fae4e]" />}
            </div>
        </div>
    </div>
);

const HomePage = () => {
    // const { user } = useAuth(); // Unused for now

    const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    // Layout Logic:
    // Mobile: If chat selected -> Sidebar hidden, Chat visible
    // Desktop: Sidebar visible, Chat visible if selected

    const handleChatSelect = (id: string) => {
        setSelectedChatId(id);
        // On mobile, close sidebar after selection
        if (window.innerWidth < 768) {
            setIsSidebarOpen(false);
        }
    };

    return (
        <div className="flex h-screen overflow-hidden bg-white">
            {/* Sidebar - Visible if open OR desktop */}
            <div className={cn(
                "flex flex-col border-r border-gray-200 bg-white transition-all duration-300 ease-in-out md:w-80 lg:w-96",
                selectedChatId && !isSidebarOpen ? "hidden md:flex" : "w-full flex"
            )}>
                {/* Sidebar Header */}
                <div className="flex items-center gap-4 px-4 py-3">
                    <button className="text-gray-500 hover:text-gray-700">
                        <Menu className="h-6 w-6" />
                    </button>
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
                    {MOCK_CHATS.map(chat => (
                        <SidebarItem
                            key={chat.id}
                            chat={chat}
                            isSelected={selectedChatId === chat.id}
                            onClick={() => handleChatSelect(chat.id)}
                        />
                    ))}
                </div>
            </div>

            {/* Chat Area - Visible if chat selected */}
            {selectedChatId ? (
                <div className={cn(
                    "flex flex-col bg-[#87A985] bg-opacity-20 bg-[url('https://web.telegram.org/img/bg_0.png')] w-full",
                    isSidebarOpen && "hidden md:flex" // Hide on mobile if sidebar is open
                )}>
                    {/* Chat Header */}
                    <div className="flex items-center justify-between bg-white px-4 py-2 border-b border-gray-200">
                        <div className="flex items-center gap-3">
                            {/* Back Button (Mobile) */}
                            <button
                                className="md:hidden text-gray-500 mr-2"
                                onClick={() => setIsSidebarOpen(true)}
                            >
                                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                            </button>
                            <div className="flex flex-col">
                                <h3 className="font-semibold">Telegram</h3>
                                <span className="text-xs text-blue-500">Service notifications</span>
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
                        {MOCK_MESSAGES.map(msg => (
                            <MessageBubble key={msg.id} message={msg} />
                        ))}
                    </div>

                    {/* Input Area */}
                    <div className="bg-white p-3 flex items-end gap-3 max-w-4xl mx-auto w-full mb-4 rounded-xl shadow-lg border border-gray-100">
                        <button className="text-gray-500 hover:text-gray-700 p-2">
                            <Smile className="h-6 w-6" />
                        </button>
                        <input
                            type="text"
                            placeholder="Message"
                            className="flex-1 py-2 bg-transparent focus:outline-none resize-none"
                        />
                        <button className="text-gray-500 hover:text-gray-700 p-2">
                            <Paperclip className="h-6 w-6" />
                        </button>
                        {/* Mic shows if empty, Send shows if typing. For mock, just show Mic */}
                        <button className="text-[#2AABEE] hover:text-[#229ED9] p-2">
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
