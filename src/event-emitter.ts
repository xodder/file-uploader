type EventListenerX = (...args: any[]) => any;

export class EventEmitter {
  private listeners: Record<string, EventListenerX[]> = {};

  on(event: string, listener: EventListenerX) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }

    if (!this.listeners[event].includes(listener)) {
      this.listeners[event].push(listener);
    }
  }

  off(event: string, listener?: EventListenerX) {
    if (!this.listeners[event] || !listener) {
      return;
    }

    this.listeners[event] = this.listeners[event].filter((l) => l !== listener);
  }

  emit(event: string, ...args: any[]) {
    if (this.listeners[event]) {
      this.listeners[event].forEach((listener) => {
        listener(...args);
      });
    }
  }
}
