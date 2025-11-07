// components/RequestDocumentEditor.tsx
import React from 'react';
import type { IsBirimiTalep } from '../types';
import { FileText, Target, AlertTriangle, Code, List, ListX, Zap } from 'lucide-react';

interface RequestDocumentEditorProps {
    document: IsBirimiTalep;
    onChange: (updatedDocument: IsBirimiTalep) => void;
}

const Section: React.FC<{ icon: React.ReactElement; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
    <div className="mb-6">
        <div className="flex items-center mb-3">
            {/* FIX: Cast icon to a type that accepts 'size' to resolve cloneElement error. */}
            <div className="text-indigo-500 mr-3">{React.cloneElement(icon as React.ReactElement<{ size: number }>, { size: 20 })}</div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">{title}</h2>
        </div>
        <div className="pl-8 space-y-4">
            {children}
        </div>
    </div>
);

const LabeledInput: React.FC<{ label: string; value: string; onChange: (value: string) => void; }> = ({ label, value, onChange }) => (
    <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{label}</label>
        <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-slate-50 dark:bg-slate-700"
        />
    </div>
);

const LabeledTextarea: React.FC<{ label: string; value: string; onChange: (value: string) => void; rows?: number }> = ({ label, value, onChange, rows = 3 }) => (
    <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{label}</label>
        <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={rows}
            className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-slate-50 dark:bg-slate-700"
        />
    </div>
);

const LabeledListTextarea: React.FC<{ label: string; icon: React.ReactElement; value: string[]; onChange: (value: string[]) => void; }> = ({ label, icon, value, onChange }) => (
     <div>
        <h3 className="flex items-center font-semibold text-lg mb-2 text-slate-700 dark:text-slate-300">{icon} {label}</h3>
        <textarea
            value={value.join('\n')}
            onChange={(e) => onChange(e.target.value.split('\n'))}
            rows={5}
            className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-slate-50 dark:bg-slate-700"
            placeholder="Her maddeyi yeni bir satıra yazın..."
        />
    </div>
)


export const RequestDocumentEditor: React.FC<RequestDocumentEditorProps> = ({ document, onChange }) => {
    
    const handleFieldChange = (field: keyof IsBirimiTalep, value: any) => {
        onChange({ ...document, [field]: value });
    };

    return (
        <div className="p-4 md:p-8 h-full overflow-y-auto bg-white dark:bg-slate-900">
             <header className="border-b border-slate-200 dark:border-slate-700 pb-4 mb-6">
                <LabeledInput
                    label="Talep Adı"
                    value={document.talepAdi}
                    onChange={(val) => handleFieldChange('talepAdi', val)}
                />
                 <div className="flex items-center flex-wrap gap-x-6 gap-y-2 mt-4 text-sm text-slate-500 dark:text-slate-400">
                     <LabeledInput label="Doküman No" value={document.dokumanNo} onChange={val => handleFieldChange('dokumanNo', val)} />
                     <LabeledInput label="Revizyon" value={document.revizyon} onChange={val => handleFieldChange('revizyon', val)} />
                     <LabeledInput label="Tarih" value={document.tarih} onChange={val => handleFieldChange('tarih', val)} />
                     <LabeledInput label="Talep Sahibi" value={document.talepSahibi} onChange={val => handleFieldChange('talepSahibi', val)} />
                </div>
            </header>

            <main>
                <Section icon={<AlertTriangle />} title="Mevcut Durum & Problem">
                    <LabeledTextarea
                        label=""
                        value={document.mevcutDurumProblem}
                        onChange={(val) => handleFieldChange('mevcutDurumProblem', val)}
                        rows={4}
                    />
                </Section>
                 <Section icon={<Target />} title="Talebin Amacı ve Gerekçesi">
                    <LabeledTextarea
                        label=""
                        value={document.talepAmaciGerekcesi}
                        onChange={(val) => handleFieldChange('talepAmaciGerekcesi', val)}
                        rows={4}
                    />
                </Section>
                 <Section icon={<Code />} title="Kapsam">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <LabeledListTextarea 
                            label="Kapsam Dahili"
                            icon={<List className="mr-2" size={18}/>}
                            value={document.kapsam.inScope}
                            onChange={(val) => handleFieldChange('kapsam', { ...document.kapsam, inScope: val })}
                       />
                       <LabeledListTextarea 
                            label="Kapsam Dışı"
                            icon={<ListX className="mr-2" size={18}/>}
                            value={document.kapsam.outOfScope}
                            onChange={(val) => handleFieldChange('kapsam', { ...document.kapsam, outOfScope: val })}
                       />
                    </div>
                </Section>
                 <Section icon={<Zap />} title="Beklenen İş Faydaları">
                     <LabeledListTextarea 
                        label=""
                        icon={<></>}
                        value={document.beklenenIsFaydalari}
                        onChange={(val) => handleFieldChange('beklenenIsFaydalari', val)}
                     />
                </Section>
            </main>
        </div>
    );
};