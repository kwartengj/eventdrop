import { sha256Hex } from "./sha256";

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<Blob | ArrayBuffer>) => void) | null;
  postMessage: (message: string | { error: string }) => void;
};

scope.onmessage = (event) => {
  const body = event.data;
  const buffer = body instanceof ArrayBuffer ? Promise.resolve(body) : body.arrayBuffer();
  void buffer.then((data) => sha256Hex(data)).then(
    (hash) => scope.postMessage(hash),
    (error: unknown) =>
      scope.postMessage({ error: error instanceof Error ? error.message : "Could not hash the file" }),
  );
};
