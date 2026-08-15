function bufToString(buf: Uint8Array): string {
  return new TextDecoder().decode(buf);
}

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: number;
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

export function encodeMessage(msg: JsonRpcRequest): Uint8Array {
  const body = JSON.stringify(msg);
  const header = `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n`;
  return new TextEncoder().encode(header + body);
}

export function parseMessages(buffer: string): { messages: JsonRpcResponse[]; rest: string } {
  const messages: JsonRpcResponse[] = [];
  let rest = buffer;
  const contentLengthRegex = /Content-Length: (\d+)\r\n\r\n/;

  while (true) {
    const match = contentLengthRegex.exec(rest);
    if (!match) break;

    const headerEnd = match.index + match[0].length;
    const bodyLength = parseInt(match[1], 10);
    const bodyStart = headerEnd;

    if (rest.length < bodyStart + bodyLength) break;

    const body = rest.slice(bodyStart, bodyStart + bodyLength);
    try {
      messages.push(JSON.parse(body) as JsonRpcResponse);
    } catch {
      // skip malformed messages
    }
    rest = rest.slice(bodyStart + bodyLength);
  }

  return { messages, rest };
}