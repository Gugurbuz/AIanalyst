import React from 'react';
import { Toaster } from 'react-hot-toast';

export const ToastProvider: React.FC = () => {
    return (
        <Toaster
            position="top-right"
            reverseOrder={false}
            gutter={8}
            toastOptions={{
                duration: 4000,
                style: {
                    background: 'var(--toast-bg)',
                    color: 'var(--toast-text)',
                    border: '1px solid var(--toast-border)',
                    padding: '12px 16px',
                    fontSize: '14px',
                },
                success: {
                    duration: 3000,
                    iconTheme: {
                        primary: '#10b981',
                        secondary: '#fff',
                    },
                },
                error: {
                    duration: 5000,
                    iconTheme: {
                        primary: '#ef4444',
                        secondary: '#fff',
                    },
                },
                loading: {
                    iconTheme: {
                        primary: '#6366f1',
                        secondary: '#fff',
                    },
                },
            }}
        />
    );
};
