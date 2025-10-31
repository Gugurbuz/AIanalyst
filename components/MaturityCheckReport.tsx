// components/MaturityCheckReport.tsx
import React from 'react';
import type { MaturityReport, MaturityLevel } from '../types';
import { ClipboardCheck, CheckCircle2, AlertCircle, ChevronsUp, ThumbsUp, Award, Bot, X } from 'lucide-react';

interface MaturityCheckReportProps {
    report: MaturityReport | null;
    onPrepareQuestionForAnswer: (question: string) => void;
    onDismissQuestion: (question: string) => void;
    isLoading: boolean;
}

const levelInfo: Record<MaturityLevel, { icon: React.ReactElement, colorClasses: string, title: string }> = {
    'Zayıf': { 
        icon: <AlertCircle className="h-8 w-8" />, 
        colorClasses: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border-red-300 dark:border-red-600',
        title: 'Zayıf' 
    },
    'Gelişime Açık': { 
        icon: <ChevronsUp className="h-8 w-8" />, 
        colorClasses: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-600',
        title: 'Gelişime Açık' 
    },
    'İyi': { 
        icon: <ThumbsUp className="h-8 w-8" />, 
        colorClasses: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-600',
        title: 'İyi' 
    },
    'Mükemmel': { 
        icon: <Award className="h-8 w-8" />, 
        colorClasses: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-600',
        title: 'Mükemmel' 
    },
};

const RadarChart: React.FC<{ data: MaturityReport['scores'] }> = ({ data }) => {
    const size = 240;
    const center = size / 2;
    const radius = size * 0.35;
    const labels = {
        scope: "Kapsam",
        technical: "Tek",
        userFlow: "Akış",
        nonFunctional: "NFR"
    };

    const points = Object.keys(data).map((key, i, arr) => {
        const value = (data[key as keyof typeof data] || 0) / 100;
        const angle = (i / arr.length) * 2 * Math.PI - Math.PI / 2;
        const x = center + radius * value * Math.cos(angle);
        const y = center + radius * value * Math.sin(angle);
        return `${x},${y}`;
    }).join(' ');

    const axisPoints = Object.keys(labels).map((_, i, arr) => {
        const angle = (i / arr.length) * 2 * Math.PI - Math.PI / 2;
        const x = center + radius * Math.cos(angle);
        const y = center + radius * Math.sin(angle);
        return { x, y };
    });
    
    const labelPoints = Object.keys(labels).map((_, i, arr) => {
        const angle = (i / arr.length) * 2 * Math.PI - Math.PI / 2;
        const x = center + (radius + 25) * Math.cos(angle);
        const y = center + (radius + 25) * Math.sin(angle);
        return { x, y };
    });

    return (
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-auto max-w-[300px] mx-auto">
            {/* Grid lines */}
            <g className="stroke-slate-200 dark:stroke-slate-700">
                {[0.25, 0.5, 0.75, 1].map(r => (
                    <polygon 
                        key={r}
                        points={Object.keys(data).map((_, i, arr) => {
                            const angle = (i / arr.length) * 2 * Math.PI - Math.PI / 2;
                            const x = center + radius * r * Math.cos(angle);
                            const y = center + radius * r * Math.sin(angle);
                            return `${x},${y}`;
                        }).join(' ')}
                        fill="none"
                        strokeWidth="1"
                    />
                ))}
            </g>
            {/* Axes */}
            <g className="stroke-slate-300 dark:stroke-slate-600">
                 {axisPoints.map((p, i) => <line key={i} x1={center} y1={center} x2={p.x} y2={p.y} strokeWidth="1" />)}
            </g>
            {/* Data Polygon */}
            <polygon points={points} className="fill-indigo-500/30 stroke-indigo-600 dark:stroke-indigo-400" strokeWidth="2" />

            {/* Labels */}
            {Object.values(labels).map((label, i) => (
                <text 
                    key={label}
                    x={labelPoints[i].x} 
                    y={labelPoints[i].y}
                    textAnchor="middle"
                    dy="0.3em"
                    className="text-[10px] font-semibold fill-slate-600 dark:fill-slate-300"
                >{label}</text>
            ))}
        </svg>
    );
};


