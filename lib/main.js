/** @babel */

const { CompositeDisposable } = require("atom");
const path = require("path");
const fs = require("fs");
const { validateDocument } = require("./validator");

/**
 * Linter SOFiSTiK Package
 * Provides linting for SOFiSTiK structural analysis files.
 * Validates module names and parses error position files.
 */
module.exports = {
  keywordsProvider: null,
  subscriptions: null,
  linter: null,

  /**
   * Activates the package and registers linting commands.
   */
  activate() {
    this.subscriptions = new CompositeDisposable();
    this.subscriptions.add(
      atom.commands.add('atom-text-editor[data-grammar="source sofistik"]', {
        "linter-sofistik:lint": () => this.lintErrorPositions(),
      })
    );
  },

  /**
   * Deactivates the package and disposes resources.
   */
  deactivate() {
    this.subscriptions.dispose();
    if (this.editorSub) {
      this.editorSub.dispose();
    }
    this.keywordsProvider = null;
    this.linter = null;
  },

  /**
   * Consumes the linter indie service for manual error reporting.
   * @param {Function} registerIndie - The indie registration function
   */
  consumeIndie(registerIndie) {
    this.linter = registerIndie({
      name: "SOFiSTiK post",
    });
    this.subscriptions.add(this.linter);
  },

  /**
   * Consumes the SOFiSTiK keywords service for validation.
   * @param {Object} service - The keywords service object
   */
  consumeKeywordsService(service) {
    this.keywordsProvider = service.provider;
  },

  /**
   * Provides the linter interface for automatic module name validation.
   * @returns {Object} Linter provider configuration
   */
  provideLinter() {
    return {
      name: "SOFiSTiK code",
      scope: "file",
      lintsOnChange: true,
      grammarScopes: ["source.sofistik"],
      lint: (textEditor) => {
        return this.lintModuleNames(textEditor);
      },
    };
  },

  /**
   * Parses and displays errors from the .error_positions file.
   */
  lintErrorPositions() {
    if (!this.linter) {
      return;
    }

    this.linter.clearMessages();
    const editor = atom.workspace.getActiveTextEditor();
    if (!editor) {
      return;
    }

    const editorPath = editor.getPath();
    const linterPath = editorPath.replace(/\.[^.]+$/, ".error_positions");
    let messages = [];

    try {
      const data = fs
        .readFileSync(linterPath, { encoding: "utf8" })
        .split(/\n/g);

      for (let text of data) {
        try {
          if (!text.trim()) {
            continue;
          }
          const obj = JSON.parse(text);

          // Build error message
          messages.push({
            linterName: `#${obj.errornumber}`,
            severity: obj.isError ? "error" : "info",
            excerpt: obj.position.text,
            location: {
              file: editorPath,
              position: [
                [obj.position.line - 1, 0],
                [obj.position.line - 1, 1e9],
              ],
            },
          });
        } catch (e) {
          // Silently ignore parse errors in .error_positions file
        }
      }
    } catch (e) {
      // Silently handle missing .error_positions file (expected before running SOFiSTiK)
      return;
    }

    if (!messages.length) {
      return;
    }

    // Set messages and jump to first error
    this.linter.setAllMessages(messages);
    const firstError =
      messages.find((msg) => msg.severity === "error") || messages[0];
    editor.setCursorBufferPosition([firstError.location.position[0][0], 0]);

    // Clear messages on editor change
    if (this.editorSub) {
      this.editorSub.dispose();
    }
    this.editorSub = editor.onDidChange(() => {
      this.linter.clearMessages();
      this.editorSub.dispose();
    });
  },

  /**
   * Validates module names in the editor using the keywords provider.
   * @param {TextEditor} editor - The text editor to lint
   * @returns {Array} Array of validation messages
   */
  lintModuleNames(editor) {
    if (!editor || !this.keywordsProvider) {
      return [];
    }

    const editorPath = editor.getPath();
    if (!editorPath) {
      return [];
    }

    // Only module name validation
    const validationMessages = validateDocument(editor, this.keywordsProvider);
    return validationMessages;
  },
};
