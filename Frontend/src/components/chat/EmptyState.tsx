export const EmptyState = () => (
    <div className="hidden md:flex flex-1 items-center justify-center bg-gray-50 flex-col gap-4">
        <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center text-gray-400">
            <span className="text-4xl font-bold">W</span>
        </div>
        <p className="text-gray-500 bg-gray-200 px-4 py-1 rounded-full text-sm">
            Select a chat to start messaging
        </p>
    </div>
);
