/** @babel */

/**
 * Validates SOFiSTiK document for module name errors
 * @param {TextEditor} editor - Atom text editor instance
 * @param {Object} keywordsProvider - Keywords provider service
 * @returns {Array} Array of linter messages
 */
function validateDocument(editor, keywordsProvider) {
  const messages = [];
  const text = editor.getText();
  const lines = text.split("\n");

  if (!keywordsProvider || !keywordsProvider.withContext) {
    return messages;
  }

  const ctx = keywordsProvider.withContext(editor);
  const validModules = ctx.getModuleNames();
  if (!validModules || validModules.length === 0) {
    return messages;
  }

  // Regex to match module declarations (e.g., +PROG, -PROG, $PROG, PROG)
  const moduleRegex = /^\s*[\+\-\$]?PROG\s+(\w+)/i;

  lines.forEach((line, lineIndex) => {
    const match = line.match(moduleRegex);
    if (match) {
      const moduleName = match[1].toUpperCase();

      // Check if module name is valid
      if (!validModules.includes(moduleName)) {
        const columnStart = line.indexOf(match[1]);
        messages.push({
          severity: "error",
          excerpt: `Unknown SOFiSTiK module: ${moduleName}`,
          location: {
            file: editor.getPath(),
            position: [
              [lineIndex, columnStart],
              [lineIndex, columnStart + match[1].length],
            ],
          },
        });
      }
    }
  });

  return messages;
}

module.exports = {
  validateDocument,
};
