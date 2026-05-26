# @hoge1e3/content

Binary/text content container that normalises conversions between the many buffer types in JavaScript.

## Motivation

JavaScript has too many ways to represent binary data (`ArrayBuffer`, `Uint8Array`, Node.js `Buffer`, data URL, plain text) and converting between them is repetitive and error-prone. `@hoge1e3/content` wraps them all in a single `Content` object and converts lazily on demand.

## Install

```bash
npm install @hoge1e3/content
```

## Quick start

```ts
import { Content } from "@hoge1e3/content";

// from plain text
const c = Content.fromPlainText("hello");
c.toUint8Array();   // Uint8Array
c.toArrayBuffer();  // ArrayBuffer
c.toURL();          // data:text/plain;base64,...

// from a data URL
const c2 = Content.fromDataURL("data:image/png;base64,iVBORw0...");
c2.toArrayBuffer(); // ArrayBuffer
c2.toNodeBuffer();  // Buffer (Node.js)

// "mixed text": plain text OR data URL, chosen automatically
const c3 = Content.fromMixedText(someString);
c3.toMixedText();   // round-trips back to the same representation
```

## API

### Static factory methods

| Method | Description |
|--------|-------------|
| `Content.fromPlainText(text, contentType?)` | Wrap a plain string |
| `Content.fromDataURL(url)` | Wrap a `data:…;base64,…` URL |
| `Content.fromMixedText(text)` | Auto-detect: data URL → `fromDataURL`, otherwise `fromPlainText` |
| `Content.fromUint8Array(bin, contentType?)` | Wrap a `Uint8Array` |
| `Content.fromArrayBuffer(bin, contentType?)` | Wrap an `ArrayBuffer` |
| `Content.fromNodeBuffer(bin, contentType?)` | Wrap a Node.js `Buffer` |
| `Content.deserialize(s)` | Restore from a `SerializedContent` object |

### Instance conversion methods

| Method | Returns |
|--------|---------|
| `toPlainText()` | `string` |
| `toURL()` | data URL `string` |
| `toMixedText()` | plain text or data URL (whichever is shorter) |
| `toUint8Array()` | `Uint8Array` |
| `toArrayBuffer()` | `ArrayBuffer` |
| `toNodeBuffer()` | Node.js `Buffer` |
| `toBlob()` | `Blob` |
| `toBin(binType?)` | `ArrayBuffer` \| `Uint8Array` \| `Buffer` depending on `binType` |
| `serialize()` | `SerializedContent` (Transferrable between browser and workers) |

### Utility

| Method | Description |
|--------|-------------|
| `Content.setBufferPolyfill(Buffer)` | Provide a `Buffer` polyfill for browser environments |
| `Content.looksLikeDataURL(text)` | Returns `true` if the string starts with `data:` |
| `roughSize()` | Approximate byte size of the stored content |

### `DataURL` helper class

```ts
import { DataURL } from "@hoge1e3/content";

const d = new DataURL("data:image/png;base64,iVBORw0...");
d.toUint8Array();   // decode
d.contentType;      // "image/png"

const d2 = new DataURL(uint8Array, "image/png");
d2.toURL();         // encode
```

## Build

```bash
npm install
npm run tsc
```
