'use babel'

import { CompositeDisposable } from 'atom'
import path from 'path'
import fs from 'fs'

export default {

  config: {
    debugMode: {
      order: 1,
      title: 'Debug mode',
      description: 'Show some errors in console',
      type: "boolean",
      default: false,
    },
  },

  activate() {
    this.disposables = new CompositeDisposable()
    this.disposables.add(
      atom.commands.add('atom-text-editor[data-grammar="source sofistik"]', {
        'linter-SOFiSTiK:lint': () => this.lint(),
      }),
      atom.config.observe('linter-sofistik.debugMode', (value) => {
        this.debugMode = value
      }),
    )
  },

  deactivate() {
    this.disposables.dispose()
    if (this.editorSub) { this.editorSub.dispose() }
  },

  consumeIndie(registerIndie) {
    this.linter = registerIndie({
      name: "SOFiSTiK"
    })
    this.disposables.add(this.linter)
  },

  lint() {
    const editor = atom.workspace.getActiveTextEditor()
    let editorPath = editor.getPath()
    let linterPath = path.format({ ...path.parse(editorPath), base: '', ext: '.error_positions' })
    let text, obj
    try {
      text = fs.readFileSync(linterPath, { encoding: 'utf8' }).substring(1).replace(/\\\\/g, '/')
      obj = JSON.parse(text)
      obj.linterName = `#${obj.errornumber}`
      obj.severity = obj.isError ? 'error' : 'info'
      obj.excerpt = obj.position.text
      obj.location = { file: editorPath,
        position: [[obj.position.line, 0], [obj.position.line, 1e9]]
      }
    } catch (e) {
      if (this.debugMode) { console.error(e) }
      return
    }
    this.linter.clearMessages()
    this.linter.setAllMessages([obj])
    editor.setCursorBufferPosition([obj.position.line, 0])
    if (this.editorSub) { this.editorSub.dispose() }
    this.editorSub = editor.onDidChange(() => {
      this.linter.clearMessages()
      this.editorSub.dispose()
    })
  },
}
