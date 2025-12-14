import { useState, useEffect } from 'react';
import axios from 'axios';
import { chatService } from '../services/chatService';
import { webSocketService } from '../services/websocketService';
import type { Chat, Message, User } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

export const useChat = (user: User | null) => {
    const [chats, setChats] = useState<Chat[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
    const [selectedUserForNewChat, setSelectedUserForNewChat] = useState<User | null>(null);
    const [messageInput, setMessageInput] = useState('');
    const [messageSearchQuery, setMessageSearchQuery] = useState(''); // New state for search
    const [searchResults, setSearchResults] = useState<Message[]>([]); // Separated search results
    const [isLoadingChats, setIsLoadingChats] = useState(false);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [isSearchingMessages, setIsSearchingMessages] = useState(false);
    const [blockedUsers, setBlockedUsers] = useState<string[]>([]);

    // Fetch chats on mount
    useEffect(() => {
        const fetchChats = async () => {
            try {
                setIsLoadingChats(true);
                const [chatsData, blockedData] = await Promise.all([
                    chatService.getChats(),
                    chatService.getBlockedUsers()
                ]);
                setChats(chatsData);
                setBlockedUsers(blockedData.map((u: any) => u.id));
            } catch (error) {
                console.error("Failed to fetch data:", error);
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
                // Always fetch full messages for the chat history
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

    // Search Messages Effect
    useEffect(() => {
        if (!selectedChatId || !messageSearchQuery.trim()) {
            setSearchResults([]);
            return;
        }

        const searchMessages = async () => {
            try {
                setIsSearchingMessages(true);
                const data = await chatService.getMessages(selectedChatId, messageSearchQuery);
                setSearchResults(data);
            } catch (error) {
                console.error("Failed to search messages:", error);
            } finally {
                setIsSearchingMessages(false);
            }
        };

        const debounce = setTimeout(() => {
            searchMessages();
        }, 300);

        return () => clearTimeout(debounce);
    }, [selectedChatId, messageSearchQuery]);

    // WebSocket Connection & Real-time Updates
    useEffect(() => {
        if (!user) return;

        // Connect to WebSocket
        const token = localStorage.getItem('token');
        if (token) {
            webSocketService.connect(token);
        }

        // Handle incoming messages
        const removeListener = webSocketService.addMessageHandler((msg: Message | any) => {
            // Handle specific message update type (like recall)
            if (msg.type === 'message_update') {
                setMessages(prev => prev.map(m =>
                    m.id === msg.id
                        ? { ...m, isRecalled: true, text: '', attachments: [] }
                        : m
                ));

                // Update sidebar preview if it was the last message
                setChats(prevChats => prevChats.map(c => {
                    if (c.id === msg.chatId && c.lastMessage) {
                        return c;
                    }
                    return c;
                }));
                return;
            }

            // Handle user status change
            if (msg.type === 'user_status_change') {
                const { userId, isOnline } = msg;
                setChats(prevChats => prevChats.map(chat => {
                    const hasParticipant = chat.participants?.some(p => p.id === userId);
                    if (!chat.isGroup && hasParticipant) {
                        return { ...chat, isOnline };
                    }
                    return chat;
                }));
                return;
            }

            // Handle block status update
            if (msg.type === 'user_block_update') {
                const { blockerId, blockedId, isBlocked } = msg;

                // If I blocked someone (blockerId is me) -> Update blockedUsers list
                if (blockerId === user.id) {
                    if (isBlocked) {
                        setBlockedUsers(prev => [...prev, blockedId]);
                    } else {
                        setBlockedUsers(prev => prev.filter(id => id !== blockedId));
                    }
                }

                // If updated involves me (either I blocked someone or was blocked)
                // We need to update the chat isBlockedBy state if I was blocked
                if (blockedId === user.id) {
                    setChats(prevChats => prevChats.map(chat => {
                        const otherParticipant = chat.participants?.find(p => p.id === blockerId);
                        if (otherParticipant) {
                            return { ...chat, isBlockedBy: isBlocked };
                        }
                        return chat;
                    }));
                }
                return;
            }

            // Handle group events (Kick, Leave, Dissolve)
            if (msg.type === 'group_event') {
                const { event, chatId, userId } = msg;

                // 1. User Kicked
                if (event === 'user_kicked') {
                    // If I am the one kicked, remove the chat
                    if (userId === user.id) {
                        setChats(prev => prev.filter(c => c.id !== chatId));
                        if (selectedChatId === chatId) {
                            setSelectedChatId(null);
                        }
                    }
                    return;
                }

                // 2. Member Removed/Left (Update participants list for others)
                if (event === 'member_removed') {
                    setChats(prev => prev.map(c => {
                        if (c.id === chatId) {
                            return {
                                ...c,
                                participants: c.participants?.filter(p => p.id !== userId)
                            };
                        }
                        return c;
                    }));
                    return;
                }

                if (event === 'group_dissolved') {
                    setChats(prev => prev.filter(c => c.id !== chatId));
                    if (selectedChatId === chatId) {
                        setSelectedChatId(null);
                    }
                    return;
                }

                // 4. Added to Group (I was added)
                if (event === 'added_to_group') {
                    // Fetch chats to get the new one
                    chatService.getChats().then(updatedChats => {
                        setChats(updatedChats);
                    }).catch(err => console.error("Failed to update chats", err));
                    return;
                }

                // 5. Member Added (Someone else was added)
                if (event === 'member_added') {
                    const { users } = msg; // Expecting list of users
                    setChats(prev => prev.map(c => {
                        if (c.id === chatId) {
                            // Merge new participants, avoiding duplicates
                            const existingIds = new Set(c.participants?.map(p => p.id));
                            const newParticipants = users.filter((u: any) => !existingIds.has(u.id));

                            return {
                                ...c,
                                participants: [...(c.participants || []), ...newParticipants]
                            };
                        }
                        return c;
                    }));
                    return;
                }
            }

            // Standard message handling
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

                // Build last message preview
                let lastMessageText = processedMsg.text;
                if (!lastMessageText && processedMsg.attachments && processedMsg.attachments.length > 0) {
                    // Check if all attachments are images
                    const allImages = processedMsg.attachments.every(
                        (att: any) => att.fileType && att.fileType.startsWith('image/')
                    );
                    lastMessageText = allImages ? "📷 Image" : "📎 File";
                }

                const updatedChat = {
                    ...prevChats[chatIndex],
                    lastMessage: lastMessageText,
                    time: processedMsg.time,
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
        setMessageSearchQuery(''); // Clear search when changing chat

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

    const handleSendMessage = async (files?: File[]) => {
        if (!messageInput.trim() && (!files || files.length === 0)) return;

        try {
            // If this is a new chat (no ID yet), create it first
            if (selectedUserForNewChat && !selectedChatId) {
                const newChat = await chatService.createChat(selectedUserForNewChat.id);
                setChats(prev => [newChat, ...prev]);
                setSelectedChatId(newChat.id);
                setSelectedUserForNewChat(null);

                // Send message to the newly created chat
                await chatService.sendMessage(newChat.id, messageInput, files);
            } else if (selectedChatId) {
                // Normal flow: send message to existing chat
                await chatService.sendMessage(selectedChatId, messageInput, files);
            } else {
                return; // No chat selected and no new user
            }

            // setMessages handled by WebSocket listener
            setMessageInput('');
        } catch (error) {
            console.error("Failed to send message:", error);
        }
    };

    const handleCreateGroupChat = async (participantIds: string[], name?: string) => {
        try {
            const newChat = await chatService.createGroupChat(participantIds, name);
            setChats(prev => [newChat, ...prev]);
            setSelectedChatId(newChat.id);
            return newChat;
        } catch (error) {
            console.error("Failed to create group chat:", error);
            throw error;
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

    const handleRecallMessage = async (messageId: string) => {
        if (!selectedChatId) return;
        try {
            await chatService.deleteMessage(selectedChatId, messageId);
            // Optimistic update
            setMessages(prev => prev.map(m =>
                m.id === messageId
                    ? { ...m, isRecalled: true, text: '', attachments: [] }
                    : m
            ));
        } catch (error) {
            console.error("Failed to recall message:", error);
        }
    };

    const handleBlockUser = async (userId: string) => {
        try {
            await chatService.blockUser(userId);
            setBlockedUsers(prev => [...prev, userId]);
        } catch (error) {
            console.error("Failed to block user:", error);
        }
    };

    const handleUnblockUser = async (userId: string) => {
        try {
            await chatService.unblockUser(userId);
            setBlockedUsers(prev => prev.filter(id => id !== userId));
        } catch (error) {
            console.error("Failed to unblock user:", error);
        }
    };

    const handleLeaveGroup = async (chatId: string) => {
        try {
            await chatService.leaveGroup(chatId);
            setChats(prev => prev.filter(c => c.id !== chatId));
            if (selectedChatId === chatId) {
                setSelectedChatId(null);
            }
        } catch (error) {
            console.error("Failed to leave group:", error);
        }
    };

    const handleKickMember = async (chatId: string, userId: string) => {
        try {
            await chatService.kickMember(chatId, userId);
            // Update local chat participants
            setChats(prev => prev.map(c => {
                if (c.id === chatId) {
                    return {
                        ...c,
                        participants: c.participants?.filter(p => p.id !== userId)
                    };
                }
                return c;
            }));
        } catch (error) {
            console.error("Failed to kick member:", error);
        }
    };

    const handleDeleteGroup = async (chatId: string) => {
        try {
            await chatService.deleteGroup(chatId);
            setChats(prev => prev.filter(c => c.id !== chatId));
            if (selectedChatId === chatId) {
                setSelectedChatId(null);
            }
        } catch (error) {
            console.error("Failed to delete group:", error);
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
        handleRecallMessage,
        messageSearchQuery,
        setMessageSearchQuery,
        searchResults,
        isSearchingMessages,
        blockedUsers,
        handleBlockUser,
        handleUnblockUser,
        handleCreateGroupChat,
        handleLeaveGroup,
        handleKickMember,
        handleDeleteGroup,
        handleAddMembers: async (chatId: string, userIds: string[]) => {
            try {
                const token = localStorage.getItem('token');
                if (!token) throw new Error("No token");
                await axios.post(`${API_BASE_URL}/chats/${chatId}/participants`, userIds, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (selectedChatId === chatId) {
                }
            } catch (error) {
                console.error("Failed to add members", error);
                throw error;
            }
        }
    };
};

