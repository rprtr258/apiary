import {Extension, Transaction, TransactionSpec, EditorState} from "@codemirror/state";
import {EditorView, highlightSpecialChars, keymap, drawSelection, lineNumbers, highlightActiveLineGutter, dropCursor, highlightActiveLine} from "@codemirror/view";
import {defaultKeymap, historyKeymap, standardKeymap, history, indentMore} from "@codemirror/commands";
import {foldGutter, syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldKeymap} from "@codemirror/language";
import {indentOnInput} from "@codemirror/language";
import {highlightSelectionMatches, searchKeymap} from "@codemirror/search";
import {autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap} from "@codemirror/autocomplete";
import {lintKeymap} from "@codemirror/lint";

export const defaultExtensions = [
  keymap.of([
    ...standardKeymap,
    ...defaultKeymap,
    ...searchKeymap,
    ...historyKeymap,
    ...foldKeymap,
  ]),
  highlightSpecialChars(),
  foldGutter(),
  drawSelection(),
  syntaxHighlighting(defaultHighlightStyle, {fallback: true}),
  bracketMatching(),
  highlightSelectionMatches(),
  EditorState.allowMultipleSelections.of(true),
  EditorView.darkTheme.of(true),
  EditorView.lineWrapping,
];
export function defaultEditorExtensions(onChange: (doc: string) => void): Extension[] {
  return [
    keymap.of([
      ...closeBracketsKeymap,
      ...completionKeymap,
      ...lintKeymap,
      {key: "Tab", run: indentMore},
    ]),
    lineNumbers(),
    highlightActiveLineGutter(),
    history(),
    dropCursor(),
    indentOnInput(),
    closeBrackets(),
    autocompletion(),
    highlightActiveLine(),
    EditorState.transactionFilter.of((tr: Readonly<Transaction>): TransactionSpec => {
      if (!tr.changes.empty) {
        onChange(tr.newDoc.toString());
      }
      return tr;
    }),
  ];
}
