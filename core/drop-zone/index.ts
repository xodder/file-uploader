type DropZoneEventHooks = {
  onOver: (event: DragEvent) => void;
  onEnter: (event: DragEvent) => void;
  onLeave: (event: DragEvent) => void;
  onActualLeave: (event: DragEvent) => void;
  onFiles: (files: File[]) => void;
  onError: (e: Error) => void;
};

const defaultEventHooks = {
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
  _eventHooks: DropZoneEventHooks;
  _disabled = false;

  constructor(element: Element, eventHooks: Partial<DropZoneEventHooks>) {
    this._element = element;
    this._eventHooks = Object.assign({}, defaultEventHooks, eventHooks);

    if (this._element) {
      this._attachEvents();
    }
  }

  _attachEvents() {
    if (this._element) {
      this._attachDragOverEvent();
      this._attachDragEnterEvent();
      this._attachDragLeaveEvent();
      this._attachDropEvent();
    }
  }

  _attachDragOverEvent() {
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

      this._eventHooks.onOver(e);
    });
  }

  _attachDragEnterEvent() {
    this._attachEvent('dragenter', (e) => {
      if (!this._disabled) {
        this._eventHooks.onEnter(e);
      }
    });
  }

  _attachDragLeaveEvent() {
    this._attachEvent('dragleave', (e) => {
      e.stopPropagation();

      this._eventHooks.onLeave(e);

      const relatedTarget = document.elementFromPoint(e.clientX, e.clientY);

      if (!this._isElementDescendant(relatedTarget)) {
        this._eventHooks.onActualLeave(e);
      }
    });
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

  _attachDropEvent() {
    this._attachEvent('drop', (e) => {
      if (!this._disabled) {
        e.stopPropagation();
        e.preventDefault();

        if (!e.dataTransfer) {
          return;
        }

        const items = Array.from(e.dataTransfer.items);

        this._processDroppedItems(items).then(
          (files) => {
            this._eventHooks.onFiles(files);
          },
          (e) => {
            this._eventHooks.onError(e);
          }
        );
      }
    });
  }

  async _processDroppedItems(items: DataTransferItem[]) {
    const files: File[] = [];
    const traversalPromises: Promise<void>[] = [];

    items.forEach((item) => {
      const entry = item.webkitGetAsEntry();
      if (entry) {
        traversalPromises.push(this._traverseFileTree(entry, files));
      }
    });

    await Promise.all(traversalPromises);

    return files;
  }

  async _traverseFileTree(entry: FileSystemEntry, files: File[]) {
    if (entry.isFile) {
      files.push(await this.__getEntryAsFile(entry as FileSystemFileEntry));
    } else if (entry.isDirectory) {
      await Promise.all(
        this.__getDirectoryEntries(entry as FileSystemDirectoryEntry).map(
          (entry) => this._traverseFileTree(entry, files)
        )
      );
    }
  }

  __getEntryAsFile(entry: FileSystemFileEntry) {
    return new Promise<File>((resolve) => {
      entry.file((file: File) => {
        resolve(file);
      });
    });
  }

  __getDirectoryEntries(entry: FileSystemDirectoryEntry) {
    const reader = entry.createReader();
    const result: FileSystemEntry[] = [];

    (function readEntries() {
      reader.readEntries((entries) => {
        if (entries.length > 0) {
          result.concat(entries);
          readEntries();
        }
      });
    })();

    return result;
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

  dispose() {
    Object.values(this._disposers).forEach((dispose) => dispose());
  }
}
