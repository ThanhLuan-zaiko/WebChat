import { useState, useEffect } from 'react';
import { chatService } from '../services/chatService';
import { webSocketService } from '../services/websocketService';
import type { Chat, Message, User } from '../types';

export const useChat = (user: User | null) => {
    const [chats, setChats] = useState<Chat[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
    const [selectedUserForNewChat, setSelectedUserForNewChat] = useState<User | null>(null);
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
        const token = localStorage.getItem('token');
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
                    // Chat not in list - fetch it from backend
                    chatService.getChats().then(updatedChats => {
                        setChats(updatedChats);
                    }).catch(error => {
                        console.error("Failed to fetch updated chats:", error);
                    });
                    return prevChats;
                }

                const updatedChat = {
                    ...prevChats[chatIndex],
                    lastMessage: processedMsg.text,
                    time: processedMsg.time,
                    // Only increase unread count if:
                    // 1. Message is incoming (from someone else)
                    // 2. Chat is NOT currently open
                    unreadCount: (isIncoming && selectedChatId !== msg.chatId)
                        ? (prevChats[chatIndex].unreadCount || 0) + 1
                        : (selectedChatId === msg.chatId ? 0 : prevChats[chatIndex].unreadCount || 0)
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
    }, [user, selectedChatId]);

    const handleChatSelect = (id: string) => {
        setSelectedChatId(id);
        setSelectedUserForNewChat(null);

        // Call backend to mark as read (update last_read_at)
        chatService.markAsRead(id).catch(error => {
            console.error("Failed to mark chat as read:", error);
        });

        // Reset unread count locally
        setChats(prevChats =>
            prevChats.map(chat =>
                chat.id === id ? { ...chat, unreadCount: 0 } : chat
            )
        );
    };

    const handleSendMessage = async () => {
        if (!messageInput.trim()) return;

        try {
            // If this is a new chat (no ID yet), create it first
            if (selectedUserForNewChat && !selectedChatId) {
                const newChat = await chatService.createChat(selectedUserForNewChat.id);
                setChats(prev => [newChat, ...prev]);
                setSelectedChatId(newChat.id);
                setSelectedUserForNewChat(null);

                // Send message to the newly created chat
                await chatService.sendMessage(newChat.id, messageInput);
            } else if (selectedChatId) {
                // Normal flow: send message to existing chat
                await chatService.sendMessage(selectedChatId, messageInput);
            } else {
                return; // No chat selected and no new user
            }

            // setMessages handled by WebSocket listener
            setMessageInput('');
        } catch (error) {
            console.error("Failed to send message:", error);
        }
    };

    const handleUserSelect = (selectedUser: User) => {
        // Check if chat already exists
        const existingChat = chats.find(c =>
            !c.isGroup && c.participants?.some(p => p.id === selectedUser.id)
        );

        if (existingChat) {
            handleChatSelect(existingChat.id);
        } else {
            // Don't create chat yet - wait until first message is sent
            setSelectedChatId(null);
            setSelectedUserForNewChat(selectedUser);
            setMessages([]);
        }
    };

    const selectedChat = chats.find(c => c.id === selectedChatId);

    return {
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
        handleUserSelect,
    };
};
