// components/RequirementNode.ts
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { RequirementComponent } from './RequirementComponent';
// Fix: Add a type-only import to treat this file as a module, which is required for module augmentation to work correctly.
import type {} from '@tiptap/core';

export type RequirementStatus = 'pending' | 'approved' | 'rejected';

export interface RequirementNodeOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    requirementBlock: {
      setRequirementBlock: (attributes: { reqId: string }) => ReturnType;
    };
  }
}

export const RequirementNode = Node.create<RequirementNodeOptions>({
  name: 'requirementBlock',
  group: 'block',
  content: 'inline*',
  defining: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      reqId: {
        default: null,
        parseHTML: element => element.getAttribute('data-req-id'),
        renderHTML: attributes => ({ 'data-req-id': attributes.reqId }),
      },
      status: {
        default: 'pending',
        parseHTML: element => element.getAttribute('data-status'),
        renderHTML: attributes => ({ 'data-status': attributes.status }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-requirement-block]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { 'data-requirement-block': '' }), 0];
  },

  addCommands() {
    return {
      setRequirementBlock: attributes => ({ commands }) => {
        return commands.setNode(this.name, attributes);
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(RequirementComponent);
  },
});