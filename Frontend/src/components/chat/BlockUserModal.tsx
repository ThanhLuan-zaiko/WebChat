interface BlockUserModalProps {
    onClose: () => void;
    onConfirm: () => void;
}

export const BlockUserModal = ({ onClose, onConfirm }: BlockUserModalProps) => {
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm animate-in zoom-in-95 duration-200">
                <h3 className="text-lg font-bold text-gray-900 mb-2">Block this user?</h3>
                <p className="text-gray-500 mb-6 leading-relaxed">
                    They will not be able to send you messages.
                </p>
                <div className="flex gap-3 justify-end">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-5 py-2.5 bg-red-500 text-white hover:bg-red-600 rounded-xl font-medium shadow-md hover:shadow-lg transition-all"
                    >
                        Block User
                    </button>
                </div>
            </div>
        </div>
    );
};
