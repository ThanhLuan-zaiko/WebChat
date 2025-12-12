import { Paperclip } from 'lucide-react';

interface DragDropOverlayProps {
    isDragging: boolean;
}

export const DragDropOverlay = ({ isDragging }: DragDropOverlayProps) => {
    if (!isDragging) return null;

    return (
        <div className="absolute inset-0 bg-blue-500 bg-opacity-20 backdrop-blur-sm z-40 flex items-center justify-center border-4 border-dashed border-blue-500">
            <div className="bg-white rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-4">
                <div className="bg-blue-100 rounded-full p-6">
                    <Paperclip className="h-16 w-16 text-blue-500" />
                </div>
                <div className="text-center">
                    <h3 className="text-2xl font-bold text-gray-800 mb-2">Drag and drop your files</h3>
                    <p className="text-gray-600">Support image, PDF, Word, Excel...</p>
                </div>
            </div>
        </div>
    );
};
