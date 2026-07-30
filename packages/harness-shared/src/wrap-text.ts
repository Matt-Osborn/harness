import wrapAnsi from 'wrap-ansi';

export class TextWrapper {
  private buffer = '';

  constructor(private width: number) {}

  push(chunk: string): string {
    if (this.width <= 0) return chunk;
    this.buffer += chunk;
    let output = '';

    while (true) {
      const idx = this.buffer.indexOf('\n');
      if (idx === -1) break;
      output += wrapAnsi(this.buffer.slice(0, idx), this.width, { wordWrap: true, trim: false }) + '\n';
      this.buffer = this.buffer.slice(idx + 1);
    }

    while (this.buffer.length > this.width) {
      const breakAt = this.buffer.lastIndexOf(' ', this.width);
      if (breakAt !== -1) {
        output += wrapAnsi(this.buffer.slice(0, breakAt), this.width, { wordWrap: true, trim: false }) + '\n';
        this.buffer = this.buffer.slice(breakAt + 1);
      } else {
        output += this.buffer.slice(0, this.width) + '\n';
        this.buffer = this.buffer.slice(this.width);
      }
    }

    return output;
  }

  flush(): string {
    if (this.width <= 0) return '';
    if (!this.buffer) return '';
    let result = '';
    while (this.buffer.length > this.width) {
      const breakAt = this.buffer.lastIndexOf(' ', this.width);
      if (breakAt !== -1) {
        result += wrapAnsi(this.buffer.slice(0, breakAt), this.width, { wordWrap: true, trim: false }) + '\n';
        this.buffer = this.buffer.slice(breakAt + 1);
      } else {
        result += this.buffer.slice(0, this.width) + '\n';
        this.buffer = this.buffer.slice(this.width);
      }
    }
    if (this.buffer) {
      result += wrapAnsi(this.buffer, this.width, { wordWrap: true, trim: false });
    }
    this.buffer = '';
    return result;
  }
}
