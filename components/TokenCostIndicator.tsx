// components/TokenCostIndicator.tsx
import React from 'react';
import type { GeminiModel } from '../types';
import { Database } from 'lucide-react';

interface TokenCostIndicatorProps {
    tokens: number;
    model?: GeminiModel | string; // Allow string for flexibility
}

// Pricing per 1 Million tokens for output. We'll use output price for a conservative estimate.
// NOTE: These are example prices and may not reflect current official pricing.
const PRICING: Record<string, number> = {
    'gemini-2.5-pro': 7.00 / 1_000_000,
    'gemini-2.5-flash': 0.70 / 1_000_000,
    'gemini-2.5-flash-lite': 0.35 / 1_000_000,
    'default': 0.70 / 1_000_000, // Default to flash price
};


export const TokenCostIndicator: React.FC<TokenCostIndicatorProps> = ({ tokens, model = 'default' }) => {
    if (!tokens || tokens <= 0) {
        return null;
    }

    const pricePerToken = PRICING[model] || PRICING['default'];
    const cost = tokens * pricePerToken;
    const formattedCost = cost < 0.0001 ? '< $0.0001' : `~$${cost.toFixed(4)}`;

    return (
        <div 
            className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"
            title={`Model: ${model}`}
        >
            <Database className="h-3.5 w-3.5" />
            <span className="font-mono font-medium">{tokens.toLocaleString('tr-TR')}</span>
            <span>Token</span>
            <span className="font-mono">({formattedCost})</span>
        </div>
    );
};
