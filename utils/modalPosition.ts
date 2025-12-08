/**
 * Utility to calculate modal position anchored near the trigger element.
 * 
 * Purpose: Position modals near their trigger buttons instead of centering them.
 * This improves UX by showing the modal close to where the user clicked,
 * especially on scrolled pages or when multiple actions are visible.
 * 
 * The function handles viewport boundaries and provides mobile fallback.
 */

export interface ModalPosition {
  top: number;
  left: number;
  maxHeight?: number;
}

/**
 * Calculate position for a modal anchored near the trigger element.
 * Returns position that keeps the modal visible within viewport.
 * 
 * @param triggerElement - The button/element that triggered the modal
 * @param modalWidth - Expected modal width (default 448px = max-w-md)
 * @param modalHeight - Expected modal height (default 400px, can adjust)
 * @returns Position object with top, left, and optional maxHeight
 */
export function calculateAnchoredModalPosition(
  triggerElement: HTMLElement | null,
  modalWidth: number = 448,
  modalHeight: number = 400
): ModalPosition | null {
  if (!triggerElement) return null;

  const rect = triggerElement.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const scrollY = window.scrollY || window.pageYOffset;
  const scrollX = window.scrollX || window.pageXOffset;

  // Margin from viewport edges
  const margin = 16;

  // Calculate initial position (below and slightly to right of trigger)
  let top = rect.bottom + scrollY + 8; // 8px gap below trigger
  let left = rect.left + scrollX;

  // Adjust horizontal position if modal would overflow viewport
  if (left + modalWidth > viewportWidth - margin) {
    // Try positioning to the left of trigger
    left = Math.max(margin, rect.right + scrollX - modalWidth);
  }
  if (left < margin) {
    left = margin;
  }

  // Calculate available space below trigger
  const spaceBelow = viewportHeight - rect.bottom - margin;
  
  // If not enough space below, try positioning above
  if (spaceBelow < Math.min(modalHeight, 300)) {
    const spaceAbove = rect.top - margin;
    if (spaceAbove > spaceBelow) {
      // Position above trigger
      top = rect.top + scrollY - Math.min(modalHeight, spaceAbove) - 8;
    }
  }

  // Ensure modal doesn't go above viewport
  if (top < scrollY + margin) {
    top = scrollY + margin;
  }

  // Calculate max height if needed to fit in viewport
  const maxHeight = Math.min(
    modalHeight,
    viewportHeight - margin * 2
  );

  return { top, left, maxHeight };
}

/**
 * Check if viewport is mobile/small (for fallback to centered modal)
 * @returns true if viewport width is less than 768px
 */
export function isMobileViewport(): boolean {
  return window.innerWidth < 768;
}
