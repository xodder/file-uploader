type MockEventListener = (...args: any[]) => void;

class MockEventEmitter {
  _listeners: Record<string, MockEventListener[]> = {};

  on(event: string, listener: MockEventListener) {
    if (!this._listeners[event]) {
      this._listeners[event] = [];
    }

    if (!this._listeners[event].includes(listener)) {
      this._listeners[event].push(listener);
    }
  }

  off(event: string, listener: MockEventListener) {
    if (!this._listeners[event]) {
      return;
    }

    this._listeners[event] = this._listeners[event].filter(
      (l) => l !== listener
    );
  }

  emit(event: string, ...args: any[]) {
    if (this._listeners[event]) {
      this._listeners[event].forEach((listener) => {
        listener(...args);
      });
    }
  }
}

export default MockEventEmitter;
