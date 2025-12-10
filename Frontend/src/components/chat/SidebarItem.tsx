import type { Chat } from '../../types';
import { cn } from '../ui';

interface SidebarItemProps {
    chat: Chat;
    isSelected: boolean;
    onClick: () => void;
}

export const SidebarItem = ({ chat, isSelected, onClick }: SidebarItemProps) => (
    <div
        onClick={onClick}
        className={cn(
            "flex cursor-pointer items-center p-2 rounded-lg transition-colors mx-2",
            isSelected ? "bg-[#2AABEE] text-white" : "hover:bg-gray-100"
        )}
    >
        <img
            src={chat.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(chat.name)}&background=random`}
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
        {chat.unreadCount && chat.unreadCount > 0 ? (
            <div className={cn(
                "ml-2 min-w-[20px] h-5 rounded-full flex items-center justify-center text-xs font-bold px-1.5",
                isSelected ? "bg-white text-[#2AABEE]" : "bg-gray-400 text-white"
            )}>
                {chat.unreadCount}
            </div>
        ) : null}
    </div>
);
