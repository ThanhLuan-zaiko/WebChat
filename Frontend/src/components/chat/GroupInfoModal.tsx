import { X, UserMinus, LogOut, Trash2, Shield, UserPlus } from 'lucide-react';
import type { Chat } from '../../types';
import { useState } from 'react';
import { AddMemberModal } from './AddMemberModal';

interface GroupInfoModalProps {
    isOpen: boolean;
    onClose: () => void;
    chat: Chat;
    currentUserId: string;
    onKickMember: (userId: string) => void;
    onLeaveGroup: () => void;
    onDeleteGroup: () => void;
    onAddMembers?: (userIds: string[]) => void;
}

export const GroupInfoModal = ({
    isOpen,
    onClose,
    chat,
    currentUserId,
    onKickMember,
    onLeaveGroup,
    onDeleteGroup,
    onAddMembers
}: GroupInfoModalProps) => {
    const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);

    if (!isOpen) return null;

    const isAdmin = chat.participants?.find(p => p.id === currentUserId)?.role === 'admin' || chat.role === 'admin';
    const participants = chat.participants || [];

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh] overflow-hidden">
                    {/* Header */}
                    <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-gray-900">Group Info</h2>
                        <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 text-gray-500">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-4 overflow-y-auto">
                        <div className="text-center mb-6">
                            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center text-2xl font-bold text-blue-600 mx-auto mb-3">
                                {chat.name[0].toUpperCase()}
                            </div>
                            <h3 className="text-xl font-bold text-gray-900">{chat.name}</h3>
                            <p className="text-sm text-gray-500">{participants.length} members</p>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Members</h4>
                                {isAdmin && onAddMembers && (
                                    <button
                                        onClick={() => setIsAddMemberOpen(true)}
                                        className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                                    >
                                        <UserPlus className="w-4 h-4" /> Add Member
                                    </button>
                                )}
                            </div>
                            <div className="space-y-2">
                                {participants.map(member => (
                                    <div key={member.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50">
                                        <div className="flex items-center gap-3">
                                            {member.avatar ? (
                                                <img src={member.avatar} alt={member.username} className="w-10 h-10 rounded-full object-cover" />
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-medium">
                                                    {member.username[0].toUpperCase()}
                                                </div>
                                            )}
                                            <div>
                                                <p className="text-sm font-medium text-gray-900 flex items-center gap-1">
                                                    {member.username}
                                                    {member.id === currentUserId && <span className="text-xs text-gray-500">(You)</span>}
                                                </p>
                                                {member.role === 'admin' && (
                                                    <span className="text-xs text-blue-600 flex items-center gap-1">
                                                        <Shield className="w-3 h-3" /> Admin
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {isAdmin && member.id !== currentUserId && member.role !== 'admin' && (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    onKickMember(member.id);
                                                }}
                                                className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors cursor-pointer"
                                                title="Kick member"
                                            >
                                                <UserMinus className="w-4 h-4 pointer-events-none" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="p-4 border-t border-gray-100 bg-gray-50 flex flex-col gap-2">
                        <button
                            onClick={onLeaveGroup}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                            Leave Group
                        </button>

                        {isAdmin && (
                            <button
                                onClick={onDeleteGroup}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                                Dissolve Group
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {isAdmin && onAddMembers && (
                <AddMemberModal
                    isOpen={isAddMemberOpen}
                    onClose={() => setIsAddMemberOpen(false)}
                    currentMemberIds={participants.map(p => p.id)}
                    onAddMembers={(userIds) => {
                        onAddMembers(userIds);
                        // setIsAddMemberOpen(false); // Handled inside modal
                    }}
                />
            )}
        </>
    );
};
