export interface User {
    id: string;
    username: string;
    avatar?: string;
    isOnline?: boolean;
    role?: 'admin' | 'member';
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
    isBlockedBy?: boolean;
    participants?: User[];
    role?: 'admin' | 'member'; // Current user's role in this chat
}

export interface Attachment {
    id?: string;
    fileUrl: string;
    fileType: string | null;
    fileName: string | null;
    fileSize: number | null;
}

export interface Reaction {
    emoji: string;
    count: number;
    userHasReacted: boolean;
}

export interface Message {
    id: string;
    chatId: string;
    senderId: string;
    text: string;
    time: string;
    isIncoming: boolean; // Computed on frontend based on current user
    isRead?: boolean;
    isRecalled?: boolean;
    senderName?: string; // For groups
    senderAvatar?: string; // For groups
    attachments?: Attachment[];
    reactions?: Reaction[];
    type?: 'text' | 'image' | 'file' | 'system';
}
