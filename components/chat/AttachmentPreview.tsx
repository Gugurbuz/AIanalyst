
import React from 'react';
import { X } from 'lucide-react';

interface AttachmentPreviewProps {
    attachedFile: File | null;
    imagePreview: string | null;
    onRemove: () => void;
}

export const AttachmentPreview: React.FC<AttachmentPreviewProps> = ({ attachedFile, imagePreview, onRemove }) => {
    if (!attachedFile) return null;

    if (imagePreview) {
        return (
            <div className="p-2">
                <div className="relative w-24 h-24 rounded-md overflow-hidden group">
                    <img src={imagePreview} alt="Ekli görsel" className="w-full h-full object-cover"/>
                    <button
                        onClick={onRemove}
                        className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Görseli kaldır"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-2 mt-2 px-3 py-2 bg-slate-200 dark:bg-slate-600 rounded-md flex items-center justify-between text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200 truncate pr-2">
                Ekli: {attachedFile.name}
            </span>
            <button onClick={onRemove} className="p-1 rounded-full hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-500 dark:text-slate-400">
                <X className="h-4 w-4" />
            </button>
        </div>
    );
};
