import { X, File } from 'lucide-react';

interface FilePreviewProps {
    files: File[];
    onRemove: (index: number) => void;
}

export const FilePreview = ({ files, onRemove }: FilePreviewProps) => {
    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const isImage = (file: File): boolean => {
        return file.type.startsWith('image/');
    };

    if (files.length === 0) return null;

    return (
        <div className="flex flex-wrap gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
            {files.map((file, index) => (
                <div
                    key={index}
                    className="relative group bg-white border border-gray-300 rounded-lg overflow-hidden"
                    style={{ width: '120px' }}
                >
                    {isImage(file) ? (
                        <div className="h-20 w-full bg-gray-100 flex items-center justify-center">
                            <img
                                src={URL.createObjectURL(file)}
                                alt={file.name}
                                className="max-h-full max-w-full object-contain"
                            />
                        </div>
                    ) : (
                        <div className="h-20 w-full bg-gray-100 flex items-center justify-center">
                            <File className="h-10 w-10 text-gray-400" />
                        </div>
                    )}

                    <div className="p-2 text-xs">
                        <p className="truncate font-medium text-gray-700" title={file.name}>
                            {file.name}
                        </p>
                        <p className="text-gray-500 text-[10px]">
                            {formatFileSize(file.size)}
                        </p>
                    </div>

                    <button
                        onClick={() => onRemove(index)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 
                                   opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                        aria-label="Remove file"
                    >
                        <X className="h-3 w-3" />
                    </button>
                </div>
            ))}
        </div>
    );
};
