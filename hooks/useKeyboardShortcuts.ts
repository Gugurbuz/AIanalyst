import { useEffect, useCallback } from 'react';

type KeyHandler = (event: KeyboardEvent) => void;

interface ShortcutConfig {
    key: string;
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
    meta?: boolean;
    handler: KeyHandler;
    description?: string;
}

export const useKeyboardShortcuts = (shortcuts: ShortcutConfig[]) => {
    const handleKeyDown = useCallback(
        (event: KeyboardEvent) => {
            for (const shortcut of shortcuts) {
                const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
                const ctrlMatch = shortcut.ctrl ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey;
                const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
                const altMatch = shortcut.alt ? event.altKey : !event.altKey;

                if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
                    event.preventDefault();
                    shortcut.handler(event);
                    break;
                }
            }
        },
        [shortcuts]
    );

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleKeyDown]);
};

export const commonShortcuts = {
    save: { key: 's', ctrl: true, description: 'Kaydet' },
    undo: { key: 'z', ctrl: true, description: 'Geri Al' },
    redo: { key: 'z', ctrl: true, shift: true, description: 'İleri Al' },
    search: { key: 'f', ctrl: true, description: 'Ara' },
    newDocument: { key: 'n', ctrl: true, description: 'Yeni Doküman' },
    closeModal: { key: 'Escape', description: 'Modalı Kapat' },
};
