// components/RequestDocumentViewer.tsx
import React from 'react';
import type { IsBirimiTalep } from '../types';
import { FileText, User, Target, AlertTriangle, CheckCircle, Code, List, ListX, Zap } from 'lucide-react';

interface RequestDocumentViewerProps {
    document: IsBirimiTalep;
}

const Section: React.FC<{ icon: React.ReactElement; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
    <div className="mb-8">
        <div className="flex items-center mb-3">
            <div className="text-indigo-500 mr-3">{React.cloneElement(icon as React.ReactElement<{ size: number }>, { size: 20 })}</div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">{title}</h2>
        </div>
        <div className="pl-8 text-slate-600 dark:text-slate-400 prose prose-slate dark:prose-invert max-w-none">
            {children}
        </div>
    </div>
);


export const RequestDocumentViewer: React.FC<RequestDocumentViewerProps> = ({ document }) => {
    
    return (
        <div className="p-4 md:p-8 h-full overflow-y-auto bg-white dark:bg-slate-900">
            <header className="border-b border-slate-200 dark:border-slate-700 pb-4 mb-8">
                <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                    {document.talepAdi}
                </h1>
                <div className="flex items-center flex-wrap gap-x-6 gap-y-2 mt-3 text-sm text-slate-500 dark:text-slate-400">
                    <span><strong>Doküman No:</strong> {document.dokumanNo}</span>
                    <span><strong>Revizyon:</strong> {document.revizyon}</span>
                    <span><strong>Tarih:</strong> {document.tarih}</span>
                    <span><strong>Talep Sahibi:</strong> {document.talepSahibi}</span>
                </div>
            </header>

            <main>
                <Section icon={<AlertTriangle />} title="Mevcut Durum & Problem">
                     <p>{document.mevcutDurumProblem}</p>
                </Section>

                <Section icon={<Target />} title="Talebin Amacı ve Gerekçesi">
                     <p>{document.talepAmaciGerekcesi}</p>
                </Section>

                <Section icon={<Code />} title="Kapsam">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h3 className="flex items-center font-semibold text-lg mb-2 text-emerald-600 dark:text-emerald-400"><List className="mr-2" size={18}/> Kapsam Dahili</h3>
                            <ul className="list-disc pl-5 space-y-1">
                                {document.kapsam.inScope.map((item, index) => <li key={index}>{item}</li>)}
                            </ul>
                        </div>
                        <div>
                            <h3 className="flex items-center font-semibold text-lg mb-2 text-red-600 dark:text-red-400"><ListX className="mr-2" size={18}/> Kapsam Dışı</h3>
                             <ul className="list-disc pl-5 space-y-1">
                                {document.kapsam.outOfScope.map((item, index) => <li key={index}>{item}</li>)}
                            </ul>
                        </div>
                    </div>
                </Section>

                <Section icon={<Zap />} title="Beklenen İş Faydaları">
                    <ul className="list-disc pl-5 space-y-1">
                        {document.beklenenIsFaydalari.map((item, index) => <li key={index}>{item}</li>)}
                    </ul>
                </Section>
            </main>
        </div>
    );
};