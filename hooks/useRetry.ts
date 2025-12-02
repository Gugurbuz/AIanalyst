import { useState, useCallback } from 'react';
import { showToast } from '../utils/toast';

interface RetryOptions {
    maxAttempts?: number;
    delay?: number;
    onRetry?: (attempt: number) => void;
    onSuccess?: () => void;
    onFailure?: (error: Error) => void;
}

export const useRetry = <T extends (...args: any[]) => Promise<any>>(
    fn: T,
    options: RetryOptions = {}
) => {
    const {
        maxAttempts = 3,
        delay = 1000,
        onRetry,
        onSuccess,
        onFailure,
    } = options;

    const [isRetrying, setIsRetrying] = useState(false);
    const [attemptCount, setAttemptCount] = useState(0);

    const execute = useCallback(
        async (...args: Parameters<T>): Promise<ReturnType<T> | null> => {
            let lastError: Error | null = null;

            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                try {
                    setAttemptCount(attempt);
                    setIsRetrying(attempt > 1);

                    if (attempt > 1) {
                        onRetry?.(attempt);
                        await new Promise((resolve) => setTimeout(resolve, delay * attempt));
                    }

                    const result = await fn(...args);
                    setIsRetrying(false);
                    setAttemptCount(0);
                    onSuccess?.();
                    return result;
                } catch (error) {
                    lastError = error as Error;
                    console.error(`Attempt ${attempt} failed:`, error);

                    if (attempt === maxAttempts) {
                        setIsRetrying(false);
                        setAttemptCount(0);
                        onFailure?.(lastError);
                        showToast.error(
                            `İşlem ${maxAttempts} denemeden sonra başarısız oldu`
                        );
                        throw lastError;
                    }
                }
            }

            return null;
        },
        [fn, maxAttempts, delay, onRetry, onSuccess, onFailure]
    );

    const reset = useCallback(() => {
        setIsRetrying(false);
        setAttemptCount(0);
    }, []);

    return {
        execute,
        isRetrying,
        attemptCount,
        reset,
    };
};
