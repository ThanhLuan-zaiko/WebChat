import { useRef, useState, useEffect } from 'react';
import { Paperclip, Smile, Mic, Send } from 'lucide-react';
import EmojiPicker, { type EmojiClickData } from 'emoji-picker-react';
import { FilePreview } from './FilePreview';

interface ChatInputProps {
    messageInput: string;
    onMessageInputChange: (value: string) => void;
    onSendMessage: (files?: File[]) => void;
    isBlocked: boolean; // I blocked them
    amIBlocked: boolean; // They blocked me
    onUnblockUser: () => void;
    selectedFiles: File[];
    setSelectedFiles: React.Dispatch<React.SetStateAction<File[]>>;
}

export const ChatInput = ({
    messageInput,
    onMessageInputChange,
    onSendMessage,
    isBlocked,
    amIBlocked,
    onUnblockUser,
    selectedFiles,
    setSelectedFiles
}: ChatInputProps) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const emojiPickerRef = useRef<HTMLDivElement>(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    // Handle clicks outside for emoji picker
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
                setShowEmojiPicker(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showEmojiPicker]);

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files?.length) {
            setSelectedFiles(prev => [...prev, ...Array.from(event.target.files!)]);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleRemoveFile = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleSendWithFiles = () => {
        if (messageInput.trim() || selectedFiles.length > 0) {
            onSendMessage(selectedFiles);
            setSelectedFiles([]);
            setShowEmojiPicker(false);
        }
    };

    const onEmojiClick = (emojiObject: EmojiClickData) => {
        onMessageInputChange(messageInput + emojiObject.emoji);
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        const files: File[] = [];

        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile();
                if (file) {
                    files.push(file);
                }
            }
        }

        if (files.length > 0) {
            setSelectedFiles(prev => [...prev, ...files]);
        }
    };

    if (isBlocked) {
        return (
            <div className="p-4 bg-gray-50 text-center text-gray-500 text-sm mb-4 rounded-xl border border-gray-100 shadow-sm mx-auto w-full max-w-4xl">
                You have blocked this user. <button onClick={onUnblockUser} className="text-blue-500 hover:underline">Unblock</button> to send messages.
            </div>
        );
    }
    if (amIBlocked) {
        return (
            <div className="p-4 bg-red-50 text-center text-red-500 text-sm mb-4 rounded-xl border border-red-100 shadow-sm mx-auto w-full max-w-4xl">
                You have been blocked by this user. You cannot send messages.
            </div>
        );
    }

    return (
        <div className="bg-white p-3 max-w-4xl mx-auto w-full mb-4 rounded-xl shadow-lg border border-gray-100">
            {selectedFiles.length > 0 && (
                <div className="mb-3">
                    <FilePreview files={selectedFiles} onRemove={handleRemoveFile} />
                </div>
            )}
            <div className="flex items-end gap-3">
                <div className="relative" ref={emojiPickerRef}>
                    <button className="text-gray-500 hover:text-gray-700 p-2" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                        <Smile className="h-6 w-6" />
                    </button>
                    {showEmojiPicker && (
                        <div className="absolute bottom-12 left-0 z-50">
                            <EmojiPicker onEmojiClick={onEmojiClick} />
                        </div>
                    )}
                </div>
                <input
                    type="text"
                    placeholder="Message"
                    value={messageInput}
                    onChange={(e) => onMessageInputChange(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendWithFiles()}
                    onPaste={handlePaste}
                    className="flex-1 py-2 bg-transparent focus:outline-none resize-none"
                />
                <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} className="hidden" />
                <button className="text-gray-500 hover:text-gray-700 p-2" onClick={() => fileInputRef.current?.click()}>
                    <Paperclip className="h-6 w-6" />
                </button>
                {messageInput.trim() || selectedFiles.length > 0 ? (
                    <button onClick={handleSendWithFiles} className="p-2 text-[#2AABEE] hover:text-[#229ED9] transition-colors">
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
};
