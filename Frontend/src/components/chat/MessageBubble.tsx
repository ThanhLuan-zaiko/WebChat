import type { Message } from '../../types';
import { cn } from '../ui';
import { CheckCheck } from 'lucide-react';

interface MessageBubbleProps {
    message: Message;
}

export const MessageBubble = ({ message }: MessageBubbleProps) => (
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
