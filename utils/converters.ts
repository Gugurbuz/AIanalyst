// utils/converters.ts
import { Block } from '@blocknote/core';

/**
 * Sanitizes raw BlockNote data from the database or AI.
 * This function is critical for preventing crashes when loading older or
 * malformed document structures into the BlockNote editor.
 *
 * It performs two main actions:
 * 1. Filters out any invalid entries (e.g., `null`, `undefined`) from the blocks array.
 * 2. Fixes a common legacy issue where the `level` property on heading blocks was
 *    outside the `props` object.
 *
 * @param blocks - An array of block objects to sanitize.
 * @returns A sanitized array of `Block` objects safe to use with BlockNote.
 */
export function sanitizeBlockNoteContent(blocks: any[]): Block[] {
  if (!Array.isArray(blocks)) {
    console.warn("sanitizeBlockNoteContent received non-array data, returning empty array:", blocks);
    return [];
  }

  // Filter out any non-object entries (like null, undefined, strings) before mapping.
  // This is a critical step to prevent crashes in the mapping function or in BlockNote itself.
  return blocks
    .filter(block => block && typeof block === 'object')
    .map((block): Block => {
      // Now we know 'block' is a valid object.
      
      // Deep copy to avoid mutating the original data.
      let sanitizedBlock = JSON.parse(JSON.stringify(block));

      // Fix for misplaced 'level' property in heading blocks.
      if (sanitizedBlock.type === 'heading' && 'level' in sanitizedBlock && typeof sanitizedBlock.level === 'number' && !sanitizedBlock.props?.level) {
        const { level, ...restOfBlock } = sanitizedBlock;
        sanitizedBlock = {
          ...restOfBlock,
          type: 'heading',
          props: {
            ...(restOfBlock.props || {}),
            level: level as 1 | 2 | 3,
          },
        };
      }
      
      // Recursively sanitize children of any block type
      if (Array.isArray(sanitizedBlock.children)) {
        sanitizedBlock.children = sanitizeBlockNoteContent(sanitizedBlock.children);
      }

      return sanitizedBlock as Block;
    });
}
