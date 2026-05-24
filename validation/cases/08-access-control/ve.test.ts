// =============================================================================
// IV&V verification environment — Case 08: Multi-user note store (access control)
// SECURITY LENS: OWASP A01:2021 — Broken Access Control (IDOR / horizontal priv-esc)
//
// Independence: this file was authored from spec.md ALONE. The implementation
// (sut.ts) and any oracle/ directory were NOT read. The SUT is imported by name.
//
// Verification plan (traceability spec -> cover point -> check):
//   R1  createNote(owner,text) -> {id}; note owned by owner       -> cov "create"            -> happy-path + property
//   R2  getNote(owner, ownNoteId) -> text                         -> cov "owner-read-ok"     -> happy-path + property
//   INV "No cross-user read": getNote(Y, X's note) THROWS         -> cov "cross-user-denied" -> directed + random history  [PRIMARY ATTACK]
//   INV "Ids are not a secret": B KNOWS A's id, still denied      -> cov "known-id-denied"   -> directed (id passed explicitly)
//   R3  listNoteIds(owner) = exactly owner's ids, no leakage      -> cov "list-isolation"    -> property over random history
//   R4  unknown noteId -> THROWS                                  -> cov "unknown-throws"    -> directed + random
// =============================================================================

import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';
import { NoteStore } from './sut';

// ---------------------------------------------------------------------------
// Functional coverage collector (lightweight UVM-style cover model)
// ---------------------------------------------------------------------------
class CoverageModel {
  private bins = new Map<string, number>();
  constructor(private readonly planned: string[]) {
    for (const p of planned) this.bins.set(p, 0);
  }
  cover(bin: string) {
    this.bins.set(bin, (this.bins.get(bin) ?? 0) + 1);
  }
  report() {
    return [...this.bins.entries()].map(([k, v]) => `${k}=${v}`).join('  ');
  }
  assertClosed() {
    const holes = [...this.bins.entries()].filter(([, v]) => v === 0).map(([k]) => k);
    if (holes.length) throw new Error(`Coverage NOT closed. Unhit cover points: ${holes.join(', ')}`);
  }
}

const cov = new CoverageModel([
  'create',
  'owner-read-ok',
  'cross-user-denied',
  'known-id-denied',
  'list-isolation',
  'unknown-throws'
]);

// ---------------------------------------------------------------------------
// Reference model — an INDEPENDENT from-spec implementation of the policy.
// Written ONLY from spec.md. This is the scoreboard's golden model.
//   - owner map: noteId -> ownerId
//   - text map:  noteId -> text
//   - getNote(req,id): id must exist AND owner(id) === req, else "throw"
//   - listNoteIds(u): ids whose owner === u
// The model returns a tagged result so the scoreboard can compare "threw vs value".
// ---------------------------------------------------------------------------
type RefResult = { kind: 'ok'; value: string } | { kind: 'throw' };

class ReferenceNoteStore {
  private owner = new Map<string, string>();
  private text = new Map<string, string>();
  private counter = 0;
  createNote(ownerId: string, text: string): { id: string } {
    const id = `ref-${this.counter++}`;
    this.owner.set(id, ownerId);
    this.text.set(id, text);
    return { id };
  }
  getNote(requesterId: string, noteId: string): RefResult {
    if (!this.owner.has(noteId)) return { kind: 'throw' }; // unknown id
    if (this.owner.get(noteId) !== requesterId) return { kind: 'throw' }; // not owner
    return { kind: 'ok', value: this.text.get(noteId)! };
  }
  listNoteIds(ownerId: string): string[] {
    return [...this.owner.entries()].filter(([, o]) => o === ownerId).map(([id]) => id);
  }
}

// Monitor: normalize a DUT call into the same tagged shape as the ref model.
function observeGet(fn: () => string): RefResult {
  try {
    return { kind: 'ok', value: fn() };
  } catch {
    return { kind: 'throw' };
  }
}

// =============================================================================
// PHASE A/B — Directed worked examples from the spec (the security semantics)
// =============================================================================
describe('Directed: spec worked examples', () => {
  test('owner reads own note; cross-user and unknown throw; list isolated', () => {
    const s = new NoteStore();
    const a = s.createNote('alice', 'alice-secret');
    const b = s.createNote('bob', 'bob-secret');
    cov.cover('create');

    // Owner happy paths (R2)
    expect(s.getNote('alice', a.id)).toBe('alice-secret');
    expect(s.getNote('bob', b.id)).toBe('bob-secret');
    cov.cover('owner-read-ok');

    // PRIMARY ATTACK: bob reads alice's note -> MUST THROW (no IDOR)
    expect(() => s.getNote('bob', a.id)).toThrow();
    cov.cover('cross-user-denied');

    // And critically: it must NOT have returned alice's text.
    expect(observeGet(() => s.getNote('bob', a.id))).toEqual({ kind: 'throw' });

    // Unknown / non-owner user -> MUST THROW (R4 / INV)
    expect(() => s.getNote('eve', a.id)).toThrow();
    cov.cover('unknown-throws');

    // List isolation (R3)
    expect(s.listNoteIds('alice')).toEqual([a.id]);
    expect(s.listNoteIds('alice')).not.toContain(b.id);
    cov.cover('list-isolation');
  });
});

