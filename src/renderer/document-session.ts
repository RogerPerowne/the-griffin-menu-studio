import { choiceDialog } from './ui/confirm';

type SaveHandler = () => Promise<boolean>;

let dirty = false;
let saveHandler: SaveHandler | null = null;

export function setDocumentSaveHandler(handler: SaveHandler): void {
  saveHandler = handler;
}

export function markDocumentDirty(): void {
  dirty = true;
}

export function markDocumentSaved(): void {
  dirty = false;
}

export function isDocumentDirty(): boolean {
  return dirty;
}

export async function confirmDocumentTransition(): Promise<boolean> {
  if (!dirty) return true;
  const choice = await choiceDialog({
    title: 'Save changes first?',
    body: 'This menu has unsaved changes. Save them before continuing?',
    choices: [
      { id: 'save', label: 'Save', primary: true },
      { id: 'discard', label: 'Discard changes', danger: true },
      { id: 'cancel', label: 'Cancel' },
    ],
  });
  if (choice === 'save') return saveHandler ? saveHandler() : false;
  if (choice === 'discard') {
    dirty = false;
    return true;
  }
  return false;
}
