// components/RequestDocumentViewer.tsx
import React from 'react';
import type { IsBirimiTalep } from '../types';
import { FileText, User, Target, AlertTriangle, CheckCircle, Code, List, ListX, Zap } from 'lucide-react';

interface RequestDocumentViewerProps {
    document: IsBirimiTalep | null; // Allow null
    isEditing?: boolean;
    onChange?: (updatedDocument: IsBirimiTalep) => void;
}

const Section: React.FC<{ icon: React.ReactElement; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
    <div className="mb-8">
        <div className="flex items-center mb-3">
            {/* FIX: Cast icon to a type that accepts 'size' to resolve cloneElement error. */}
            <div className="text-indigo-500 mr-3">{React.cloneElement(icon as React.ReactElement<{ size: number }>, { size: 20 })}</div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">{title}</h2>
        </div>
        <div className="pl-8 text-slate-600 dark:text-slate-400 prose prose-slate dark:prose-invert max-w-none">
            {children}
        </div>
    </div>
);

const EditableField: React.FC<{ isEditing?: boolean; value: string; onSave: (newValue: string) => void; className?: string, as?: 'p' | 'h1' | 'span' }> = ({ isEditing, value, onSave, className, as = 'span' }) => {
    const Element = as;
    return (
        <Element
            contentEditable={isEditing}
            suppressContentEditableWarning={true}
            onBlur={(e) => onSave(e.currentTarget.innerText)}
            dangerouslySetInnerHTML={{ __html: value }}
            className={`editable-content ${className} ${isEditing ? 'outline-none focus:bg-indigo-50 dark:focus:bg-slate-800 rounded-md px-1 -mx-1 ring-1 ring-transparent focus:ring-indigo-500 transition-all' : ''}`}
        />
    );
};

