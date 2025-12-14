import type { Message } from '../../types';
import { cn } from '../ui';
import { CheckCheck, File, Download, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface MessageBubbleProps {
    message: Message;
    onRecallMessage: (messageId: string) => void;
    onClick?: () => void;
    isGroup?: boolean;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

export const MessageBubble = ({ message, onRecallMessage, onClick, isGroup }: MessageBubbleProps) => {
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);

    const formatFileSize = (bytes: number | null): string => {
        if (!bytes) return '';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const isImage = (fileType: string | null): boolean => {
        if (!fileType) return false;
        return fileType.startsWith('image/');
    };

    const getFileUrl = (url: string): string => {
        if (url.startsWith('http')) return url;
        return `${API_BASE_URL}${url}`;
    };

    if (message.type === 'system') {
        return (
            <div className="flex justify-center my-2 w-full">
                <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                    {message.text}
                </span>
            </div>
        );
    }

    return (
        <>
            <div
                id={`message-${message.id}`}
                onClick={onClick}
                className={cn(
                    "flex mb-2 max-w-[80%] group/bubble relative",
                    message.isIncoming ? "self-start" : "self-end",
                    onClick && "cursor-pointer hover:bg-gray-50/50"
                )}>

                {/* Sender Avatar for Group Chats */}
                {isGroup && message.isIncoming && (
                    <div className="mr-2 self-end mb-1 flex-shrink-0">
                        {message.senderAvatar ? (
                            <img
                                src={getFileUrl(message.senderAvatar)}
                                alt={message.senderName || 'Sender'}
                                className="w-8 h-8 rounded-full object-cover"
                            />
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-500">
                                {(message.senderName || 'U')[0].toUpperCase()}
                            </div>
                        )}
                    </div>
                )}

                {/* Recall Button - Only for outgoing messages that are not recalled */}
                {!message.isIncoming && !message.isRecalled && (
                    <button
                        onClick={() => onRecallMessage(message.id)}
                        className="opacity-0 group-hover/bubble:opacity-100 transition-opacity absolute top-1/2 -translate-y-1/2 -left-8 p-1.5 text-red-500 hover:bg-red-50 rounded-full"
                        title="Recall messages"
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                )}

                {!message.isIncoming && <div className="flex-1" />}
                <div className={cn(
                    "px-3 py-1.5 rounded-lg shadow-sm relative",
                    message.isIncoming ? "bg-white rounded-tl-none" : "bg-[#EFFDDE] rounded-tr-none",
                    message.isRecalled && "bg-gray-100 text-gray-500 italic border border-gray-200"
                )}>
                    {message.isRecalled ? (
                        <p className="text-sm">Message recalled</p>
                    ) : (
                        <>
                            {/* Sender Name for Group Chats */}
                            {isGroup && message.isIncoming && message.senderName && (
                                <p className="text-xs text-blue-600 font-medium mb-1">{message.senderName}</p>
                            )}
                            {/* Attachments */}
                            {message.attachments && message.attachments.length > 0 && (
                                <div className="mb-2 space-y-2">
                                    {message.attachments.map((attachment, idx) => (
                                        <div key={attachment.id || idx}>
                                            {isImage(attachment.fileType) ? (
                                                <div className="relative group">
                                                    <div
                                                        className="cursor-pointer"
                                                        onClick={() => setLightboxImage(getFileUrl(attachment.fileUrl))}
                                                    >
                                                        <img
                                                            src={getFileUrl(attachment.fileUrl)}
                                                            alt={attachment.fileName || 'Image'}
                                                            className="rounded-lg max-w-full max-h-80 object-contain hover:opacity-90 transition-opacity"
                                                        />
                                                    </div>
                                                    {/* Download button for images */}
                                                    <a
                                                        href={getFileUrl(attachment.fileUrl)}
                                                        download={attachment.fileName || 'image'}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="absolute top-2 right-2 bg-black bg-opacity-60 hover:bg-opacity-80 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        title="Download"
                                                    >
                                                        <Download className="h-4 w-4" />
                                                    </a>
                                                </div>
                                            ) : (
                                                <a
                                                    href={getFileUrl(attachment.fileUrl)}
                                                    download={attachment.fileName || 'file'}
                                                    className="flex items-center gap-2 p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                                                >
                                                    <File className="h-8 w-8 text-gray-600" />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-gray-700 truncate">
                                                            {attachment.fileName || 'File'}
                                                        </p>
                                                        {attachment.fileSize && (
                                                            <p className="text-xs text-gray-500">
                                                                {formatFileSize(attachment.fileSize)}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <Download className="h-5 w-5 text-gray-500" />
                                                </a>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Text content */}
                            {message.text && <p className="whitespace-pre-wrap text-[15px]">{message.text}</p>}

                            {/* Time and read status */}
                            <div className="flex justify-end items-center gap-1 mt-1">
                                <span className={cn("text-xs", message.isIncoming ? "text-gray-500" : "text-[#4fae4e]")}>
                                    {message.time}
                                </span>
                                {!message.isIncoming && <CheckCheck className="h-3 w-3 text-[#4fae4e]" />}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Lightbox for full-size images */}
            {lightboxImage && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
                    onClick={() => setLightboxImage(null)}
                >
                    <img
                        src={lightboxImage}
                        alt="Full size"
                        className="max-w-full max-h-full object-contain"
                    />
                    <button
                        className="absolute top-4 right-4 text-white text-2xl hover:text-gray-300"
                        onClick={() => setLightboxImage(null)}
                    >
                        ×
                    </button>
                </div>
            )}
        </>
    );
};
