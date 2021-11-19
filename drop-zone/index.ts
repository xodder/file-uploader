
type DropZoneHooks = {
  onOver: (event: DragEvent) => void;
  onEnter: (event: DragEvent) => void;
  onLeave: (event: DragEvent) => void;
  onActualLeave: (event: DragEvent) => void;
  onFiles: (files: File[]) => void;
  onError: (e: Error) => void;
};

const defaultHooks = {
  onOver: () => {},
  onEnter: () => {},
  onLeave: () => {},
  onActualLeave: () => {},
  onFiles: () => {},
  onError: () => {},
};

export class DropZone {
  _disposers: Record<string, () => void> = {};
  _element: Element;
  _hooks: DropZoneHooks;
  _disabled = false;

  constructor(element: Element, hooks: Partial<DropZoneHooks>) {
    this._element = element;
    this._hooks = Object.assign({}, defaultHooks, hooks);

    if (this._element) {
      this._attachEvents();
    }
  }

  _attachEvents() {
    if (this._element) {
      this._attachEvent('dragover', (e) => {
        e.stopPropagation();
        e.preventDefault();

        if (!e.dataTransfer) {
          return;
        }

        const effect = e.dataTransfer.effectAllowed;

        if (effect === 'move' || effect === 'linkMove') {
          e.dataTransfer.dropEffect = 'move';
        } else {
          e.dataTransfer.dropEffect = 'copy';
        }

        this._hooks.onOver(e);
      });

      this._attachEvent('dragenter', (e) => {
        if (!this._disabled) {
          this._hooks.onEnter(e);
        }
      });

      this._attachEvent('dragleave', (e) => {
        e.stopPropagation();
        this._hooks.onLeave(e);
        const relatedTarget = document.elementFromPoint(e.clientX, e.clientY);
        if (!this._isElementDescendant(relatedTarget)) {
          this._hooks.onActualLeave(e);
        }
      });

      this._attachEvent('drop', (e) => {
        if (!this._disabled) {
          e.stopPropagation();
          e.preventDefault();

          if (!e.dataTransfer) {
            return;
          }

          this._processDroppedItems(Array.from(e.dataTransfer.items)).then(
            (files) => {
              this._hooks.onFiles(files);
            },
            (e) => {
              this._hooks.onError(e);
            }
          );
        }
      });
    }
  }

  _attachEvent(eventName: string, handler: (e: DragEvent) => void) {
    if (this._disposers[eventName]) {
      this._disposers[eventName]();
    }
    this._element.addEventListener(
      eventName,
      handler.bind(this) as EventListener
    );
    this._disposers[eventName] = () =>
      this._element.removeEventListener(
        eventName,
        handler.bind(this) as EventListener
      );
  }

  async _processDroppedItems(items: DataTransferItem[]) {
    return new Promise<File[]>((resolve, reject) => {
      const files: File[] = [];
      const traversalPromises: Promise<void>[] = [];

      items.forEach((item) => {
        const entry = item.webkitGetAsEntry();
        if (entry) {
          traversalPromises.push(this._traverseFileTree(entry, files));
        } else {
          traversalPromises.push(Promise.resolve());
        }
      });

      Promise.all(traversalPromises).then(() => resolve(files), reject);
    });
  }

  async _traverseFileTree(entry: any, files: File[]) {
    const self = this;
    return new Promise<void>((resolve, reject) => {
      if (entry.isFile) {
        entry.file((file: File) => {
          files.push(file);
          resolve();
        }, reject);
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        let allEntries: any[] = [];
        (function readEntries() {
          // calls readEntries() until callback returns an empty array
          reader.readEntries((entries: any[]) => {
            if (entries.length > 0) {
              allEntries = allEntries.concat(entries);
              setTimeout(() => readEntries(), 0);
            } else {
              Promise.all(
                allEntries.map((entry) => self._traverseFileTree(entry, files))
              ).then(() => resolve(), reject);
            }
          }, reject);
        })();
      }
    });
  }

  dispose() {
    Object.values(this._disposers).forEach((disposer) => disposer());
  }

  _isElementDescendant(descendant: Element | null) {
    if (!descendant) {
      return false;
    }
    if (this._element === descendant) {
      return true;
    }
    if (this._element.contains) {
      return this._element.contains(descendant);
    } else {
      return !!(descendant.compareDocumentPosition(this._element) & 8);
    }
  }
}