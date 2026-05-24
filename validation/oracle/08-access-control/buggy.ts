interface Note {
  id: string;
  ownerId: string;
  text: string;
}

export class NoteStore {
  private readonly notes = new Map<string, Note>();
  private seq = 0;

  createNote(ownerId: string, text: string): { id: string } {
    const id = `n${++this.seq}`;
    this.notes.set(id, { id, ownerId, text });
    return { id };
  }

  getNote(requesterId: string, noteId: string): string {
    const note = this.notes.get(noteId);
    if (!note) throw new Error(`no such note: ${noteId}`);
    // BUG (IDOR / broken access control): returns the text by id without ever
    // checking that requesterId owns the note. `requesterId` is accepted and
    // ignored, so any user who knows (or guesses) an id reads another user's note.
    return note.text;
  }

  listNoteIds(ownerId: string): string[] {
    return [...this.notes.values()].filter((n) => n.ownerId === ownerId).map((n) => n.id);
  }
}
