export const TEXT_ENTRY_SELECTOR = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';

export const isTextEntryElement = (element) => {
  if (!element || element.tagName?.toLowerCase() === 'body') {
    return false;
  }

  const tagName = element.tagName?.toLowerCase();
  return tagName === 'input'
    || tagName === 'textarea'
    || tagName === 'select'
    || element.isContentEditable === true
    || element.closest?.('[contenteditable=""], [contenteditable="true"]') !== null;
};