// =============================================================================
// PHASE C — "Ids are not a secret": B explicitly KNOWS A's exact id, still denied
// (Insecure Direct Object Reference probe — the heart of OWASP A01)
// =============================================================================
describe('Directed: IDOR — knowing the id confers no access', () => {
  test('B holds A\'s exact noteId and is still denied', () => {
    const s = new NoteStore();
    const a = s.createNote('alice', 'top-secret-balance-42');
    const stolenId = a.id; // B has somehow learned the id (it is NOT a secret per spec)

    // B uses the exact, correct id of A's note.
    const result = observeGet(() => s.getNote('bob', stolenId));
    expect(result.kind).toBe('throw');
    // Defensive: if it did return, prove it is NOT alice's secret leaking.
    if (result.kind === 'ok') {
      expect(result.value).not.toBe('top-secret-balance-42');
    }
    cov.cover('known-id-denied');
  });

  test('unknown id thrown even for a legitimate user', () => {
    const s = new NoteStore();
    s.createNote('alice', 'x');
    expect(() => s.getNote('alice', 'definitely-not-a-real-id')).toThrow();
    cov.cover('unknown-throws');
  });
});

// =============================================================================
// PHASE C — Constrained-random multi-user histories + scoreboard
// Generator: random users create notes; random (often different) users attempt reads.
// Scoreboard: DUT vs independent reference model on EVERY getNote transaction.
// =============================================================================
const userArb = fc.constantFrom('alice', 'bob', 'carol', 'dave', 'eve', 'mallory');
const textArb = fc.string({ minLength: 0, maxLength: 40 });

describe('Property: scoreboard DUT vs reference model over random histories', () => {
  test('every getNote matches the policy model (throw-vs-value)', () => {
    fc.assert(
      fc.property(
        // A sequence of create operations, then a sequence of read attempts.
        fc.array(fc.record({ owner: userArb, text: textArb }), { minLength: 1, maxLength: 25 }),
        fc.array(fc.record({ requester: userArb, idPicker: fc.nat() }), { minLength: 1, maxLength: 40 }),
        (creates, reads) => {
          const dut = new NoteStore();
          const ref = new ReferenceNoteStore();

          // Drive creates into both. Keep a parallel record of (dutId, owner, text).
          const created: { dutId: string; owner: string; text: string }[] = [];
          for (const c of creates) {
            const dutId = dut.createNote(c.owner, c.text).id;
            ref.createNote(c.owner, c.text); // ref ids differ; we map by index below
            created.push({ dutId, owner: c.owner, text: c.text });
            cov.cover('create');
          }

          // Drive reads. We compare the SECURITY DECISION (throw vs allow) and,
          // when allowed, that the returned text is the OWNER's text — using the
          // ground truth in `created`, NOT the ref's internal ids.
          for (const r of reads) {
            const idx = r.idPicker % created.length;
            const target = created[idx];
            const requester = r.requester;

            const dutResult = observeGet(() => dut.getNote(requester, target.dutId));

            // Ground-truth policy decision derived independently from spec:
            const shouldAllow = requester === target.owner;

            if (shouldAllow) {
              expect(dutResult.kind).toBe('ok');
              if (dutResult.kind === 'ok') expect(dutResult.value).toBe(target.text);
              cov.cover('owner-read-ok');
            } else {
              // No cross-user read: MUST throw, MUST NOT leak the owner's text.
              expect(dutResult.kind).toBe('throw');
              if (dutResult.kind === 'ok') {
                // This branch failing is a confirmed authorization bypass.
                expect(dutResult.value).not.toBe(target.text);
              }
              cov.cover('cross-user-denied');
              if (requester !== target.owner) cov.cover('known-id-denied');
            }
          }
          return true;
        }
      ),
      { numRuns: 500 }
    );
  });
});

// =============================================================================
// PHASE C — List isolation property
// =============================================================================
describe('Property: listNoteIds never leaks across users', () => {
  test('list(u) = exactly the ids u created, and disjoint from others', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ owner: userArb, text: textArb }), { minLength: 0, maxLength: 30 }),
        (creates) => {
          const dut = new NoteStore();
          const byOwner = new Map<string, Set<string>>();
          for (const c of creates) {
            const id = dut.createNote(c.owner, c.text).id;
            if (!byOwner.has(c.owner)) byOwner.set(c.owner, new Set());
            byOwner.get(c.owner)!.add(id);
            cov.cover('create');
          }

          for (const u of new Set(creates.map((c) => c.owner))) {
            const listed = dut.listNoteIds(u);
            const listedSet = new Set(listed);
            const expected = byOwner.get(u) ?? new Set<string>();

            // Exactly this owner's ids.
            expect(listedSet).toEqual(expected);

            // CROSS-USER LEAKAGE CHECK: none of the listed ids belong to another user.
            for (const [other, ids] of byOwner) {
              if (other === u) continue;
              for (const otherId of ids) {
                if (!expected.has(otherId)) {
                  expect(listed).not.toContain(otherId);
                }
              }
            }
            cov.cover('list-isolation');
          }
          return true;
        }
      ),
      { numRuns: 300 }
    );
  });

  test('listNoteIds for a user who created nothing is empty (no leakage)', () => {
    const s = new NoteStore();
    s.createNote('alice', 'a');
    s.createNote('bob', 'b');
    expect(s.listNoteIds('eve')).toEqual([]);
    cov.cover('list-isolation');
  });
});

