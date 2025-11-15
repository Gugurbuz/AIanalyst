import React, { useState, useEffect, useCallback } from 'react';
import { promptService } from '../services/promptService';
import type { PromptData, Prompt, PromptVersion } from '../types';
import { TemplateGeneratorModal } from './TemplateGeneratorModal';
import { FileUp } from 'lucide-react';

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
    const [mobileViewPanel, setMobileViewPanel] = useState<'categories' | 'prompts' | 'editor'>('categories');
    const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const data = promptService.getPromptData();
            setPromptData(JSON.parse(JSON.stringify(data))); // Deep copy for local state
            setMobileViewPanel('categories'); // Reset mobile view on open
        }
    }, [isOpen]);

    const handleCategorySelect = (categoryId: string) => {
        setSelectedCategory(categoryId);
        setSelectedPrompt(null);
        setSelectedVersion(null);
        setPromptText('');
        setIsDirty(false);
        if (window.innerWidth < 768) { // If on mobile, switch to prompts view
            setMobileViewPanel('prompts');
        }
    };

    const handlePromptSelect = (prompt: Prompt) => {
        setSelectedPrompt(prompt);
        const activeVersion = prompt.versions.find(v => v.versionId === prompt.activeVersionId) || prompt.versions[0];
        handleVersionSelect(activeVersion.versionId, prompt);
        if (window.innerWidth < 768) { // If on mobile, switch to editor view
            setMobileViewPanel('editor');
        }
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
            setMobileViewPanel('categories'); // Reset mobile view
            alert("Tüm promptlar sıfırlandı. Değişikliklerin tamamen uygulanması için sayfayı yenilemeniz önerilir.");
        }
    };

    const handleSaveNewTemplate = (newPrompt: Omit<Prompt, 'id' | 'versions' | 'activeVersionId'> & { prompt: string }) => {
        const newFullPrompt: Prompt = {
            id: `custom_${newPrompt.name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`,
            name: newPrompt.name,
            description: newPrompt.description,
            document_type: newPrompt.document_type,
            is_system_template: false,
            versions: [{
                versionId: 'default',
                name: 'Versiyon 1',
                createdAt: new Date().toISOString(),
                prompt: newPrompt.prompt
            }],
            activeVersionId: 'default'
        };

        const updatedData = [...promptData];
        let customCategory = updatedData.find(c => c.id === 'custom');
        if (!customCategory) {
            customCategory = { id: 'custom', name: 'Özel Şablonlar', prompts: [] };
            updatedData.push(customCategory);
        }
        customCategory.prompts.push(newFullPrompt);
        
        setPromptData(updatedData);
        promptService.savePrompts(updatedData);
        setIsGeneratorOpen(false);
        alert("Yeni şablon başarıyla kaydedildi!");
    };

    if (!isOpen) return null;

    const currentCategory = promptData.find(c => c.id === selectedCategory);

    return (
        <div className="fixed inset-0 bg-black/60 z-70 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg shadow-2xl w-full max-w-full sm:max-w-6xl h-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Prompt Yöneticisi</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-600 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </header>

                <div className="flex-1 flex min-h-0 relative">
                    {/* Categories Sidebar - Always visible on desktop, conditionally visible on mobile */}
                    <nav className={`w-full md:w-1/4 border-r border-slate-200 dark:border-slate-700 p-2 flex flex-col flex-shrink-0 
                                    ${mobileViewPanel === 'categories' ? 'block' : 'hidden md:block'}`}>
                        <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 px-2 mb-2 uppercase tracking-wider">Kategoriler</h3>
                        <div className="flex-1 overflow-y-auto space-y-1">
                            {promptData.map(cat => (
                                <button key={cat.id} onClick={() => handleCategorySelect(cat.id)} className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${selectedCategory === cat.id ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-200' : 'hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
                                    {cat.name}
                                </button>
                            ))}
                        </div>
                        <div className="pt-2 mt-auto border-t border-slate-200 dark:border-slate-700 space-y-2">
                             <button onClick={() => setIsGeneratorOpen(true)} className="w-full text-center px-3 py-2 rounded-md text-sm font-medium transition-colors bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-200 hover:bg-indigo-200 dark:hover:bg-indigo-900 flex items-center justify-center gap-2">
                                <FileUp className="h-4 w-4" /> Dosyadan Şablon Oluştur
                            </button>
                             <button onClick={handleResetAll} className="w-full text-center px-3 py-2 rounded-md text-sm font-medium transition-colors bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-900">
                                Tümünü Sıfırla
                            </button>
                        </div>
                    </nav>

                    {/* Main Content Area */}
                    <main className={`flex-1 flex flex-col p-4 overflow-y-auto 
                                    ${mobileViewPanel === 'categories' ? 'hidden md:flex' : 'flex'}`}> {/* Hide on mobile if categories are active */}
                        {currentCategory ? (
                            <div className="flex flex-col h-full">
                                <h3 className="text-lg font-bold mb-2 hidden md:block">{currentCategory.name}</h3>
                                <div className="flex flex-col md:flex-row gap-4 flex-1 min-h-0">
                                    {/* Prompts List - Always visible on desktop, conditionally visible on mobile */}
                                    <div className={`w-full md:w-1/3 flex flex-col border-slate-200 dark:border-slate-700 md:border-r pr-4 
                                                    ${mobileViewPanel === 'prompts' ? 'block' : 'hidden md:block'}`}>
                                        <div className="flex items-center justify-between mb-2">
                                            <button onClick={() => setMobileViewPanel('categories')} className="md:hidden p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                            </button>
                                            <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex-1 md:text-left">Prompt'lar</h4>
                                        </div>
                                        <div className="flex-1 overflow-y-auto space-y-1 -mr-4 pr-4">
                                            {currentCategory.prompts.map(p => (
                                                <button key={p.id} onClick={() => handlePromptSelect(p)} className={`w-full text-left p-3 rounded-md border transition-colors ${selectedPrompt?.id === p.id ? 'bg-white dark:bg-slate-700 border-indigo-500 shadow-sm' : 'bg-slate-100 dark:bg-slate-900/50 border-transparent hover:border-slate-300 dark:hover:border-slate-600'}`}>
                                                    <p className="font-semibold text-sm">{p.name}</p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{p.description}</p>
                                                </button>
                                            ))}
                                         </div>
                                    </div>
                                    {/* Prompt Editor - Always visible on desktop, conditionally visible on mobile */}
                                    <div className={`w-full md:w-2/3 flex flex-col 
                                                    ${mobileViewPanel === 'editor' ? 'block' : 'hidden md:block'}`}>
                                        {selectedPrompt && selectedVersion ? (
                                            <>
                                                <div className="flex items-center justify-between mb-2">
                                                    <button onClick={() => setMobileViewPanel('prompts')} className="md:hidden p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                                    </button>
                                                    <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex-1 md:text-left">Prompt İçeriği</h4>
                                                    <div className="flex items-center gap-2">
                                                        <label htmlFor="version-select" className="text-xs font-medium shrink-0">Versiyon:</label>
                                                        <div className="flex items-center w-full">
                                                            <select id="version-select" value={selectedVersion.versionId} onChange={e => handleVersionSelect(e.target.value)} className="w-full px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white dark:bg-slate-700">
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
                                                <textarea 
                                                    value={promptText}
                                                    onChange={e => setPromptText(e.target.value)}
                                                    className="w-full flex-1 p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md font-mono text-sm leading-relaxed focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
                                                    placeholder={selectedPrompt.id === 'generateVisualization' ? "Mermaid.js diyagramı için promptu buraya girin." : "Prompt içeriğini buraya girin."}
                                                />
                                                <div className="flex flex-col sm:flex-row items-center justify-end gap-3 mt-4">
                                                    <span className={`text-xs transition-opacity ${isDirty ? 'opacity-100' : 'opacity-0'} text-amber-600 dark:text-amber-400`}>Kaydedilmemiş değişiklik var</span>
                                                    <button onClick={handleSetActiveVersion} disabled={selectedPrompt.activeVersionId === selectedVersion.versionId} className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-200 dark:bg-slate-700 rounded-md hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed">
                                                        Aktif Olarak Ayarla
                                                    </button>
                                                    <button 
                                                        onClick={handleUpdateCurrentVersion}
                                                        disabled={!isDirty || selectedVersion.versionId === 'default'}
                                                        title={selectedVersion.versionId === 'default' ? 'Varsayılan versiyon düzenlenemez.' : 'Mevcut versiyondaki değişiklikleri kaydet'}
                                                        className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        Değişiklikleri Kaydet
                                                    </button>
                                                    <button onClick={handleSaveAsNewVersion} disabled={!isDirty} className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed">
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
                {isGeneratorOpen && (
                    <TemplateGeneratorModal 
                        isOpen={isGeneratorOpen}
                        onClose={() => setIsGeneratorOpen(false)}
                        onSave={handleSaveNewTemplate}
                    />
                )}
            </div>
        </div>
    );
};