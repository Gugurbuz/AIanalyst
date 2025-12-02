
import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
    children?: ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    public state: ErrorBoundaryState = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
                    <div className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-xl max-w-md w-full text-center border border-slate-200 dark:border-slate-700">
                        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/50 mb-6">
                            <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                            Bir şeyler ters gitti
                        </h2>
                        <p className="text-slate-600 dark:text-slate-400 mb-6">
                            Uygulama beklenmedik bir hatayla karşılaştı. Lütfen sayfayı yenilemeyi deneyin.
                        </p>
                        {this.state.error && (
                            <details className="text-left bg-slate-100 dark:bg-slate-900 p-3 rounded-md mb-6 overflow-auto max-h-32 text-xs font-mono text-slate-500 dark:text-slate-400">
                                <summary className="cursor-pointer mb-1 hover:text-slate-700 dark:hover:text-slate-300">Hata Detayları</summary>
                                {this.state.error.toString()}
                            </details>
                        )}
                        <button
                            onClick={() => window.location.reload()}
                            className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors w-full"
                        >
                            <RefreshCw className="h-5 w-5 mr-2" />
                            Sayfayı Yenile
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