export const RequestDocumentViewer: React.FC<RequestDocumentViewerProps> = ({ document, isEditing, onChange }) => {
    
    // Safety Guard: Prevent component crash if the document data is null or malformed.
    if (!document || typeof document !== 'object' || !document.talepAdi) {
        return (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400 flex flex-col items-center justify-center h-full">
                <AlertTriangle className="mx-auto h-10 w-10 text-amber-400" />
                <h3 className="mt-2 text-lg font-medium text-slate-700 dark:text-slate-300">Talep Dokümanı Yüklenemedi</h3>
                <p className="mt-1 text-sm">Bu dokümanın içeriği bozuk veya eksik olabilir. Lütfen sohbet geçmişini kontrol edin veya dokümanı yeniden oluşturmayı deneyin.</p>
            </div>
        );
    }

    const handleFieldChange = (field: keyof IsBirimiTalep, value: any) => {
        if (!onChange || !document) return;
        onChange({ ...document, [field]: value });
    };

    const handleListChange = (listName: 'inScope' | 'outOfScope' | 'beklenenIsFaydalari', e: React.FocusEvent<HTMLUListElement>) => {
        if (!onChange || !document) return;
        const items = Array.from(e.currentTarget.querySelectorAll('li'))
            // FIX: Explicitly type `li` as `HTMLLIElement` to resolve TypeScript error where `li` was inferred as `unknown`.
            .map((li: HTMLLIElement) => (li.textContent || '').trim())
            .filter(text => text.length > 0);
        
        const newDoc = JSON.parse(JSON.stringify(document)); // Deep copy
        
        if (listName === 'beklenenIsFaydalari') {
            newDoc.beklenenIsFaydalari = items;
        } else {
            newDoc.kapsam[listName] = items;
        }
        onChange(newDoc);
    };
    
    return (
        <div className={`p-4 md:p-8 h-full overflow-y-auto bg-white dark:bg-slate-900 transition-all ${isEditing ? 'ring-2 ring-indigo-500 ring-inset' : ''}`}>
             <style>{`
                .editable-content[contenteditable="true"]:empty:before {
                    content: attr(data-placeholder);
                    color: #94a3b8; /* slate-400 */
                    cursor: text;
                }
                .editable-li[contenteditable="true"]:empty:after {
                    content: 'Yeni madde...';
                    color: #94a3b8; /* slate-400 */
                    cursor: text;
                    display: block;
                    margin-top: -1.5em; 
                }
            `}</style>
            <header className="border-b border-slate-200 dark:border-slate-700 pb-4 mb-8">
                <EditableField
                    as="h1"
                    isEditing={isEditing}
                    value={document.talepAdi}
                    onSave={(val) => handleFieldChange('talepAdi', val)}
                    className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight"
                />
                <div className="flex items-center flex-wrap gap-x-6 gap-y-2 mt-3 text-sm text-slate-500 dark:text-slate-400">
                    <span><strong>Doküman No:</strong> <EditableField isEditing={isEditing} value={document.dokumanNo} onSave={val => handleFieldChange('dokumanNo', val)} /></span>
                    <span><strong>Revizyon:</strong> <EditableField isEditing={isEditing} value={document.revizyon} onSave={val => handleFieldChange('revizyon', val)} /></span>
                    <span><strong>Tarih:</strong> <EditableField isEditing={isEditing} value={document.tarih} onSave={val => handleFieldChange('tarih', val)} /></span>
                    <span><strong>Talep Sahibi:</strong> <EditableField isEditing={isEditing} value={document.talepSahibi} onSave={val => handleFieldChange('talepSahibi', val)} /></span>
                </div>
            </header>

            <main>
                <Section icon={<AlertTriangle />} title="Mevcut Durum & Problem">
                     <EditableField as="p" isEditing={isEditing} value={document.mevcutDurumProblem} onSave={val => handleFieldChange('mevcutDurumProblem', val)} />
                </Section>

                <Section icon={<Target />} title="Talebin Amacı ve Gerekçesi">
                     <EditableField as="p" isEditing={isEditing} value={document.talepAmaciGerekcesi} onSave={val => handleFieldChange('talepAmaciGerekcesi', val)} />
                </Section>

                <Section icon={<Code />} title="Kapsam">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h3 className="flex items-center font-semibold text-lg mb-2 text-emerald-600 dark:text-emerald-400"><List className="mr-2" size={18}/> Kapsam Dahili</h3>
                            <ul 
                                className="list-disc pl-5 space-y-1"
                                contentEditable={isEditing}
                                suppressContentEditableWarning={true}
                                onBlur={(e) => handleListChange('inScope', e)}
                            >
                                {document.kapsam.inScope.map((item, index) => <li key={index}>{item}</li>)}
                                {isEditing && document.kapsam.inScope.length === 0 && <li className="editable-li"></li>}
                            </ul>
                        </div>
                        <div>
                            <h3 className="flex items-center font-semibold text-lg mb-2 text-red-600 dark:text-red-400"><ListX className="mr-2" size={18}/> Kapsam Dışı</h3>
                             <ul 
                                className="list-disc pl-5 space-y-1"
                                contentEditable={isEditing}
                                suppressContentEditableWarning={true}
                                onBlur={(e) => handleListChange('outOfScope', e)}
                            >
                                {document.kapsam.outOfScope.map((item, index) => <li key={index}>{item}</li>)}
                                {isEditing && document.kapsam.outOfScope.length === 0 && <li className="editable-li"></li>}
                            </ul>
                        </div>
                    </div>
                </Section>

                <Section icon={<Zap />} title="Beklenen İş Faydaları">
                    <ul 
                        className="list-disc pl-5 space-y-1"
                        contentEditable={isEditing}
                        suppressContentEditableWarning={true}
                        onBlur={(e) => handleListChange('beklenenIsFaydalari', e)}
                    >
                        {document.beklenenIsFaydalari.map((item, index) => <li key={index}>{item}</li>)}
                        {isEditing && document.beklenenIsFaydalari.length === 0 && <li className="editable-li"></li>}
                    </ul>
                </Section>
            </main>
        </div>
    );
};