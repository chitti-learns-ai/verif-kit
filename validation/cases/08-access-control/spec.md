# Spec — Multi-user note store (access control)

A small in-memory service where each user stores private notes. **Access control
is the point of this spec**: a note belongs to the user who created it and is
private to that user.

## Interface

```ts
export class NoteStore {
  /** Create a note owned by `ownerId`. Returns the new note's id. */
  createNote(ownerId: string, text: string): { id: string };
  /** Return the note's text — ONLY if `requesterId` owns it (see policy). */
  getNote(requesterId: string, noteId: string): string;
  /** Return the ids of notes owned by `ownerId` (only that owner's). */
  listNoteIds(ownerId: string): string[];
}
```

## Access-control policy (the security contract)

- A note is owned by the `ownerId` passed to `createNote`.
- `getNote(requesterId, noteId)` returns the text **only when `requesterId` is the
  note's owner**. If `requesterId` is any other user, it MUST throw an `Error`
  (access denied / forbidden) — it MUST NOT return another user's note text. This
  holds **even if the requester knows the exact `noteId`** (ids are not secret;
  ownership is what gates access — i.e. no Insecure Direct Object Reference).
- `listNoteIds(ownerId)` returns only notes owned by `ownerId` — never another
  user's ids.
- An unknown `noteId` → throw.

## Worked examples (define the security semantics)

```ts
const s = new NoteStore();
const a = s.createNote('alice', 'alice-secret');   // a.id
const b = s.createNote('bob', 'bob-secret');        // b.id

s.getNote('alice', a.id);   // 'alice-secret'   (owner reads own note → ok)
s.getNote('bob',   b.id);   // 'bob-secret'
s.getNote('bob',   a.id);   // MUST THROW — bob is not the owner of alice's note
s.getNote('eve',   a.id);   // MUST THROW — unknown/non-owner
s.listNoteIds('alice');     // [a.id]  (never includes b.id)
```

## Invariants

- **No cross-user read**: for any two distinct users X and Y, and any note owned
  by X, `getNote(Y, noteId)` throws — never returns X's text.
- **Owner access**: the owner can always read their own note.
- **List isolation**: `listNoteIds(u)` contains exactly the ids `u` created.
- **Ids are not a secret**: knowing a `noteId` confers no access without ownership.

## Out of scope

- Authentication itself (we assume `requesterId` is a trustworthy identity from
  the caller's auth layer); encryption; rate limiting. The bug class under test is
  **authorization** (does the code enforce ownership), not crypto.
