export type ActionStep = () => Promise<void>;

export class ActionQueue {
  private queue: ActionStep[] = [];
  private running = false;

  enqueue(step: ActionStep): void {
    this.queue.push(step);
    void this.run();
  }

  enqueueAll(steps: ActionStep[]): void {
    this.queue.push(...steps);
    void this.run();
  }

  clear(): void {
    this.queue = [];
  }

  get isRunning(): boolean {
    return this.running;
  }

  private async run(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;

    while (this.queue.length > 0) {
      const step = this.queue.shift();
      if (!step) {
        continue;
      }
      await step();
    }

    this.running = false;
  }
}