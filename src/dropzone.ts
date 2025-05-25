type DropZoneHooks = {
  onOver: (event: DragEvent) => void;
  onEnter: (event: DragEvent) => void;
  onLeave: (event: DragEvent) => void;
  onActualLeave: (event: DragEvent) => void;
  onFiles: (files: File[]) => void;
  onError: (e: Error) => void;
};

const defaultHooks = {
  onOver: () => void 0,
  onEnter: () => void 0,
  onLeave: () => void 0,
  onActualLeave: () => void 0,
  onFiles: () => void 0,
  onError: () => void 0,
};

export class DropZone {
  private disposers: Record<string, () => void> = {};
  private element: Element;
  private hooks: DropZoneHooks;
  private disabled = false;

  constructor(element: Element, hooks: Partial<DropZoneHooks>) {
    this.element = element;
    this.hooks = Object.assign({}, defaultHooks, hooks);

    if (this.element) {
      this.attachEvents();
    }
  }

  private attachEvents() {
    if (this.element) {
      this.attachEvent('dragover', (e) => {
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

        this.hooks.onOver(e);
      });

      this.attachEvent('dragenter', (e) => {
        if (!this.disabled) {
          this.hooks.onEnter(e);
        }
      });

      this.attachEvent('dragleave', (e) => {
        e.stopPropagation();
        this.hooks.onLeave(e);
        const relatedTarget = document.elementFromPoint(e.clientX, e.clientY);
        if (!this.isElementDescendant(relatedTarget)) {
          this.hooks.onActualLeave(e);
        }
      });

      this.attachEvent('drop', (e) => {
        if (!this.disabled) {
          e.stopPropagation();
          e.preventDefault();

          if (!e.dataTransfer) {
            return;
          }

          this.processDroppedItems(Array.from(e.dataTransfer.items)).then(
            (files) => {
              this.hooks.onFiles(files);
            },
            (e) => {
              this.hooks.onError(e);
            }
          );
        }
      });
    }
  }

  private attachEvent(eventName: string, handler: (e: DragEvent) => void) {
    if (this.disposers[eventName]) {
      this.disposers[eventName]();
    }

    const _handler = handler.bind(this) as EventListener;

    this.element.addEventListener(eventName, _handler);

    this.disposers[eventName] = () =>
      this.element.removeEventListener(eventName, _handler);
  }

  private async processDroppedItems(items: DataTransferItem[]) {
    return new Promise<File[]>((resolve, reject) => {
      const files: File[] = [];
      const traversalPromises: Promise<void>[] = [];

      items.forEach((item) => {
        const entry = item.webkitGetAsEntry();
        if (entry) {
          traversalPromises.push(this.traverseFileTree(entry, files));
        } else {
          traversalPromises.push(Promise.resolve());
        }
      });

      Promise.all(traversalPromises).then(() => resolve(files), reject);
    });
  }

  private async traverseFileTree(entry: FileSystemEntry, files: File[]) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    return new Promise<void>((resolve, reject) => {
      if (entry.isFile) {
        const entry_ = entry as FileSystemFileEntry;

        entry_.file((file: File) => {
          files.push(file);
          resolve();
        }, reject);
      } else if (entry.isDirectory) {
        const entry_ = entry as FileSystemDirectoryEntry;
        const reader = entry_.createReader();

        let allEntries: any[] = [];
        (function readEntries() {
          // calls readEntries() until callback returns an empty array
          reader.readEntries((entries) => {
            if (entries.length > 0) {
              allEntries = allEntries.concat(entries);
              setTimeout(() => readEntries(), 0);
            } else {
              Promise.all(
                allEntries.map((entry) => self.traverseFileTree(entry, files))
              ).then(() => resolve(), reject);
            }
          }, reject);
        })();
      }
    });
  }

  dispose() {
    Object.values(this.disposers).forEach((disposer) => disposer());
  }

  private isElementDescendant(descendant: Element | null) {
    if (!descendant) {
      return false;
    }
    if (this.element === descendant) {
      return true;
    }
    if (this.element.contains) {
      return this.element.contains(descendant);
    } else {
      return !!(descendant.compareDocumentPosition(this.element) & 8);
    }
  }
}
