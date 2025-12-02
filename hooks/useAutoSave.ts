import { useEffect, useRef, useCallback } from 'react';
import { showToast } from '../utils/toast';

interface UseAutoSaveOptions {
    onSave: () => Promise<void> | void;
    delay?: number;
    enabled?: boolean;
}

export const useAutoSave = ({
    onSave,
    delay = 30000,
    enabled = true,
}: UseAutoSaveOptions) => {
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isSavingRef = useRef(false);
    const lastSaveTimeRef = useRef<number>(Date.now());

    const triggerSave = useCallback(async () => {
        if (!enabled || isSavingRef.current) return;

        isSavingRef.current = true;
        try {
            await onSave();
            lastSaveTimeRef.current = Date.now();
        } catch (error) {
            console.error('Auto-save failed:', error);
            showToast.error('Otomatik kayıt başarısız oldu');
        } finally {
            isSavingRef.current = false;
        }
    }, [onSave, enabled]);

    const scheduleAutoSave = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        if (enabled) {
            timeoutRef.current = setTimeout(() => {
                triggerSave();
            }, delay);
        }
    }, [delay, enabled, triggerSave]);

    const saveNow = useCallback(async () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        await triggerSave();
    }, [triggerSave]);

    useEffect(() => {
        scheduleAutoSave();

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [scheduleAutoSave]);

    return {
        saveNow,
        isSaving: isSavingRef.current,
        lastSaveTime: lastSaveTimeRef.current,
    };
};
