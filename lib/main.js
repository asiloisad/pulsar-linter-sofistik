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
    this.linter.clearMessages()
    const editor = atom.workspace.getActiveTextEditor()
    let editorPath = editor.getPath()
    let linterPath = path.format({ ...path.parse(editorPath), base: '', ext: '.error_positions' })
    let data
    try {
      data = fs.readFileSync(linterPath, { encoding:'utf8' }).substring(1).replace(/\\\\/g, '/').split(/\n/g)
    } catch (e) {
      if (this.debugMode) { console.error(e) }
      return
    }
    let objs = []
    for (let text of data) {
      try {
        if (!text) { continue }
        obj = JSON.parse(text)
        obj.linterName = `#${obj.errornumber}`
        obj.severity = obj.isError ? 'error' : 'info'
        obj.excerpt = obj.position.text
        obj.location = { file: editorPath,
          position: [[obj.position.line-1, 0], [obj.position.line-1, 1e9]]
        }
        objs.push(obj)
      } catch (e) {
        if (this.debugMode) { console.error(e) }
      }
    }
    if (!objs.length) { return }
    this.linter.setAllMessages(objs)
    editor.setCursorBufferPosition([objs[0].position.line, 0])
    if (this.editorSub) { this.editorSub.dispose() }
    this.editorSub = editor.onDidChange(() => {
      this.linter.clearMessages()
      this.editorSub.dispose()
    })
  },
}