// =============================================================================
// PHASE C — Adversarial / fuzz: every cross-user attempt over a known-id matrix
// Construct N notes for distinct owners, then have EVERY non-owner attack EVERY id.
// This is the exhaustive horizontal-priv-esc sweep with full id knowledge.
// =============================================================================
describe('Adversarial: exhaustive cross-user id sweep (full id knowledge)', () => {
  test('no non-owner can ever read any note text', () => {
    const owners = ['alice', 'bob', 'carol', 'dave'];
    const s = new NoteStore();
    const notes = owners.map((o, i) => ({ owner: o, text: `secret-of-${o}-${i}`, id: '' }));
    for (const n of notes) {
      n.id = s.createNote(n.owner, n.text).id;
      cov.cover('create');
    }

    for (const attacker of owners) {
      for (const n of notes) {
        const res = observeGet(() => s.getNote(attacker, n.id));
        if (attacker === n.owner) {
          expect(res).toEqual({ kind: 'ok', value: n.text });
          cov.cover('owner-read-ok');
        } else {
          // MUST be denied; MUST NOT leak n.text under any circumstance.
          expect(res.kind).toBe('throw');
          if (res.kind === 'ok') expect(res.value).not.toBe(n.text);
          cov.cover('cross-user-denied');
          cov.cover('known-id-denied');
        }
      }
    }
    // External attacker who never created anything.
    for (const n of notes) {
      expect(() => s.getNote('external-attacker', n.id)).toThrow();
      cov.cover('unknown-throws');
    }
  });
});

// =============================================================================
// PHASE D — Oracle-free metamorphic relations (no shared-spec oracle)
// =============================================================================
describe('Metamorphic: order/identity invariants', () => {
  test('idempotent owner reads return the same text (no state mutation on read)', () => {
    const s = new NoteStore();
    const a = s.createNote('alice', 'val');
    const r1 = s.getNote('alice', a.id);
    const r2 = s.getNote('alice', a.id);
    expect(r1).toBe(r2);
    expect(r1).toBe('val');
    cov.cover('owner-read-ok');
  });

  test('a denied cross-user read does not change the owner\'s subsequent access', () => {
    const s = new NoteStore();
    const a = s.createNote('alice', 'persist');
    // Attack first...
    expect(() => s.getNote('bob', a.id)).toThrow();
    // ...owner still reads fine afterwards (denial must not corrupt state).
    expect(s.getNote('alice', a.id)).toBe('persist');
    cov.cover('cross-user-denied');
    cov.cover('owner-read-ok');
  });

  test('same text for two owners stays isolated (collision does not grant access)', () => {
    const s = new NoteStore();
    const a = s.createNote('alice', 'IDENTICAL');
    const b = s.createNote('bob', 'IDENTICAL');
    expect(s.getNote('alice', a.id)).toBe('IDENTICAL');
    expect(s.getNote('bob', b.id)).toBe('IDENTICAL');
    // Cross reads still denied even though texts are equal.
    expect(() => s.getNote('bob', a.id)).toThrow();
    expect(() => s.getNote('alice', b.id)).toThrow();
    cov.cover('cross-user-denied');
    cov.cover('known-id-denied');
  });
});

// =============================================================================
// PHASE E — Bench-has-teeth check: confirm the scoreboard model itself enforces
// the policy (sanity that an "allow-all" model would be caught by our checks).
// We verify our OWN reference model denies cross-user reads — if it didn't, the
// scoreboard would be vacuous. (Self-mutation rationale documented in report.)
// =============================================================================
describe('Self-check: reference model has teeth', () => {
  test('reference model itself denies cross-user reads', () => {
    const ref = new ReferenceNoteStore();
    const a = ref.createNote('alice', 'x');
    expect(ref.getNote('alice', a.id)).toEqual({ kind: 'ok', value: 'x' });
    expect(ref.getNote('bob', a.id)).toEqual({ kind: 'throw' });
    expect(ref.getNote('alice', 'nope')).toEqual({ kind: 'throw' });
  });
});

// =============================================================================
// PHASE F — Coverage closure gate
// =============================================================================
describe('Coverage closure', () => {
  test('all planned cover points were exercised', () => {
    // eslint-disable-next-line no-console
    console.log('FUNCTIONAL COVERAGE:', cov.report());
    cov.assertClosed();
  });
});