export const MaturityCheckReport: React.FC<MaturityCheckReportProps> = ({ report, onPrepareQuestionForAnswer, onDismissQuestion, isLoading }) => {
    
    if (!report) {
         return (
            <div className="p-6 text-center text-slate-500 dark:text-slate-400">
                <ClipboardCheck className="mx-auto h-12 w-12 text-slate-400" strokeWidth={1} />
                <h3 className="mt-2 text-lg font-medium text-slate-800 dark:text-slate-200">Olgunluk Raporu</h3>
                <p className="mt-1 text-sm">Analiz olgunluğu, siz sohbet ettikçe yapay zeka tarafından otomatik olarak değerlendirilir.</p>
            </div>
        );
    }

    const { isSufficient, summary, missingTopics, suggestedQuestions, scores, overallScore, justification, maturity_level } = report;
    const currentLevelInfo = levelInfo[maturity_level] || levelInfo['Gelişime Açık'];

    return (
        <div className="p-4 md:p-6 space-y-6">
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">Proje Sağlık Paneli</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div className="flex flex-col justify-center">
                     <div className={`p-4 rounded-lg border ${currentLevelInfo.colorClasses} flex items-center gap-4`}>
                        <div className="flex-shrink-0">{currentLevelInfo.icon}</div>
                        <div>
                             <h4 className="text-lg font-bold">Genel Durum: {currentLevelInfo.title}</h4>
                             <p className="text-sm font-medium">{justification}</p>
                        </div>
                    </div>
                     <div className="mt-4 text-center">
                        <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">Genel Olgunluk Puanı</span>
                        <p className="text-5xl font-bold text-slate-800 dark:text-slate-100">{overallScore}<span className="text-2xl text-slate-500">/100</span></p>
                    </div>
                </div>
                 <div className="w-full">
                    <RadarChart data={scores} />
                </div>
            </div>
            
            <div className="space-y-2">
                 <h4 className="text-md font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Bot className="h-5 w-5 text-indigo-500" />
                    Asisty Değerlendirmesi
                </h4>
                 <p className="text-sm text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/50 p-3 rounded-md border border-slate-200 dark:border-slate-700">
                    {summary}
                </p>
            </div>

            {!isSufficient && missingTopics.length > 0 && (
                <div>
                    <h4 className="text-md font-semibold text-slate-700 dark:text-slate-300 mb-2">Eksik Konu Başlıkları</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/50 p-3 rounded-md border border-slate-200 dark:border-slate-700">
                        {missingTopics.map((topic, index) => <li key={index}>{topic}</li>)}
                    </ul>
                </div>
            )}
            
             {suggestedQuestions.length > 0 && (
                <div>
                    <h4 className="text-md font-semibold text-slate-700 dark:text-slate-300 mb-2">Analizi İlerletmek İçin Önerilen Sorular</h4>
                    <div className="flex flex-wrap gap-2">
                        {suggestedQuestions.map((q, index) => (
                             <div key={index} className="flex items-center gap-0.5 bg-sky-100 dark:bg-sky-900/50 rounded-full transition-colors duration-200 group">
                                <button 
                                    onClick={() => onPrepareQuestionForAnswer(q)}
                                    className="pl-3 pr-2 py-1.5 text-sky-800 dark:text-sky-200 text-sm hover:text-sky-900 dark:hover:text-sky-100"
                                >
                                    {q}
                                </button>
                                <button
                                    onClick={() => onDismissQuestion(q)}
                                    className="p-1 rounded-full text-sky-600 dark:text-sky-400 hover:bg-sky-200 dark:hover:bg-sky-800 mr-1"
                                    title="Bu soruyu kaldır"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};