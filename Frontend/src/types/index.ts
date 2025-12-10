export interface User {
    id: string;
    username: string;
    avatar?: string;
    isOnline?: boolean;
}

export interface Chat {
    id: string;
    name: string;
    avatar?: string;
    lastMessage?: string;
    time?: string;
    unreadCount?: number;
    isGroup?: boolean;
    isOnline?: boolean;
    participants?: User[];
}

export interface Message {
    id: string;
    chatId: string;
    senderId: string;
    text: string;
    time: string;
    isIncoming: boolean; // Computed on frontend based on current user
    isRead?: boolean;
    senderName?: string; // For groups
}
