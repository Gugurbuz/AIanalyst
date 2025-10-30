import React, { useState, useEffect, useCallback } from 'react';
import { promptService } from '../services/promptService';
import type { PromptData, Prompt, PromptVersion } from '../types';
import { MermaidPromptEditor } from './MermaidPromptEditor';

interface PromptManagerProps {
    isOpen: boolean;
    onClose: () => void;
}

export const PromptManager: React.FC<PromptManagerProps> = ({ isOpen, onClose }) => {
    const [promptData, setPromptData] = useState<PromptData>([]);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
    const [selectedVersion, setSelectedVersion] = useState<PromptVersion | null>(null);
    const [promptText, setPromptText] = useState('');
    const [isDirty, setIsDirty] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const data = promptService.getPromptData();
            setPromptData(JSON.parse(JSON.stringify(data))); // Deep copy for local state
        }
    }, [isOpen]);

    const handleCategorySelect = (categoryId: string) => {
        setSelectedCategory(categoryId);
        setSelectedPrompt(null);
        setSelectedVersion(null);
        setPromptText('');
        setIsDirty(false);
    };

    const handlePromptSelect = (prompt: Prompt) => {
        setSelectedPrompt(prompt);
        const activeVersion = prompt.versions.find(v => v.versionId === prompt.activeVersionId) || prompt.versions[0];
        handleVersionSelect(activeVersion.versionId, prompt);
    };
    
    const handleVersionSelect = (versionId: string, prompt?: Prompt) => {
        const promptToUse = prompt || selectedPrompt;
        if (!promptToUse) return;

        const version = promptToUse.versions.find(v => v.versionId === versionId);
        if (version) {
            setSelectedVersion(version);
            setPromptText(version.prompt);
            setIsDirty(false);
        }
    };
    
    useEffect(() => {
        if(selectedVersion) {
            setIsDirty(promptText !== selectedVersion.prompt);
        }
    }, [promptText, selectedVersion]);


    const handleSaveAsNewVersion = () => {
        const versionName = prompt('Yeni versiyon için bir isim girin (örn: v2 - Daha detaylı):', `Versiyon ${selectedPrompt!.versions.length + 1}`);
        if (!versionName || !selectedPrompt) return;

        const newVersion: PromptVersion = {
            versionId: `v_${Date.now()}`,
            name: versionName,
            prompt: promptText,
            createdAt: new Date().toISOString(),
        };

        const updatedData = promptData.map(cat => {
            if (cat.id === selectedCategory) {
                return {
                    ...cat,
                    prompts: cat.prompts.map(p => {
                        if (p.id === selectedPrompt.id) {
                            const newPrompt = { ...p, versions: [...p.versions, newVersion] };
                            // Automatically select the new version
                             handlePromptSelect(newPrompt);
                            return newPrompt;
                        }
                        return p;
                    }),
                };
            }
            return cat;
        });
        
        setPromptData(updatedData);
        promptService.savePrompts(updatedData);
        setIsDirty(false);
    };

    const handleUpdateCurrentVersion = () => {
        if (!selectedPrompt || !selectedVersion || !isDirty || selectedVersion.versionId === 'default') return;

        if (!confirm("Mevcut versiyonun içeriğini bu değişiklikle kalıcı olarak güncellemek istediğinizden emin misiniz? Bu işlem geri alınamaz.")) {
            return;
        }
        
        let updatedPrompt: Prompt | null = null;

        const updatedData = promptData.map(cat => {
            if (cat.id === selectedCategory) {
                return {
                    ...cat,
                    prompts: cat.prompts.map(p => {
                        if (p.id === selectedPrompt.id) {
                            const newP = {
                                ...p,
                                versions: p.versions.map(v => 
                                    v.versionId === selectedVersion.versionId ? { ...v, prompt: promptText } : v
                                ),
                            };
                            updatedPrompt = newP; // Capture the updated prompt
                            return newP;
                        }
                        return p;
                    }),
                };
            }
            return cat;
        });

        promptService.savePrompts(updatedData);
        setPromptData(updatedData);
        
        if (updatedPrompt) {
            setSelectedPrompt(updatedPrompt);
            const updatedVersion = updatedPrompt.versions.find(v => v.versionId === selectedVersion.versionId);
            if (updatedVersion) {
                setSelectedVersion(updatedVersion);
            }
        }
        
        setIsDirty(false);
    };

    const handleDuplicateVersion = () => {
        if (!selectedPrompt || !selectedVersion) return;

        const newVersionName = prompt(
            'Yeni versiyon için bir isim girin:', 
            `${selectedVersion.name} - Kopya`
        );
        if (!newVersionName) return;

        const newVersion: PromptVersion = {
            versionId: `v_${Date.now()}`,
            name: newVersionName,
            prompt: selectedVersion.prompt, // Copy from the selected version
            createdAt: new Date().toISOString(),
        };
        
        let updatedPromptObject: Prompt | undefined;
        const updatedData = promptData.map(cat => {
            if (cat.id === selectedCategory) {
                return {
                    ...cat,
                    prompts: cat.prompts.map(p => {
                        if (p.id === selectedPrompt.id) {
                            const newPrompt = { ...p, versions: [...p.versions, newVersion] };
                            updatedPromptObject = newPrompt; // Capture it
                            return newPrompt;
                        }
                        return p;
                    }),
                };
            }
            return cat;
        });

        promptService.savePrompts(updatedData);
        setPromptData(updatedData);
        
        if (updatedPromptObject) {
            setSelectedPrompt(updatedPromptObject);
            // Switch to the new version
            handleVersionSelect(newVersion.versionId, updatedPromptObject);
        }
    };


    const handleSetActiveVersion = () => {
        if (!selectedPrompt || !selectedVersion) return;

        const updatedData = promptData.map(cat => {
            if (cat.id === selectedCategory) {
                return {
                    ...cat,
                    prompts: cat.prompts.map(p => 
                        p.id === selectedPrompt.id ? { ...p, activeVersionId: selectedVersion.versionId } : p
                    ),
                };
            }
            return cat;
        });

        setPromptData(updatedData);
        promptService.savePrompts(updatedData);
        // We need to re-select the prompt to update its state in the UI
        const updatedPrompt = updatedData.find(c => c.id === selectedCategory)?.prompts.find(p => p.id === selectedPrompt.id);
        if (updatedPrompt) setSelectedPrompt(updatedPrompt);
    };

    const handleResetAll = () => {
        if (confirm("Tüm promptları varsayılan ayarlara döndürmek istediğinizden emin misiniz? Kaydedilmiş tüm versiyonlar silinecektir.")) {
            const freshDefaults = promptService.resetToDefaults();
            setPromptData(JSON.parse(JSON.stringify(freshDefaults)));
            setSelectedCategory(null);
            setSelectedPrompt(null);
            setSelectedVersion(null);
            setPromptText('');
            alert("Tüm promptlar sıfırlandı. Değişikliklerin tamamen uygulanması için sayfayı yenilemeniz önerilir.");
        }
    };

    if (!isOpen) return null;

    const currentCategory = promptData.find(c => c.id === selectedCategory);

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Prompt Yöneticisi</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-600 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </header>

                <div className="flex-1 flex min-h-0">
                    {/* Sidebar */}
                    <nav className="w-1/4 border-r border-slate-200 dark:border-slate-700 p-2 flex flex-col">
                        <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 px-2 mb-2 uppercase tracking-wider">Kategoriler</h3>
                        <div className="flex-1 overflow-y-auto space-y-1">
                            {promptData.map(cat => (
                                <button key={cat.id} onClick={() => handleCategorySelect(cat.id)} className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${selectedCategory === cat.id ? 'bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-200' : 'hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
                                    {cat.name}
                                </button>
                            ))}
                        </div>
                        <div className="pt-2 mt-auto border-t border-slate-200 dark:border-slate-700">
                             <button onClick={handleResetAll} className="w-full text-center px-3 py-2 rounded-md text-sm font-medium transition-colors bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-900">
                                Tümünü Sıfırla
                            </button>
                        </div>
                    </nav>

                    {/* Main Content */}
                    <main className="flex-1 flex flex-col p-4 overflow-y-auto">
                        {currentCategory ? (
                            <div className="flex flex-col h-full">
                                <h3 className="text-lg font-bold mb-2">{currentCategory.name}</h3>
                                <div className="flex gap-4 flex-1 min-h-0">
                                    <div className="w-1/3 flex flex-col border-r border-slate-200 dark:border-slate-700 pr-4">
                                         <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">Prompt'lar</h4>
                                         <div className="flex-1 overflow-y-auto space-y-1 -mr-4 pr-4">
                                            {currentCategory.prompts.map(p => (
                                                <button key={p.id} onClick={() => handlePromptSelect(p)} className={`w-full text-left p-3 rounded-md border transition-colors ${selectedPrompt?.id === p.id ? 'bg-white dark:bg-slate-700 border-sky-500 shadow-sm' : 'bg-slate-100 dark:bg-slate-900/50 border-transparent hover:border-slate-300 dark:hover:border-slate-600'}`}>
                                                    <p className="font-semibold text-sm">{p.name}</p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{p.description}</p>
                                                </button>
                                            ))}
                                         </div>
                                    </div>
                                    <div className="w-2/3 flex flex-col">
                                        {selectedPrompt && selectedVersion ? (
                                            <>
                                                <div className="flex items-center justify-between mb-2">
                                                    <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Prompt İçeriği</h4>
                                                    <div className="flex items-center gap-2">
                                                        <label htmlFor="version-select" className="text-xs font-medium shrink-0">Versiyon:</label>
                                                        <div className="flex items-center w-full">
                                                            <select id="version-select" value={selectedVersion.versionId} onChange={e => handleVersionSelect(e.target.value)} className="w-full px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-sky-500 focus:outline-none bg-white dark:bg-slate-700">
                                                                {selectedPrompt.versions.map(v => (
                                                                    <option key={v.versionId} value={v.versionId}>{v.name} {v.versionId === selectedPrompt.activeVersionId && ' (Aktif)'}</option>
                                                                ))}
                                                            </select>
                                                            <button 
                                                                onClick={handleDuplicateVersion}
                                                                title="Bu versiyonu kopyala"
                                                                className="p-2 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors ml-1 shrink-0"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                                    <path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9z" />
                                                                    <path d="M5 3a2 2 0 00-2 2v6a2 2 0 002 2V5h6a2 2 0 00-2-2H5z" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                                {selectedPrompt.id === 'generateVisualization' ? (
                                                    <MermaidPromptEditor
                                                        value={promptText}
                                                        onValueChange={setPromptText}
                                                    />
                                                ) : (
                                                    <textarea 
                                                        value={promptText}
                                                        onChange={e => setPromptText(e.target.value)}
                                                        className="w-full flex-1 p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md font-mono text-sm leading-relaxed focus:ring-2 focus:ring-sky-500 focus:outline-none resize-none"
                                                    />
                                                )}
                                                <div className="flex items-center justify-end gap-3 mt-4">
                                                    <span className={`text-xs transition-opacity ${isDirty ? 'opacity-100' : 'opacity-0'} text-amber-600 dark:text-amber-400`}>Kaydedilmemiş değişiklik var</span>
                                                    <button onClick={handleSetActiveVersion} disabled={selectedPrompt.activeVersionId === selectedVersion.versionId} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-200 dark:bg-slate-700 rounded-md hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed">
                                                        Aktif Olarak Ayarla
                                                    </button>
                                                    <button 
                                                        onClick={handleUpdateCurrentVersion}
                                                        disabled={!isDirty || selectedVersion.versionId === 'default'}
                                                        title={selectedVersion.versionId === 'default' ? 'Varsayılan versiyon düzenlenemez.' : 'Mevcut versiyondaki değişiklikleri kaydet'}
                                                        className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        Değişiklikleri Kaydet
                                                    </button>
                                                    <button onClick={handleSaveAsNewVersion} disabled={!isDirty} className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-md shadow-sm hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-50 disabled:cursor-not-allowed">
                                                        Yeni Versiyon Olarak Kaydet
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                             <div className="flex items-center justify-center h-full text-slate-500 dark:text-slate-400">
                                                <p>İncelemek ve düzenlemek için bir prompt seçin.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-full text-slate-500 dark:text-slate-400">
                                <p>Başlamak için soldan bir kategori seçin.</p>
                            </div>
                        )}
                    </main>
                </div>
            </div>
        </div>
    );
};