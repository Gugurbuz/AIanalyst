import { Node, mergeAttributes } from '@tiptap/core';
// Fix: Add a type-only import to treat this file as a module, which is required for module augmentation to work correctly.
import type {} from '@tiptap/core';

export interface IframeOptions {
  allowFullscreen: boolean,
  HTMLAttributes: {
    [key: string]: any,
  },
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    iframe: {
      setIframe: (options: { src: string }) => ReturnType,
    }
  }
}

export default Node.create<IframeOptions>({
  name: 'iframe',
  group: 'block',
  atom: true,

  addOptions() {
    return {
      allowFullscreen: true,
      HTMLAttributes: {},
    }
  },

  addAttributes() {
    return {
      src: {
        default: null,
      },
      frameborder: {
        default: 0,
      },
      allowfullscreen: {
        default: this.options.allowFullscreen,
        parseHTML: () => this.options.allowFullscreen,
      },
    }
  },

  parseHTML() {
    return [{
      tag: 'iframe[src]',
    }]
  },

  renderHTML({ HTMLAttributes }) {
    // Wrapper div for responsive styling
    return ['div', { class: 'iframe-wrapper' }, ['iframe', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)]]
  },

  addCommands() {
    return {
      setIframe: (options) => ({ tr, dispatch }) => {
        const { selection } = tr;
        const node = this.type.create(options);

        if (dispatch) {
          tr.replaceRangeWith(selection.from, selection.to, node);
        }

        return true;
      },
    }
  },
})