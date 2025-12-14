import { useRef, useState, useEffect } from 'react';
import { Search, MoreVertical, Phone, LogOut, Trash2, UserPlus, Lock } from 'lucide-react';
import { ConfirmModal } from '../ui/ConfirmModal';
import type { Chat } from '../../types';

interface ChatHeaderProps {
    chat: Chat;
    displayName: string;
    onBackClick: () => void;
    isSearching: boolean;
    setIsSearching: (value: boolean) => void;
    searchQuery: string;
    onSearchChange: (value: string) => void;
    otherParticipant: { id: string } | undefined;
    isBlocked: boolean;
    onBlockUser: () => void; // Opens modal in parent
    onUnblockUser: (userId: string) => void;
    onGroupInfo?: () => void;
    onLeaveGroup?: () => void;
    onDeleteGroup?: () => void;
    onAddMembers?: () => void;
    encryptionKey: string;
    onSetEncryptionKey: (key: string) => void;
}

export const ChatHeader = ({
    chat,
    displayName,
    onBackClick,
    isSearching,
    setIsSearching,
    searchQuery,
    onSearchChange,
    otherParticipant,
    isBlocked,
    onBlockUser,
    onUnblockUser,
    onGroupInfo,
    onLeaveGroup,
    onDeleteGroup,
    onAddMembers,
    encryptionKey,
    onSetEncryptionKey
}: ChatHeaderProps) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        type: 'leave' | 'delete' | null;
    }>({ isOpen: false, type: null });
    const [showKeyInput, setShowKeyInput] = useState(false);
    const [tempKey, setTempKey] = useState(encryptionKey);
    const menuRef = useRef<HTMLDivElement>(null);
    const keyInputRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setTempKey(encryptionKey);
    }, [encryptionKey]);

    useEffect(() => {
        const handleClickOutsideKey = (event: MouseEvent) => {
            if (keyInputRef.current && !keyInputRef.current.contains(event.target as Node)) {
                setShowKeyInput(false);
            }
        };
        if (showKeyInput) {
            document.addEventListener('mousedown', handleClickOutsideKey);
        }
        return () => document.removeEventListener('mousedown', handleClickOutsideKey);
    }, [showKeyInput]);

    const handleSaveKey = () => {
        onSetEncryptionKey(tempKey);
        setShowKeyInput(false);
    };

    // Handle clicks outside for menu
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isMenuOpen]);

    const handleBlockAction = () => {
        if (!otherParticipant) return;
        if (isBlocked) {
            onUnblockUser(otherParticipant.id);
        } else {
            onBlockUser();
        }
        setIsMenuOpen(false);
    };

    return (
        <div className="flex items-center justify-between bg-white px-4 py-2 border-b border-gray-200">
            <div className="flex items-center gap-3">
                <button className="md:hidden text-gray-500 mr-2" onClick={onBackClick}>
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                </button>
                <div className="flex flex-col">
                    <h3 className="font-semibold">{displayName}</h3>
                    <span className="text-xs text-blue-500">{chat.isOnline ? 'Online' : 'Offline'}</span>
                </div>
            </div>

            <div className="flex items-center gap-4 text-gray-500">
                {isSearching ? (
                    <div className="flex items-center bg-gray-100 rounded-full px-3 py-1 animate-in fade-in slide-in-from-right-5">
                        <input
                            autoFocus
                            type="text"
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="bg-transparent border-none outline-none text-sm w-32 md:w-48 text-gray-700 placeholder-gray-400"
                            onKeyDown={(e) => {
                                if (e.key === 'Escape') {
                                    setIsSearching(false);
                                    onSearchChange('');
                                }
                            }}
                        />
                        <button onClick={() => { setIsSearching(false); onSearchChange(''); }} className="ml-2 hover:text-gray-700">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                ) : (
                    <Search className="h-5 w-5 cursor-pointer hover:text-gray-700" onClick={() => setIsSearching(true)} />
                )}

                {/* Encryption Key Toggle */}
                <div className="relative" ref={keyInputRef}>
                    <Lock
                        className={`h-5 w-5 cursor-pointer ${encryptionKey ? "text-green-500" : "text-gray-500 hover:text-gray-700"}`}
                        onClick={() => setShowKeyInput(!showKeyInput)}
                    />
                    {showKeyInput && (
                        <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-md shadow-lg p-3 z-50 border border-gray-100 animate-in fade-in zoom-in-95 duration-100">
                            <h4 className="text-sm font-semibold mb-2">Encryption Key</h4>
                            <input
                                type="password"
                                value={tempKey}
                                onChange={(e) => setTempKey(e.target.value)}
                                className="w-full border rounded px-2 py-1 text-sm mb-2"
                                placeholder="Enter secret key..."
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && handleSaveKey()}
                            />
                            <button
                                onClick={handleSaveKey}
                                className="w-full bg-blue-500 text-white rounded text-sm py-1 hover:bg-blue-600"
                            >
                                Set Key
                            </button>
                        </div>
                    )}
                </div>

                <Phone className="h-5 w-5 cursor-pointer hover:text-gray-700" />

                {/* Menu with Click Toggle */}
                <div className="relative" ref={menuRef}>
                    <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="focus:outline-none">
                        <MoreVertical className="h-5 w-5 cursor-pointer hover:text-gray-700" />
                    </button>
                    {isMenuOpen && (
                        <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-100 animate-in fade-in zoom-in-95 duration-100">
                            {!chat.isGroup && otherParticipant && (
                                <button
                                    onClick={handleBlockAction}
                                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                    {isBlocked ? "Unblock User" : "Block User"}
                                </button>
                            )}
                            {chat.isGroup && onGroupInfo && (
                                <button
                                    onClick={() => {
                                        onGroupInfo();
                                        setIsMenuOpen(false);
                                    }}
                                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                    Group Info
                                </button>
                            )}
                            {chat.isGroup && onLeaveGroup && (
                                <button
                                    onClick={() => {
                                        setConfirmModal({ isOpen: true, type: 'leave' });
                                        setIsMenuOpen(false);
                                    }}
                                    className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 flex items-center gap-2"
                                >
                                    <LogOut className="w-4 h-4" />
                                    Leave Group
                                </button>
                            )}
                            {chat.isGroup && chat.role === 'admin' && onAddMembers && (
                                <button
                                    onClick={() => {
                                        onAddMembers();
                                        setIsMenuOpen(false);
                                    }}
                                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                >
                                    <UserPlus className="w-4 h-4" />
                                    Add Member
                                </button>
                            )}
                            {chat.isGroup && chat.role === 'admin' && onDeleteGroup && (
                                <button
                                    onClick={() => {
                                        setConfirmModal({ isOpen: true, type: 'delete' });
                                        setIsMenuOpen(false);
                                    }}
                                    className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 flex items-center gap-2"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Dissolve Group
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                onConfirm={() => {
                    if (confirmModal.type === 'leave' && onLeaveGroup) onLeaveGroup();
                    if (confirmModal.type === 'delete' && onDeleteGroup) onDeleteGroup();
                }}
                title={confirmModal.type === 'leave' ? "Leave Group" : "Dissolve Group"}
                message={confirmModal.type === 'leave'
                    ? "Are you sure you want to leave this group?"
                    : "Are you sure you want to dissolve this group? This action cannot be undone."}
                confirmText={confirmModal.type === 'leave' ? "Leave" : "Dissolve"}
                isDestructive={true}
            />
        </div>
    );
};
