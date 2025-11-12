// components/RequirementComponent.tsx
import React from 'react';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { CheckCircle, AlertCircle, XCircle } from 'lucide-react';

const statusConfig = {
    pending: {
        label: 'Onay Bekliyor',
        icon: <AlertCircle className="h-4 w-4 text-amber-600" />,
        badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200',
        wrapperClass: 'requirement-block-pending',
    },
    approved: {
        label: 'Onaylandı',
        icon: <CheckCircle className="h-4 w-4 text-emerald-600" />,
        badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200',
        wrapperClass: 'requirement-block-approved',
    },
    rejected: {
        label: 'Reddedildi',
        icon: <XCircle className="h-4 w-4 text-red-600" />,
        badgeClass: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200',
        wrapperClass: 'requirement-block-rejected',
    },
};

export const RequirementComponent = (props: any) => {
    const { reqId, status } = props.node.attrs;
    const currentStatus = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    
    const handleStatusChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const newStatus = event.target.value;
        props.updateAttributes({
            status: newStatus,
        });
        // FIX: Corrected an erroneous function call. The check should be for the existence of the prop, not its return value.
        if (props.onStatusChange) {
            props.onStatusChange(reqId, newStatus);
        }
    };

    return (
        <NodeViewWrapper className={`requirement-block ${currentStatus.wrapperClass}`}>
            <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                    <strong className="font-mono text-sm text-slate-600 dark:text-slate-300">{reqId}:</strong>
                    <NodeViewContent as="span" className="ml-2 prose-p:inline" />
                </div>
                {props.editor.isEditable && (
                    <div className="relative group">
                         <select
                            value={status}
                            onChange={handleStatusChange}
                            className={`-mt-1 -mr-2 text-xs font-semibold pl-2 pr-6 py-1 rounded-full appearance-none focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-800 focus:ring-indigo-500 cursor-pointer ${currentStatus.badgeClass}`}
                        >
                            <option value="pending">Onay Bekliyor</option>
                            <option value="approved">Onaylandı</option>
                            <option value="rejected">Reddedildi</option>
                        </select>
                    </div>
                )}
            </div>
        </NodeViewWrapper>
    );
};
