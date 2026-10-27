import { closeSync, fsyncSync, lstatSync, openSync, readFileSync, realpathSync, unlinkSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { isAbsolute, join, relative } from 'node:path';
import { z } from 'zod';
import { canonicalize } from '../core/canonical';
import { chainLink, hashCanonical } from '../core/hash';
import type { Approval } from '../core/contracts';
import { LiveTrancheSchema } from '../core/ids';
import { decodeChain, encodeChain } from './chain';

export const APP_MAX_USD = 40;
const SHA = z.string().regex(/^[0-9a-f]{64}$/);
const Money = z.number().nonnegative().finite();
const Start = z.object({ type: z.literal('start'), id: z.string().min(1), approvalId: SHA, approvalSha256: SHA, tranche: LiveTrancheSchema, maxUsd: Money, preregSha256: SHA.nullable(), heldoutSha256: SHA.nullable(), destination: z.string().min(1) }).strict();
const CarryStart = z.object({ type: z.literal('carry_start'), sealedPairsSha256: SHA, matcherSha256: SHA, publicPairsSha256: SHA, destination: z.string().min(1) }).strict();
// Closed metadata codes only: loader exceptions may contain sealed content and must never enter this journal.
const CarryOutcome = z.enum(['conformance_passed', 'conformance_failed', 'receipt_write_failed', 'sealed_load_failed', 'sealed_hash_mismatch', 'sealed_schema_invalid', 'sealed_identity_invalid', 'duplicate_pair_ids', 'evaluation_failed', 'result_write_failed']);
export type CarryOutcome = z.infer<typeof CarryOutcome>;
const Entry = z.discriminatedUnion('type', [
  z.object({ type: z.literal('activate'), schemaVersion: z.literal(1), app: z.literal('handoff-loss-study'), appMaxUsd: z.literal(APP_MAX_USD) }).strict(),
  Start,
  z.object({ type: z.literal('reserve'), id: z.string().min(1), attemptId: z.string().min(1), boundUsd: Money }).strict(),
  z.object({ type: z.literal('settle'), id: z.string().min(1), actualUsd: Money }).strict(),
  z.object({ type: z.literal('finish'), attemptId: z.string().min(1), status: z.enum(['completed', 'stopped', 'burned']), reason: z.string().min(1) }).strict(),
  CarryStart,
  z.object({ type: z.literal('carry_finish'), sealedPairsSha256: SHA, outcome: CarryOutcome }).strict(),
]);
type StartEntry = z.infer<typeof Start>;
interface Attempt { start: StartEntry; charged: number; finished: boolean }
interface State { appCharged: number; attempts: Map<string, Attempt>; reservations: Map<string, { attemptId: string; bound: number }>; settled: Set<string>; carry: Map<string, { finished: boolean }> }

function directory(root: string): string {
  if (!isAbsolute(root) || !lstatSync(root).isDirectory() || lstatSync(root).isSymbolicLink()) throw new Error('trusted live state root must be an existing absolute operator directory');
  return realpathSync(root);
}
function outside(parent: string, child: string): boolean { const path = relative(parent, child); return isAbsolute(path) || path === '..' || path.startsWith('../') || path.startsWith('..\\'); }
function approvalId(approval: Approval): string {
  // A decision digest is optional in the existing approval contract; never require new signing infrastructure.
  const decision = approval.approver.decisionSha256 === null ? { reference: approval.approver.decisionRef } : { sha256: approval.approver.decisionSha256 };
  return hashCanonical({ tranche: approval.tranche, decision });
}

/** Trusted host provisioning only; never called by the CLI or as a missing-state fallback. */
export function initializeLiveState(root: string): void {
  const fd = openSync(join(directory(root), 'live-state.jsonl'), 'wx');
  try { writeFileSync(fd, encodeChain([{ type: 'activate', schemaVersion: 1, app: 'handoff-loss-study', appMaxUsd: APP_MAX_USD }])); fsyncSync(fd); } finally { closeSync(fd); }
}

/** One operator-owned authority across outputs, approvals and all three tranches. */
export class LiveStateJournal {
  readonly root: string;
  readonly path: string;
  constructor(root: string, productRoot: string) {
    this.root = directory(root);
    if (!outside(realpathSync(productRoot), this.root)) throw new Error('live state must remain outside product repo');
    this.path = join(this.root, 'live-state.jsonl');
    // Missing/empty/malformed journals must never be treated as zero prior spend.
    this.transact(() => undefined);
  }
  private transact<T>(action: (state: State, append: (entry: z.infer<typeof Entry>) => void) => T): T {
    const lockPath = `${this.path}.lock`;
    const lock = openSync(lockPath, 'wx'); // fail closed: no wait, stale-lock recovery or replacement
    try {
      if (!lstatSync(this.path).isFile() || lstatSync(this.path).isSymbolicLink()) throw new Error('live state journal must be an existing regular operator file');
      const rows = decodeChain(readFileSync(this.path, 'utf8'));
      const state: State = { appCharged: 0, attempts: new Map(), reservations: new Map(), settled: new Set(), carry: new Map() };
      for (const [index, row] of rows.entries()) {
        const entry = Entry.parse(row.payload);
        if (index === 0) { if (entry.type !== 'activate') throw new Error('live state activation header missing'); continue; }
        if (entry.type === 'activate') throw new Error('duplicate live state activation header');
        if (entry.type === 'carry_start') {
          if (state.carry.has(entry.sealedPairsSha256)) throw new Error('sealed carry edition already consumed');
          state.carry.set(entry.sealedPairsSha256, { finished: false });
        } else if (entry.type === 'carry_finish') {
          const carry = state.carry.get(entry.sealedPairsSha256);
          if (carry === undefined || carry.finished) throw new Error('invalid sealed carry finish');
          carry.finished = true;
        } else if (entry.type === 'start') {
          if (entry.maxUsd > APP_MAX_USD || state.attempts.has(entry.id) || [...state.attempts.values()].some((a) => a.start.approvalId === entry.approvalId)) throw new Error('invalid or repeated approval attempt');
          if (entry.tranche === 'T2' ? entry.preregSha256 === null || entry.heldoutSha256 === null : entry.preregSha256 !== null || entry.heldoutSha256 !== null) throw new Error('live state edition identity mismatch');
          if (entry.tranche === 'T2' && [...state.attempts.values()].some((a) => a.start.tranche === 'T2' && (a.start.heldoutSha256 === entry.heldoutSha256 || a.start.preregSha256 === entry.preregSha256))) throw new Error('heldout/prereg edition already consumed or burned');
          state.attempts.set(entry.id, { start: entry, charged: 0, finished: false });
        } else if (entry.type === 'reserve') {
          const attempt = state.attempts.get(entry.attemptId);
          if (attempt === undefined || attempt.finished || state.reservations.has(entry.id) || state.appCharged + entry.boundUsd > APP_MAX_USD || attempt.charged + entry.boundUsd > attempt.start.maxUsd) throw new Error('invalid live state reservation or exhausted app/approval/tranche cap');
          state.reservations.set(entry.id, { attemptId: entry.attemptId, bound: entry.boundUsd }); attempt.charged += entry.boundUsd; state.appCharged += entry.boundUsd;
        } else if (entry.type === 'settle') {
          const reservation = state.reservations.get(entry.id);
          const attempt = reservation === undefined ? undefined : state.attempts.get(reservation.attemptId);
          if (reservation === undefined || attempt === undefined || attempt.finished || state.settled.has(entry.id)) throw new Error('invalid live state settlement');
          // Report actual overruns honestly; future reservations will then fail their cap check.
          const delta = entry.actualUsd - reservation.bound;
          attempt.charged += delta; state.appCharged += delta; state.settled.add(entry.id);
        } else {
          const attempt = state.attempts.get(entry.attemptId);
          if (attempt === undefined || attempt.finished || (entry.status === 'burned' && attempt.start.tranche !== 'T2') || (entry.status === 'stopped' && attempt.start.tranche === 'T2')) throw new Error('invalid live attempt finish');
          attempt.finished = true;
        }
      }
      let index = rows.length; const priorHead = rows.at(-1)?.hash;
      if (priorHead === undefined) throw new Error('empty live state journal');
      let head: string = priorHead;
      return action(state, (entry) => {
        const hash = chainLink(head, entry);
        const fd = openSync(this.path, 'a');
        try { writeFileSync(fd, canonicalize({ index, previous: head, hash, payload: entry }) + '\n'); fsyncSync(fd); } finally { closeSync(fd); }
        index += 1; head = hash;
      });
    } finally { closeSync(lock); unlinkSync(lockPath); }
  }
  /** The sealed digest alone is once-only identity; matcher/public/approval/output changes cannot reset it. */
  claimCarry(edition: { sealedPairsSha256: string; matcherSha256: string; publicPairsSha256: string }, destination: string): void {
    const entry = CarryStart.parse({ type: 'carry_start', ...edition, destination });
    this.transact((state, append) => {
      if (state.carry.has(entry.sealedPairsSha256)) throw new Error('sealed carry edition already consumed; a new matcher requires new sealed pairs');
      append(entry); // same exclusive lock + fsynced append as live starts; claim precedes the loader
    });
  }
  finishCarry(sealedPairsSha256: string, outcome: CarryOutcome): void {
    const entry = Entry.parse({ type: 'carry_finish', sealedPairsSha256, outcome });
    this.transact((state, append) => {
      const carry = state.carry.get(sealedPairsSha256);
      if (carry === undefined || carry.finished) throw new Error('invalid sealed carry finish');
      append(entry); // retain the claim for completed, failed and stopped evaluations alike
    });
  }
  start(approval: Approval, plannedBoundUsd: number, edition: { preregSha256: string | null; heldoutSha256: string | null }, destination: string): LiveAttempt {
    const id = randomUUID();
    const start = Start.parse({ type: 'start', id, approvalId: approvalId(approval), approvalSha256: hashCanonical(approval), tranche: approval.tranche, maxUsd: approval.maxUsd, ...edition, destination });
    this.transact((state, append) => {
      if (!Number.isFinite(plannedBoundUsd) || plannedBoundUsd < 0 || start.maxUsd > APP_MAX_USD || plannedBoundUsd > start.maxUsd || state.appCharged + plannedBoundUsd > APP_MAX_USD) throw new Error('live app/approval/tranche spend + plan bound exceeds cap');
      if ([...state.attempts.values()].some((a) => a.start.approvalId === start.approvalId)) throw new Error('approval/tranche already attempted; owner reconciliation required');
      if (start.tranche === 'T2') {
        if (start.preregSha256 === null || start.heldoutSha256 === null) throw new Error('T2 immutable edition identity required');
        if ([...state.attempts.values()].some((a) => a.start.tranche === 'T2' && (a.start.heldoutSha256 === start.heldoutSha256 || a.start.preregSha256 === start.preregSha256))) throw new Error('heldout/prereg edition already consumed or burned');
      } else if (start.preregSha256 !== null || start.heldoutSha256 !== null) throw new Error('unexpected dev edition identity');
      append(start);
    });
    return new LiveAttempt(this, id);
  }
  charged(attemptId: string): number { return this.transact((state) => { const a = state.attempts.get(attemptId); if (a === undefined || a.finished) throw new Error('live attempt unavailable'); return a.charged; }); }
  async reserve(attemptId: string, boundUsd: number, maxUsd: number): Promise<string> {
    return this.transact((state, append) => {
      const a = state.attempts.get(attemptId);
      if (a === undefined || a.finished || maxUsd !== a.start.maxUsd || !Number.isFinite(boundUsd) || boundUsd < 0 || a.charged + boundUsd > maxUsd || state.appCharged + boundUsd > APP_MAX_USD) throw new Error('durable app/approval/tranche spend + bound exceeds cap or attempt closed');
      const id = randomUUID(); append({ type: 'reserve', id, attemptId, boundUsd }); return id;
    });
  }
  async settle(attemptId: string, id: string, actualUsd: number): Promise<void> {
    this.transact((state, append) => {
      if (!Number.isFinite(actualUsd) || actualUsd < 0 || state.reservations.get(id)?.attemptId !== attemptId || state.settled.has(id) || state.attempts.get(attemptId)?.finished !== false) throw new Error('invalid live state settlement');
      append({ type: 'settle', id, actualUsd });
    });
  }
  finish(attemptId: string, reason: string, completed: boolean): void {
    this.transact((state, append) => {
      const a = state.attempts.get(attemptId); if (a === undefined || a.finished || !reason) throw new Error('invalid live attempt finish');
      append({ type: 'finish', attemptId, status: completed ? 'completed' : a.start.tranche === 'T2' ? 'burned' : 'stopped', reason });
    });
  }
}

/** Provider port is bound to a durable start; no caller-selected path or accounting scope. */
export class LiveAttempt {
  readonly journal: LiveStateJournal;
  readonly id: string;
  constructor(journal: LiveStateJournal, id: string) { this.journal = journal; this.id = id; }
  charged(): number { return this.journal.charged(this.id); }
  reserve(boundUsd: number, maxUsd: number): Promise<string> { return this.journal.reserve(this.id, boundUsd, maxUsd); }
  settle(id: string, actualUsd: number): Promise<void> { return this.journal.settle(this.id, id, actualUsd); }
  finish(reason: string, completed = false): void { this.journal.finish(this.id, reason, completed); }
}
