/** @babel */

const { CompositeDisposable } = require('atom')
const path = require('path')
const fs = require('fs')
const { validateDocument } = require('./validator')

module.exports = {

  keywordsProvider: null,
  subscriptions: null,
  linter: null,

  activate() {
    this.subscriptions = new CompositeDisposable()
    this.subscriptions.add(
      atom.commands.add('atom-text-editor[data-grammar="source sofistik"]', {
        'linter-sofistik:lint': () => this.lintErrorPositions(),
      })
    )
  },

  deactivate() {
    this.subscriptions.dispose()
    if (this.editorSub) { this.editorSub.dispose() }
    this.keywordsProvider = null
    this.linter = null
  },

  // Indie API - for .error_positions file (manual trigger)
  consumeIndie(registerIndie) {
    this.linter = registerIndie({
      name: "SOFiSTiK"
    })
    this.subscriptions.add(this.linter)
  },

  // Keywords service consumption
  consumeKeywordsService(service) {
    this.keywordsProvider = service.provider
  },

  // Classic Provider API - for module name validation (automatic)
  provideLinter() {
    return {
      name: 'SOFiSTiK Module Validator',
      scope: 'file',
      lintsOnChange: true,
      grammarScopes: ['source.sofistik'],
      lint: (textEditor) => {
        return this.lintModuleNames(textEditor)
      }
    }
  },

  // Manual lint for .error_positions file
  lintErrorPositions() {
    if (!this.linter) { return }

    this.linter.clearMessages()
    const editor = atom.workspace.getActiveTextEditor()
    if (!editor) { return }

    const editorPath = editor.getPath()
    const linterPath = editorPath.replace(/\.[^.]+$/, '.error_positions')
    let messages = []

    try {
      const data = fs.readFileSync(linterPath, { encoding: 'utf8' }).split(/\n/g)

      for (let text of data) {
        try {
          if (!text.trim()) { continue }
          const obj = JSON.parse(text)

          // Build error message
          messages.push({
            linterName: `#${obj.errornumber}`,
            severity: obj.isError ? 'error' : 'info',
            excerpt: obj.position.text,
            location: {
              file: editorPath,
              position: [[obj.position.line - 1, 0], [obj.position.line - 1, 1e9]]
            }
          })
        } catch (e) {
          // Silently ignore parse errors in .error_positions file
        }
      }
    } catch (e) {
      // Silently handle missing .error_positions file (expected before running SOFiSTiK)
      return
    }

    if (!messages.length) { return }

    // Set messages and jump to first error
    this.linter.setAllMessages(messages)
    const firstError = messages.find(msg => msg.severity === 'error') || messages[0]
    editor.setCursorBufferPosition([firstError.location.position[0][0], 0])

    // Clear messages on editor change
    if (this.editorSub) { this.editorSub.dispose() }
    this.editorSub = editor.onDidChange(() => {
      this.linter.clearMessages()
      this.editorSub.dispose()
    })
  },

  // Automatic lint for module names (classic provider)
  lintModuleNames(editor) {
    if (!editor || !this.keywordsProvider) {
      return []
    }

    const editorPath = editor.getPath()
    if (!editorPath) {
      return []
    }

    // Only module name validation
    const validationMessages = validateDocument(editor, this.keywordsProvider)
    return validationMessages
  }
}
