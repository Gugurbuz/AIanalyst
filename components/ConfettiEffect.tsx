import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface ConfettiPiece {
    id: number;
    x: number;
    y: number;
    rotation: number;
    color: string;
    size: number;
}

interface ConfettiEffectProps {
    trigger: boolean;
    onComplete?: () => void;
}

const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];

export const ConfettiEffect: React.FC<ConfettiEffectProps> = ({
    trigger,
    onComplete,
}) => {
    const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);

    useEffect(() => {
        if (trigger) {
            const pieces: ConfettiPiece[] = Array.from({ length: 50 }, (_, i) => ({
                id: i,
                x: Math.random() * window.innerWidth,
                y: -20,
                rotation: Math.random() * 360,
                color: colors[Math.floor(Math.random() * colors.length)],
                size: Math.random() * 8 + 4,
            }));

            setConfetti(pieces);

            setTimeout(() => {
                setConfetti([]);
                onComplete?.();
            }, 3000);
        }
    }, [trigger, onComplete]);

    if (confetti.length === 0) return null;

    return (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
            {confetti.map((piece) => (
                <motion.div
                    key={piece.id}
                    className="absolute rounded-sm"
                    style={{
                        backgroundColor: piece.color,
                        width: piece.size,
                        height: piece.size,
                        left: piece.x,
                        top: piece.y,
                    }}
                    initial={{
                        y: piece.y,
                        x: piece.x,
                        rotate: piece.rotation,
                        opacity: 1,
                    }}
                    animate={{
                        y: window.innerHeight + 100,
                        x: piece.x + (Math.random() - 0.5) * 200,
                        rotate: piece.rotation + 360 * 3,
                        opacity: 0,
                    }}
                    transition={{
                        duration: 3,
                        ease: 'easeIn',
                    }}
                />
            ))}
        </div>
    );
};
