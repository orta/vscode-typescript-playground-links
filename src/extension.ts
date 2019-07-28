import * as vscode from "vscode"
var codeBlocks = require("gfm-code-blocks")

function getTypeScriptPlaygroundURL(code: string) {
  return "https://www.typescriptlang.org/play/#src=" + encodeURI(code)
}

class LinkProvider implements vscode.DocumentLinkProvider {
  links: { lang: string; start: number }[] = []

  provideDocumentLinks(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.DocumentLink[]> {
    const links = decorateMarkdownEditor(document)
    return links.map(l => {
      const startPosition = document.positionAt(l.start + 3)
      const endPosition = document.positionAt(l.start + 3 + l.lang.length)
      return {
        range: new vscode.Range(startPosition, endPosition),
        tooltip: "Open in TypeScript Playground",
      }
    })
  }

  resolveDocumentLink(
    link: vscode.DocumentLink,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.DocumentLink> {
    const editor = vscode.window.activeTextEditor
    if (!editor) {
      return
    }

    const tsOrJSBlocks = getCodeblocks(editor.document)
    const selectedBlock = tsOrJSBlocks.find(block => {
      const pos = editor.document.positionAt(block.start + 3)
      return pos.isEqual(link.range.start)
    })

    if (!selectedBlock) {
      console.log("Could not find the codeblock")
      return
    }

    const url = getTypeScriptPlaygroundURL(selectedBlock.code)

    return {
      target: vscode.Uri.parse(url),
      range: link.range,
      tooltip: link.tooltip,
    }
  }
}

const linkProvider = new LinkProvider()

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "vscode-ts-markdown-to-playground" is now active!')

  // const openEditors = vscode.window.visibleTextEditors.filter(e => e.document.languageId === "markdown")
  // openEditors.forEach(decorateMarkdownEditor)

  const selector: vscode.DocumentSelector = [
    { language: "markdown", scheme: "file" },
    { language: "markdown", scheme: "untitled" },
  ]

  vscode.languages.registerDocumentLinkProvider(selector, linkProvider)

  context.subscriptions.push(...[
    vscode.commands.registerCommand("tsPlayground.openFileInPlayground", () => {
      if (vscode.window.activeTextEditor) {
        vscode.env.openExternal(
          vscode.Uri.parse(getTypeScriptPlaygroundURL(vscode.window.activeTextEditor.document.getText()))
        )
      }
    }),
    vscode.commands.registerCommand("tsPlayground.copyFileAsPlaygroundURL", () => {
      if (vscode.window.activeTextEditor) {
        vscode.env.clipboard.writeText(
          getTypeScriptPlaygroundURL(vscode.window.activeTextEditor.document.getText())
        )
      }
    }),
    vscode.commands.registerCommand("tsPlayground.openSelectionInPlayground", () => {
      if (vscode.window.activeTextEditor) {
        vscode.env.openExternal(
          vscode.Uri.parse(getTypeScriptPlaygroundURL(getAllSelectedText(vscode.window.activeTextEditor)))
        )
      }
    }),
    vscode.commands.registerCommand("tsPlayground.copySelectionAsPlaygroundURL", () => {
      if (vscode.window.activeTextEditor) {
        vscode.env.clipboard.writeText(
          getTypeScriptPlaygroundURL(getAllSelectedText(vscode.window.activeTextEditor))
        )
      }
    }),
  ])

  // vscode.workspace.onDidOpenTextDocument(event => decorateMarkdownEditor(vscode.window.activeTextEditor))
  // vscode.workspace.onWillSaveTextDocument(event => {
  //   const openEditor = vscode.window.visibleTextEditors.filter(editor => editor.document.uri === event.document.uri)[0]
  //   decorateMarkdownEditor(openEditor)
  // })
}

function decorateMarkdownEditor(document: vscode.TextDocument) {
  const tsOrJSBlocks = getCodeblocks(document)
  return tsOrJSBlocks.map(b => ({ lang: b.lang, start: b.start }))
}

function getAllSelectedText(textEditor: vscode.TextEditor) {
  return textEditor.selections
    .map(selection => getSelectionContentWithoutLeadingWhitespace(textEditor, selection))
    .join(getCurrentEOL(textEditor).repeat(2))
}

function getSelectionContentWithoutLeadingWhitespace(textEditor: vscode.TextEditor, selection: vscode.Selection) {
  const textLines: string[] = []
  let trimLength = Infinity;
  for (let line = selection.start.line; line <= selection.end.line; line++) {
    const lineEnd = line === selection.end.line
      ? selection.end
      : textEditor.document.positionAt(textEditor.document.offsetAt(new vscode.Position(line + 1, 0)) - 1)

    let lineText = textEditor.document.getText(new vscode.Range(new vscode.Position(line, 0), lineEnd))
    if (line === selection.start.line) {
      lineText = " ".repeat(selection.start.character) + lineText.slice(selection.start.character)
    }

    const firstNonWhitespaceChar = lineText.match(/\S/)
    if (firstNonWhitespaceChar) {
      trimLength = Math.min(trimLength, firstNonWhitespaceChar.index!)
    }
    textLines.push(lineText)
  }

  return textLines.map(line => line.slice(trimLength)).join(getCurrentEOL(textEditor))
}

function getCurrentEOL(textEditor: vscode.TextEditor) {
  switch (textEditor.document.eol) {
    case vscode.EndOfLine.CRLF: return "\r\n"
    case vscode.EndOfLine.LF: return "\n"
  }
}

export const getCodeblocks = (document: vscode.TextDocument) => {
  const sourceCode = document.getText()
  const code = codeBlocks(sourceCode) as { lang: string; code: string; block: string; start: number; end: number }[]
  const acceptable = ["js", "javascript", "ts", "typescript"]
  return code.filter(c => acceptable.includes(c.lang))
}

// this method is called when your extension is deactivated
export function deactivate() { }
