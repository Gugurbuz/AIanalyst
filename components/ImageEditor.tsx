// components/ImageEditor.tsx
import React, { useState, useCallback, useRef } from 'react';
import { UploadCloud, Sparkles, LoaderCircle, AlertTriangle, Image as ImageIcon } from 'lucide-react';
import { geminiService } from '../services/geminiService';
import { useAppContext } from '../contexts/AppContext';

// Helper to convert file to base64
const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = error => reject(error);
    });
};

export const ImageEditor: React.FC = () => {
    const { commitTokenUsage, setError: setGlobalError } = useAppContext();
    const [originalImage, setOriginalImage] = useState<{ file: File, base64: string, dataUrl: string } | null>(null);
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (files: FileList | null) => {
        if (files && files[0]) {
            const file = files[0];
            if (!file.type.startsWith('image/')) {
                setError('Lütfen bir görsel dosyası seçin (örn: PNG, JPG).');
                return;
            }
            try {
                const base64 = await fileToBase64(file);
                const dataUrl = URL.createObjectURL(file);
                setOriginalImage({ file, base64, dataUrl });
                setGeneratedImage(null); // Clear previous generation
                setError(null);
            } catch (e) {
                setError('Dosya okunurken bir hata oluştu.');
            }
        }
    };

    const handleGenerate = async () => {
        if (!originalImage || !prompt.trim()) {
            setError('Lütfen bir görsel yükleyin ve bir komut girin.');
            return;
        }

        setIsLoading(true);
        setError(null);
        
        // Use the latest generated image as the new base if it exists
        const imageToEdit = generatedImage || originalImage.base64;
        const mimeType = originalImage.file.type;

        try {
            const { base64Image, tokens } = await geminiService.editImage(imageToEdit, mimeType, prompt);
            commitTokenUsage(tokens);
            setGeneratedImage(base64Image);
        } catch (e: any) {
            const errorMessage = `Görsel oluşturulurken bir hata oluştu: ${e.message}`;
            setError(errorMessage);
            setGlobalError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };
    
    // Drag and drop handlers
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => e.preventDefault();
    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        handleFileChange(e.dataTransfer.files);
    };

    const currentImageSrc = generatedImage 
        ? `data:image/png;base64,${generatedImage}` 
        : originalImage?.dataUrl;

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900">
            <header className="p-4 border-b border-slate-200 dark:border-slate-700">
                 <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Görsel Düzenleyici (Nano Banana)</h3>
                 <p className="text-sm text-slate-500 dark:text-slate-400">Metin komutlarıyla görsellerinizi düzenleyin.</p>
            </header>
            <div className="flex-1 p-4 grid grid-cols-1 md:grid-cols-3 gap-4 min-h-0">
                {/* Image Display */}
                <div className="md:col-span-2 relative bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-700">
                    {currentImageSrc ? (
                        <img src={currentImageSrc} alt="Düzenlenen görsel" className="max-w-full max-h-full object-contain" />
                    ) : (
                        <div 
                            className="w-full h-full flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-slate-500 dark:text-slate-400 p-8 text-center cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <UploadCloud className="w-12 h-12 mb-4" />
                            <h4 className="font-semibold">Bir görsel sürükleyip bırakın veya seçin</h4>
                            <p className="text-sm mt-1">PNG, JPG, GIF dosyaları desteklenmektedir.</p>
                        </div>
                    )}
                     {isLoading && (
                        <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white">
                            <LoaderCircle className="animate-spin h-10 w-10 mb-4" />
                            <p className="font-semibold">Görsel düzenleniyor...</p>
                        </div>
                    )}
                </div>

                {/* Controls */}
                <div className="flex flex-col gap-4">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={(e) => handleFileChange(e.target.files)}
                        className="hidden"
                        accept="image/*"
                    />
                     <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 rounded-md shadow-sm border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600"
                    >
                        <ImageIcon className="w-5 h-5" />
                        {originalImage ? 'Görseli Değiştir' : 'Görsel Yükle'}
                    </button>
                    
                    <div className="flex-1 flex flex-col">
                         <label htmlFor="prompt-input" className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Düzenleme Komutu</label>
                         <textarea
                            id="prompt-input"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Örn: Arka plana bir dağ ekle"
                            className="w-full flex-1 p-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white dark:bg-slate-700 resize-none"
                            rows={5}
                        />
                         <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            İpucu: Daha iyi sonuçlar için, analiz dokümanınızdan ilgili bölümleri komutunuza ekleyebilirsiniz.
                        </p>
                    </div>
                     {error && (
                        <div className="p-3 text-sm text-red-800 bg-red-100 border border-red-300 rounded-lg dark:bg-red-900/50 dark:text-red-300 dark:border-red-600 flex items-start gap-2">
                            <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}
                     <button
                        onClick={handleGenerate}
                        disabled={isLoading || !originalImage || !prompt.trim()}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                    >
                        <Sparkles className="w-5 h-5" />
                        Düzenle
                    </button>
                </div>
            </div>
        </div>
    );
};
