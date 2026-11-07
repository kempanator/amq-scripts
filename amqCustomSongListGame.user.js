// ==UserScript==
// @name         AMQ Custom Song List Game
// @namespace    https://github.com/kempanator
// @version      0.111
// @description  Play a simulated AMQ solo or multiplayer quiz with a custom song list
// @author       kempanator
// @match        https://*.animemusicquiz.com/*
// @require      https://github.com/joske2865/AMQ-Scripts/raw/master/common/amqScriptInfo.js
// @downloadURL  https://github.com/kempanator/amq-scripts/raw/main/amqCustomSongListGame.user.js
// @updateURL    https://github.com/kempanator/amq-scripts/raw/main/amqCustomSongListGame.user.js
// @grant        GM_xmlhttpRequest
// @connect      myanimelist.net
// ==/UserScript==

/*
CSL is a simulated quiz that replicates AMQ's real quiz functionality with a custom song list.
Song lists can be imported from various formats.
In multiplayer, a host runs the quiz and synchronizes players through room chat.

How to start a custom song list game:
  1. Create a solo or multiplayer lobby (all players need this script)
  2. Click the CSL button in the top right
  3. Click the autocomplete button if it is red
  4. Create or upload a list in the song list tab
  5. Change settings in the settings tab
  6. Fix any invalid answers in the answer tab
  7. Click start to play the quiz

Supported upload files:
  1. Anisongdb json
  2. Official AMQ song history export
  3. Joseph song list script export
  4. Blissfulyoshi ranked song list

Some considerations:
  1. The quiz is not real so you do not earn XP
  1. Anisongdb is unavailable during ranked, please prepare some json files in advance
  2. Anime titles that were changed recently in AMQ will be incorrect if anisongdb never updated it
  3. No automatic volume equalizing
  4. Keep duplicates in the song list if you want to use any acceptable title for each
*/


"use strict";
if (typeof Listener === "undefined") return;

// Protocol and scheduling

// Centralize the limits of the chat transport and quiz lifecycle.
const CSL = Object.freeze({
    prefix: "§CSL!",
    frameLength: 150,
    maxFragments: 512,
    maxPlayers: 64,
    maxBytes: 32768,
    maxAssemblies: 64,
    sendSpacing: 50,
    repairDelay: 1600,
    cacheTime: 90000,
    bufferTime: 12000,
    deliveryGrace: 1200,
    soloAnswerDelay: 500,
    collectTime: 6000,
    revealTime: 25000,
    fastRevealTime: 6000,
    announcementDelay: 500
});

// Give chat message codes readable names without changing their wire format.
const CSL_MESSAGE = Object.freeze({
    BEGIN: "B",
    PREPARE: "U",
    READY: "D",
    PLAY: "P",
    LOCK: "L",
    COLLECT: "K",
    COMMIT: "A",
    COMMIT_RECEIPT: "J",
    REVEAL: "V",
    REVEAL_RECEIPT: "Z",
    RESULT: "R",
    FINAL: "F",
    PAUSE: "T",
    CONNECTION: "E",
    STOP: "X",
    ANNOUNCE: "H",
    SYNC: "Q",
    SNAPSHOT: "Y",
    REPAIR: "N",
    SKIP: "S"
});

// Manual lobby prompts and their replies.
const CSL_LOBBY_COMMAND = Object.freeze({
    AUTOCOMPLETE: {
        command: "§CSL?A",
        reply: () => `Autocomplete: ${animeListLower.size ? "✅" : "⛔"}`
    },
    VERSION: {
        command: "§CSL?V",
        reply: () => `CSL version ${GM_info.script.version}`
    }
});

// Measure durations independently of system-clock adjustments.
function cslNow() {
    return performance.now();
}

// Avoid repeating verbose field names for every player in chat results and snapshots.
const CSL_PLAYER_FIELDS = ["id", "name", "score", "correctGuesses", "reviveScore", "eliminated", "connected", "activeFrom", "correct", "answer", "time"];

// Compact repeated player records while keeping decoded state descriptive.
function cslPack(type, value) {
    if (![CSL_MESSAGE.RESULT, CSL_MESSAGE.SNAPSHOT].includes(type)) return value;
    return { ...value, players: value.players.map(player => CSL_PLAYER_FIELDS.map(field => player[field] ?? null)) };
}

// Expand player records at the protocol boundary before validation or scoring.
function cslUnpack(type, value) {
    if (![CSL_MESSAGE.RESULT, CSL_MESSAGE.SNAPSHOT].includes(type)) return value;
    if (!value || !Array.isArray(value.players) || !value.players.every(Array.isArray)) return value;
    const players = value.players.map(row => {
        const fields = CSL_PLAYER_FIELDS.map((field, index) => [field, row[index]]);
        return Object.fromEntries(fields);
    });
    return { ...value, players };
}

// Clone plain records before they cross editor, session, or network boundaries.
function cslClone(value) {
    return JSON.parse(JSON.stringify(value));
}

// Encode Unicode JSON without relying on Latin-1 btoa input.
function cslEncode(value) {
    const bytes = new TextEncoder().encode(JSON.stringify(value));
    if (bytes.length > CSL.maxBytes) throw new Error("CSL message is too large");
    return btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(""))
        .replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

// Decode and bound an assembled JSON message before interpreting its contents.
function cslDecode(text) {
    const bytes = Uint8Array.from(atob(text.replaceAll("-", "+").replaceAll("_", "/")), char => char.charCodeAt(0));
    if (bytes.length > CSL.maxBytes) throw new Error("CSL message is too large");
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

// Generate hexadecimal recovery nonces and answer secrets with the browser RNG.
function cslRandom(bytes = 6) {
    return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), byte => byte.toString(16).padStart(2, "0")).join("");
}

// Encode three random bytes as a four-character base64url session identifier.
function cslSessionId() {
    return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(3)))).replaceAll("+", "-").replaceAll("/", "_");
}

// Bind an answer commitment to its exact session, round, revision, and secret.
async function cslCommitment(session, round, revision, answer, secret) {
    const data = new TextEncoder().encode(JSON.stringify([session, round, revision, answer, secret]));
    const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
    return btoa(Array.from(hash, byte => String.fromCharCode(byte)).join("")).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

// Own cancellable work so callbacks cannot survive a stopped session or phase.
class CslScope {
    // Accept a replaceable clock for deterministic lifecycle tests.
    constructor(clock = globalThis) {
        this.clock = clock;
        this.timers = new Set();
        this.closed = false;
    }

    // Run a callback only while this scope remains alive.
    after(delay, callback) {
        if (this.closed) return;
        const timer = this.clock.setTimeout(() => {
            this.timers.delete(timer);
            if (!this.closed) callback();
        }, delay);
        this.timers.add(timer);
        return timer;
    }

    // Cancel every outstanding callback and permanently close the scope.
    close() {
        this.closed = true;
        for (const timer of this.timers) this.clock.clearTimeout(timer);
        this.timers.clear();
    }
}

// Carry bounded, repairable logical messages over AMQ's existing room chat.
class CslTransport {
    // Inject chat delivery and scheduling rather than depending on AMQ globals.
    constructor({ name, send, receive, allow, warning, canSend = () => true, clock = globalThis, now = cslNow, spacing = CSL.sendSpacing }) {
        Object.assign(this, { name, sendFrame: send, receiveMessage: receive, allow, warning, canSend, clock, now, spacing });
        this.scope = new CslScope(clock);
        this.queue = [];
        this.cache = new Map();
        this.incoming = new Map();
        this.completed = new Map();
        this.serial = 0;
        this.sending = false;
        this.tick();
    }

    // Fill each frame using its actual header size, recalculating if the count grows.
    frames(session, id, round, type, value) {
        const encoded = cslEncode(value);
        const prefix = `${CSL.prefix}${session}.${id}.${round.toString(36)}.${type}.`;
        let count = 1;
        while (true) {
            const frames = [];
            for (let offset = 0; offset < encoded.length;) {
                if (frames.length >= CSL.maxFragments) throw new Error("Too many CSL fragments");
                const header = `${prefix}${frames.length.toString(36)}.${count.toString(36)}.`;
                const fragment = encoded.slice(offset, offset + CSL.frameLength - header.length);
                frames.push(header + fragment);
                offset += fragment.length;
            }
            if (frames.length === count) return frames;
            count = frames.length;
        }
    }

    // Queue one message atomically and retain its fragments for bounded repair.
    send(session, round, type, value, priority = 2, done = () => { }, replaceKey = "") {
        if (this.scope.closed || !this.canSend({ session, type })) return;
        const id = (++this.serial).toString(36);
        const frames = this.frames(session, id, round, type, value);
        if (replaceKey) this.queue = this.queue.filter(item => item.replaceKey !== replaceKey);
        if (this.queue.length + frames.length > 2048) throw new Error("CSL chat queue is full");
        this.cache.set(`${session}:${id}`, { frames, type, time: this.now() });
        if (this.cache.size > 256) this.cache.delete(this.cache.keys().next().value);
        frames.forEach((frame, index) => {
            this.queue.push({
                session, type, frame, priority, replaceKey,
                done: index === frames.length - 1 ? done : null
            });
        });
        this.pump();
        return id;
    }

    // Deliver at a bounded rate while preserving insertion order within priorities.
    pump() {
        if (this.sending || !this.queue.length || this.scope.closed) return;
        this.queue = this.queue.filter(item => this.canSend(item));
        if (!this.queue.length) return;
        const scope = this.scope;
        this.sending = true;
        this.queue.sort((a, b) => a.priority - b.priority);
        const item = this.queue.shift();
        try {
            const sent = this.sendFrame(item.frame, item);
            if (sent !== false && item.done) item.done();
        }
        catch (error) {
            this.warning(`Chat delivery failed: ${error.message}`);
        }
        scope.after(this.spacing, () => {
            this.sending = false;
            this.pump();
        });
    }

    // Validate headers before allocating buffers or accepting any message payload.
    receive(text, sender) {
        if (typeof text !== "string" || text.length > CSL.frameLength || typeof sender !== "string") return;
        const match = /^§CSL!([A-Za-z0-9_-]{4})\.([a-z0-9]{1,6})\.([a-z0-9]{1,4})\.([A-Z])\.([a-z0-9]{1,2})\.([a-z0-9]{1,2})\.([A-Za-z0-9_-]+)$/.exec(text);
        if (!match) return;
        const [, session, id, roundText, type, indexText, countText, fragment] = match;
        const round = parseInt(roundText, 36);
        const index = parseInt(indexText, 36);
        const count = parseInt(countText, 36);
        const envelope = { session, id, round, type, sender };
        if (count < 1 || count > CSL.maxFragments || index >= count || !this.allow(envelope)) return;
        const key = `${session}:${sender}:${id}`;
        if (this.completed.has(key)) return;
        let entry = this.incoming.get(key);
        if (!entry) {
            if (this.incoming.size >= CSL.maxAssemblies) return;
            entry = { ...envelope, count, parts: new Map(), time: this.now(), progress: this.now(), repair: 0 };
            this.incoming.set(key, entry);
        }
        const headerChanged = entry.count !== count || entry.type !== type || entry.round !== round;
        const fragmentChanged = entry.parts.has(index) && entry.parts.get(index) !== fragment;
        if (headerChanged || fragmentChanged) {
            this.incoming.delete(key);
            this.completed.set(key, this.now());
            return;
        }
        if (!entry.parts.has(index)) {
            entry.progress = this.now();
            entry.repair = 0;
        }
        entry.parts.set(index, fragment);
        if (entry.parts.size !== count) return;
        this.incoming.delete(key);
        this.completed.set(key, this.now());
        try {
            const encoded = Array.from({ length: count }, (_, part) => entry.parts.get(part)).join("");
            const value = cslDecode(encoded);
            if (type === CSL_MESSAGE.REPAIR) this.repair(session, value);
            else this.receiveMessage(envelope, value);
        }
        catch (error) {
            this.warning(`Ignored invalid chat data: ${error.message}`);
        }
    }

    // Resend only requested fragments of an existing cached message.
    repair(session, request) {
        if (!request || request.to !== this.name || !Array.isArray(request.missing) || request.missing.length > CSL.maxFragments) return;
        const cached = this.cache.get(`${session}:${request.id}`);
        if (!cached || (cached.lastRepair !== undefined && this.now() - cached.lastRepair < 1000)) return;
        cached.lastRepair = this.now();
        for (const index of new Set(request.missing)) {
            if (!Number.isInteger(index)) continue;
            const frame = cached.frames[index];
            if (!frame || this.queue.some(item => item.frame === frame) || this.queue.length >= 2048) continue;
            this.queue.push({ session, type: cached.type, frame, priority: 1 });
        }
        this.pump();
    }

    // Expire transfer state and ask for missing fragments without infinite retries.
    tick() {
        const now = this.now();
        for (const [key, entry] of this.incoming) {
            if (!this.allow(entry) || now - entry.time > CSL.cacheTime || entry.repair >= 3) {
                this.incoming.delete(key);
                continue;
            }
            if (now - entry.progress > CSL.repairDelay * (entry.repair + 1)) {
                entry.repair++;
                const missing = Array.from({ length: entry.count }, (_, index) => index).filter(index => !entry.parts.has(index));
                this.send(entry.session, entry.round, CSL_MESSAGE.REPAIR, { to: entry.sender, id: entry.id, missing }, 1);
            }
        }
        for (const map of [this.cache, this.completed]) {
            for (const [key, value] of map) {
                const time = typeof value === "number" ? value : value.time;
                if (now - time > CSL.cacheTime) map.delete(key);
            }
        }
        this.scope.after(800, () => this.tick());
    }

    // Remove pending transfers when their session is no longer relevant.
    cancel(session) {
        this.queue = this.queue.filter(item => item.session !== session);
        for (const map of [this.cache, this.incoming, this.completed]) {
            for (const key of map.keys()) if (key.startsWith(`${session}:`)) map.delete(key);
        }
    }

    // Discard every transfer and timer before using this transport in another room.
    reset() {
        this.close();
        this.scope = new CslScope(this.clock);
        this.tick();
    }

    // Release all scheduler resources when the transport itself is discarded.
    close() {
        this.scope.close();
        this.queue = [];
        this.cache.clear();
        this.incoming.clear();
        this.completed.clear();
        this.sending = false;
    }
}

// Scoring and round lifecycle

// Match accepted titles using the fixed answer set captured at quiz start.
function cslCorrect(song, answer) {
    return Boolean(answer) && song.acceptedAnswers.includes(answer.trim().toLowerCase());
}

// Score the round's original participants even if they leave or reconnect before results.
function cslScore(players, answers, song, config, round, participants) {
    const correct = new Map(players.map(player => {
        const answer = answers[player.id]?.answer || "";
        return [player.id, participants.has(player.id) && cslCorrect(song, answer)];
    }));
    const livingCorrect = players.length === 1 || players.some(player => player.score > 0 && correct.get(player.id));
    return players.map(player => {
        const result = {
            ...player,
            correct: correct.get(player.id),
            answer: answers[player.id]?.answer || "",
            time: answers[player.id]?.time ?? config.guessTime + config.extraGuessTime
        };
        if (!participants.has(player.id)) return result;
        if (result.correct) result.correctGuesses++;
        if (config.scoreType === 4) {
            if (player.score > 0 && !result.correct && livingCorrect) {
                result.score--;
                if (!result.score) result.eliminated = round;
            }
            else if (player.score === 0 && result.correct) {
                if (player.reviveScore < 2) result.reviveScore++;
                else if (!livingCorrect) {
                    result.score = 1;
                    result.reviveScore = 0;
                    result.eliminated = null;
                }
            }
        }
        else if (result.correct) result.score++;
        return result;
    });
}

// Rank ties consistently and retain elimination order in lives mode.
function cslStandings(players, scoreType) {
    const rankValues = player => {
        if (scoreType !== 4) return [player.score];
        const alive = player.connected && player.score > 0;
        return [alive ? 1 : 0, alive ? player.score : player.eliminated ?? 0];
    };
    const compare = (a, b) => {
        const first = rankValues(a);
        const second = rankValues(b);
        for (let index = 0; index < first.length; index++) {
            if (first[index] !== second[index]) return second[index] - first[index];
        }
        return 0;
    };
    const sorted = [...players].sort((a, b) => compare(a, b) || a.id - b.id);
    let place = 1;
    return sorted.map((player, index) => {
        if (index && compare(player, sorted[index - 1])) place = index + 1;
        return { id: player.id, place };
    });
}

// Drive solo and multiplayer through the same host-authoritative round lifecycle.
class CslSession {
    // Receive immutable quiz inputs and environment-specific presentation hooks.
    constructor({ id, name, host, config, roster, plan = [], solo = false, emit, hooks, clock = globalThis, now = cslNow }) {
        Object.assign(this, { id, name, host, solo, emit, hooks, clock, now });
        this.config = cslClone(config);
        this.plan = cslClone(plan);
        this.players = roster.map(player => ({
            ...player,
            score: config.scoreType === 4 ? config.lives : 0,
            correctGuesses: 0,
            reviveScore: 0,
            eliminated: null,
            connected: true,
            activeFrom: 1
        }));
        this.scope = new CslScope(clock);
        this.phaseScope = new CslScope(clock);
        this.phase = "starting";
        this.round = 0;
        this.playedRound = 0;
        this.sequence = 0;
        this.applied = 0;
        this.media = new Map();
        this.readiness = new Map();
        this.commits = new Map();
        this.localAnswers = new Map();
        this.answers = {};
        this.roundParticipants = new Set();
        this.votes = new Set();
        this.revision = 0;
        this.ackRevision = 0;
        this.paused = false;
        this.lastSync = -Infinity;
        this.waitUntilRound = 1;
        this.result = null;
        this.pendingResult = false;
    }

    // Identify the sole authority for transitions and scoring.
    get isHost() {
        return this.name === this.host;
    }

    // Resolve the local participant without accepting player IDs from chat payloads.
    get self() {
        return this.players.find(player => player.name === this.name);
    }

    // Select participants eligible for this round and its readiness/skip votes.
    active() {
        return this.players.filter(player => player.connected && player.activeFrom <= this.round);
    }

    // Start presentation once and announce a new host session to the room.
    start(announce = false) {
        this.hooks.start(this);
        if (!announce) return;
        const roster = this.players.map(({ id, name }) => ({ id, name }));
        this.send(CSL_MESSAGE.BEGIN, { config: this.config, roster }, 0, 0, () => this.buffer(1));
    }

    // Route one logical message through the injected network or solo loopback.
    send(type, value, round = this.round, priority = 1, done = () => { }, replaceKey = "") {
        if (this.scope.closed) return;
        try {
            return this.emit(this.id, round, type, this.solo ? value : cslPack(type, value), priority, done, replaceKey);
        }
        catch (error) {
            this.hooks.warning(error.message);
            this.hooks.end(this);
        }
    }

    // Broadcast an ordered host decision and apply it locally after it is sent.
    publish(type, value = {}, round = this.round, done = () => { }) {
        if (!this.isHost || this.scope.closed) return;
        const payload = { ...value, q: ++this.sequence };
        this.send(type, payload, round, 1, () => {
            if (this.scope.closed) return;
            this.receive({ session: this.id, sender: this.host, round, type }, payload);
            done();
        });
    }

    // Cancel phase work before entering another phase.
    enter(phase) {
        this.phaseScope.close();
        this.phaseScope = new CslScope(this.clock);
        this.phase = phase;
        this.votes.clear();
    }

    // Send only media information before guessing, keeping titles on the host.
    prepare(round) {
        if (!this.isHost || round > this.config.totalSongs || this.media.has(round)) return;
        const song = this.plan[round - 1];
        const media = { audio: song.audio, video480: song.video480, video720: song.video720, sample: song.sample };
        this.media.set(round, media);
        this.hooks.prepare(this, round, media);
        this.send(CSL_MESSAGE.PREPARE, media, round, 2);
    }

    // Wait a bounded time for preparation, then continue even when media fails.
    buffer(round) {
        if (this.scope.closed || !this.isHost) return;
        this.round = round;
        this.enter("buffering");
        this.hooks.buffer(this);
        this.phaseScope.after(CSL.bufferTime, () => {
            const status = this.readiness.get(round) || new Map();
            const missing = this.active().filter(player => !status.has(player.name));
            if (missing.length) this.hooks.warning(`Song ${round}: continuing without ${missing.map(player => player.name).join(", ")} (loading timed out)`);
            this.bufferExpired = true;
            this.maybePlay();
        });
        this.prepare(round);
        this.maybePlay();
    }

    // Start exactly once when everyone responds or the loading deadline expires.
    maybePlay() {
        if (!this.isHost || this.phase !== "buffering" || this.paused || this.playPending) return;
        const status = this.readiness.get(this.round) || new Map();
        if (!this.bufferExpired && this.active().some(player => !status.has(player.name))) return;
        this.playPending = true;
        this.publish(CSL_MESSAGE.PLAY, {}, this.round);
    }

    // Report success or failure for the actual media round reported by AMQ.
    ready(round, ok) {
        if (!Number.isInteger(round) || round < Math.max(1, this.round) || round > this.round + 1) return;
        if (!this.readiness.has(round)) this.readiness.set(round, new Map());
        const status = this.readiness.get(round);
        if (status.has(this.name) && status.get(this.name) === ok) return;
        status.set(this.name, ok);
        if (!ok) this.hooks.warning(`Song ${round}: media could not load; the game will continue`);
        this.send(CSL_MESSAGE.READY, { ok }, round);
        this.maybePlay();
    }

    // Freeze local input once, allowing AMQ's normal auto-submit handler to run.
    freeze() {
        if (this.frozen) return;
        this.autoSubmitting = true;
        this.hooks.lock(this);
        this.autoSubmitting = false;
        this.frozen = true;
    }

    // Measure submission time within the current round's guess window.
    answerTime() {
        return Math.max(0, Math.min((this.now() - this.started) / 1000, this.config.guessTime + this.config.extraGuessTime));
    }

    // Store solo answers directly and commit multiplayer answers for later reveal.
    async submit(answer) {
        if ((this.phase !== "guessing" || this.frozen) && !this.autoSubmitting) return false;
        if (!this.self || !this.self.connected || this.self.activeFrom > this.round || typeof answer !== "string") return false;
        if (new TextEncoder().encode(answer).length > 512) {
            this.hooks.warning("Answer is too long to send");
            return false;
        }
        if (this.solo) {
            const time = this.answerTime();
            this.answers[this.self.id] = { answer, time };
            this.hooks.answered(this, this.self.id, time);
            return true;
        }
        const round = this.round;
        const revision = ++this.revision;
        const secret = cslRandom(12);
        const record = { revision, answer, secret };
        this.localAnswers.set(revision, record);
        const hash = await cslCommitment(this.id, round, revision, answer, secret);
        if (this.scope.closed || this.round !== round || revision !== this.revision || !["guessing", "locking"].includes(this.phase)) return false;
        record.hash = hash;
        this.retryCommit(record, round);
        return true;
    }

    // Repair a wholly lost commitment as well as a partially received transfer.
    retryCommit(record, round, attempt = 0) {
        if (this.scope.closed || round !== this.round || record.revision !== this.revision) return;
        if (this.ackRevision >= record.revision || !["guessing", "locking"].includes(this.phase) || attempt >= 3) return;
        this.send(CSL_MESSAGE.COMMIT, { revision: record.revision, hash: record.hash }, round, 0, () => { }, "answer");
        this.scope.after(700, () => this.retryCommit(record, round, attempt + 1));
    }

    // Retry a complete reveal until the host confirms it or collection ends.
    retryReveal(record, round, attempt = 0) {
        if (this.scope.closed || round !== this.round || this.phase !== "collecting" || this.revealAckRevision >= record.revision || attempt >= 3) return;
        this.send(CSL_MESSAGE.REVEAL, { revision: record.revision, answer: record.answer, secret: record.secret }, round, 0);
        this.scope.after(1000, () => this.retryReveal(record, round, attempt + 1));
    }

    // Record one phase-specific skip vote from the local participant.
    vote() {
        if (this.self && this.self.connected && ["guessing", "revealing"].includes(this.phase)) this.send(CSL_MESSAGE.SKIP, { phase: this.phase });
    }

    // Advance after unanimous votes without allowing dead or missing peers to stall.
    checkVotes() {
        if (!this.isHost || !this.active().length || this.active().some(player => !this.votes.has(player.name))) return;
        if (this.phase === "guessing") this.lock();
        else if (this.phase === "revealing") this.advance();
    }

    // Stop guessing, then reserve a short window for in-flight commitments.
    lock() {
        if (!this.isHost || this.phase !== "guessing" || this.lockPending) return;
        this.lockPending = true;
        this.publish(CSL_MESSAGE.LOCK);
    }

    // Verify a reveal against the commitment frozen before any answers were exposed.
    async reveal(sender, value) {
        if (!this.isHost || this.phase !== "collecting") return;
        if (!value || typeof value.answer !== "string" || !/^[a-f0-9]{24}$/.test(value.secret)) return;
        if (new TextEncoder().encode(value.answer).length > 512) return;
        const player = this.players.find(player => player.name === sender);
        const commit = this.commits.get(sender);
        const round = this.round;
        if (!player || !commit || commit.revision !== value.revision) return;
        if (this.answers[player.id]) {
            this.send(CSL_MESSAGE.REVEAL_RECEIPT, { to: sender, revision: value.revision }, round, 0);
            return;
        }
        const hash = await cslCommitment(this.id, round, value.revision, value.answer, value.secret);
        if (this.scope.closed || this.round !== round || this.phase !== "collecting" || hash !== commit.hash) return;
        this.answers[player.id] = { answer: value.answer, time: commit.time };
        this.send(CSL_MESSAGE.REVEAL_RECEIPT, { to: sender, revision: value.revision }, round, 0);
        if (!this.missingReveals().length) this.finishRound();
    }

    // Resolve commitments still awaiting their matching answer reveal.
    missingReveals() {
        return [...this.commits.keys()].filter(name => {
            const player = this.players.find(player => player.name === name);
            return !this.answers[player.id];
        });
    }

    // Publish scores and song metadata together so they cannot arrive out of order.
    finishRound() {
        if (!this.isHost || this.phase !== "collecting" || this.pendingResult) return;
        this.pendingResult = true;
        const missing = this.missingReveals();
        if (missing.length) this.hooks.warning(`Missing answer reveals: ${missing.join(", ")}`);
        const song = this.plan[this.round - 1];
        const players = cslScore(this.players, this.answers, song, this.config, this.round, this.roundParticipants);
        const { acceptedAnswers, sample, ...publicSong } = song;
        const living = players.filter(player => player.connected && player.score > 0);
        const lastSong = this.round === this.config.totalSongs;
        const livesFinished = this.config.scoreType === 4
            && (this.players.length === 1 ? living.length === 0 : living.length <= 1);
        const finished = lastSong || livesFinished;
        this.publish(CSL_MESSAGE.RESULT, { players, song: publicSong, finished });
    }

    // Finish the reveal while paused and defer the next round until the host resumes.
    advance() {
        if (!this.isHost || this.phase !== "revealing" || this.advancePending) return;
        this.advanceRequested = true;
        if (this.paused && !this.result.finished) return;
        this.advancePending = true;
        if (this.result.finished) this.publish(CSL_MESSAGE.FINAL, { ranks: cslStandings(this.players, this.config.scoreType) });
        else {
            this.bufferExpired = false;
            this.buffer(this.round + 1);
            this.advancePending = false;
        }
    }

    // Toggle the normal AMQ pause-between-songs behavior on the host.
    pause() {
        if (this.isHost) this.publish(CSL_MESSAGE.PAUSE, { paused: !this.paused });
    }

    // Announce host-controlled return to the server's still-existing lobby.
    stop() {
        if (this.isHost) {
            this.enter("stopping");
            this.publish(CSL_MESSAGE.STOP);
        }
        else this.hooks.warning("The host controls returning to the lobby; use Leave to exit");
    }

    // Mark disconnected players so readiness and votes keep making progress.
    disconnect(name) {
        const player = this.players.find(player => player.name === name);
        if (!this.isHost || !player?.connected) return;
        player.connected = false;
        player.eliminated = this.round;
        this.publish(CSL_MESSAGE.CONNECTION, { name, connected: false });
        this.maybePlay();
        this.checkVotes();
    }

    // Produce a bounded snapshot without exposing unrevealed titles or answers.
    snapshot(to, nonce) {
        if (!this.isHost) return;
        const player = this.players.find(player => player.name === to);
        if (player && !player.connected) {
            player.connected = true;
            player.activeFrom = this.phase === "buffering" ? this.round : this.round + 1;
        }
        const result = this.phase === "revealing" ? { song: this.result.song, finished: this.result.finished } : null;
        const players = result ? this.players : this.players.map(({ answer, correct, time, ...player }) => player);
        this.send(CSL_MESSAGE.SNAPSHOT, {
            to, nonce, config: this.config, players, q: this.applied, phase: this.phase,
            media: [...this.media].filter(([round]) => round >= this.round).map(([round, media]) => [round, media]),
            ...(result ? { result } : {}),
            ...(this.phase === "collecting" ? { commits: [...this.commits].map(([name, commit]) => [name, commit.revision]) } : {}),
            paused: this.paused, ranks: this.phase === "finished" ? cslStandings(this.players, this.config.scoreType) : null
        }, this.round, 2);
    }

    // Preserve an ongoing round during sync while keeping late arrivals at a round boundary.
    restore(snapshot, round) {
        if (snapshot.q < this.applied) return;
        const reveal = snapshot.result && round === this.playedRound;
        const ongoing = round === this.playedRound && ["guessing", "locking", "collecting"].includes(this.phase)
            && ["guessing", "locking", "collecting"].includes(snapshot.phase);
        const alreadyRevealed = this.phase === "revealing";
        if (reveal) this.freeze();
        this.applied = snapshot.q;
        this.players = cslClone(snapshot.players);
        this.round = round;
        this.paused = snapshot.paused;
        if (!ongoing) this.enter(reveal ? "revealing" : "waiting");
        this.waitUntilRound = ongoing || snapshot.phase === "buffering" ? round : round + 1;
        if (reveal) {
            this.result = { ...snapshot.result, players: this.players };
            if (!alreadyRevealed) this.hooks.result(this, this.result);
        }
        else if (ongoing) {
            if (snapshot.phase === "locking" && this.phase === "guessing") this.beginLocking();
            if (snapshot.phase === "collecting") this.beginCollection(snapshot.commits);
        }
        else this.hooks.restore(this);
        this.hooks.pause(this);
        for (const [mediaRound, media] of snapshot.media) {
            if (mediaRound >= this.waitUntilRound && !this.media.has(mediaRound)) {
                this.media.set(mediaRound, media);
                this.hooks.prepare(this, mediaRound, media);
            }
        }
        if (snapshot.ranks) {
            this.enter("finished");
            this.hooks.finish(this, snapshot.ranks);
        }
    }

    // Ask the host for fresh state, limiting requests during a prolonged outage.
    synchronize() {
        if (this.isHost || this.now() - this.lastSync < 4000) return;
        this.lastSync = this.now();
        this.hooks.sync(this);
    }

    // Capture scoring participants before any gameplay callbacks can change connection state.
    beginGuessing(round) {
        this.round = round;
        this.playedRound = round;
        this.roundParticipants = new Set(this.active().map(player => player.id));
        this.enter("guessing");
        this.playPending = false;
        this.bufferExpired = false;
        this.lockPending = false;
        this.advancePending = false;
        this.advanceRequested = false;
        this.pendingResult = false;
        this.commits.clear();
        this.localAnswers.clear();
        this.answers = {};
        this.result = null;
        this.revision = 0;
        this.ackRevision = 0;
        this.revealAckRevision = 0;
        this.frozen = false;
        this.started = this.now();
        this.hooks.play(this);
        this.phaseScope.after(this.config.guessTime * 1000, () => {
            if (this.config.extraGuessTime) this.hooks.extra(this);
        });
        this.phaseScope.after((this.config.guessTime + this.config.extraGuessTime) * 1000, () => {
            this.freeze();
            this.lock();
        });
        if (this.isHost) this.scope.after(100, () => this.prepare(round + 1));
        for (const oldRound of this.media.keys()) if (oldRound < round) this.media.delete(oldRound);
        for (const oldRound of this.readiness.keys()) if (oldRound < round) this.readiness.delete(oldRound);
    }

    // Hold solo results for 500 ms or allow multiplayer commitments to finish arriving.
    beginLocking() {
        this.freeze();
        this.enter("locking");
        if (!this.isHost) return;
        this.phaseScope.after(this.solo ? CSL.soloAnswerDelay : CSL.deliveryGrace, () => {
            if (this.solo) this.beginCollection();
            else this.publish(CSL_MESSAGE.COLLECT, { commits: [...this.commits].map(([name, commit]) => [name, commit.revision]) });
        });
    }

    // Score solo immediately after its delay or collect the frozen multiplayer reveals.
    beginCollection(commits = []) {
        this.freeze();
        this.enter("collecting");
        if (this.solo) {
            this.finishRound();
            return;
        }
        const accepted = commits.find(([name]) => name === this.name);
        if (accepted) {
            const answer = this.localAnswers.get(accepted[1]);
            if (answer) this.retryReveal(answer, this.round);
            else this.hooks.warning("Your accepted answer could not be recovered");
        }
        else if (this.revision) this.hooks.warning("Your answer did not reach the host before guessing closed");
        if (this.isHost) this.phaseScope.after(this.commits.size ? CSL.collectTime : 50, () => this.finishRound());
    }

    // Apply one authoritative round result and schedule the existing replay duration.
    applyResults(value) {
        this.players = cslClone(value.players);
        this.result = value;
        const waiting = this.phase === "waiting" && this.playedRound !== this.round;
        if (!waiting) this.freeze();
        this.enter(waiting ? "waiting" : "revealing");
        if (waiting) this.hooks.restore(this);
        else this.hooks.result(this, value);
        if (this.isHost) this.phaseScope.after(this.config.fastSkip ? CSL.fastRevealTime : CSL.revealTime, () => this.advance());
    }

    // Display final ranks and keep the automatic return-to-lobby delay.
    showFinalStandings(ranks) {
        this.enter("finished");
        this.hooks.finish(this, ranks);
        if (this.isHost) this.phaseScope.after(this.config.fastSkip ? 4000 : 8000, () => this.stop());
    }

    // Apply validated host decisions or participant requests exactly once.
    receive(envelope, value) {
        value = cslUnpack(envelope.type, value);
        if (this.scope.closed || envelope.session !== this.id || !value || typeof value !== "object") return;
        const { sender, type, round } = envelope;
        const fromHost = sender === this.host;
        const player = this.players.find(player => player.name === sender);
        if (type === CSL_MESSAGE.ANNOUNCE) {
            if (fromHost && value.q > this.applied) this.synchronize();
            return;
        }
        if (type === CSL_MESSAGE.PREPARE) {
            if (!fromHost || !(round >= this.waitUntilRound && round >= this.round && round <= this.round + 1)) return;
            if (this.media.has(round) || !cslValidMedia(value)) return;
            this.media.set(round, value);
            this.hooks.prepare(this, round, value);
            return;
        }
        if (type === CSL_MESSAGE.READY) {
            if (!this.isHost || !player || typeof value.ok !== "boolean") return;
            if (!(round >= this.round && round <= this.round + 1)) return;
            if (!this.readiness.has(round)) this.readiness.set(round, new Map());
            this.readiness.get(round).set(sender, value.ok);
            if (!value.ok && sender !== this.name) {
                this.hooks.warning(`Song ${round}: ${sender} could not load media; continuing automatically`);
            }
            this.maybePlay();
            return;
        }
        if (type === CSL_MESSAGE.COMMIT) {
            this.receiveCommit(sender, player, round, value);
            return;
        }
        if (type === CSL_MESSAGE.COMMIT_RECEIPT) {
            if (!fromHost || round !== this.round || value.to !== this.name) return;
            if (Number.isInteger(value.revision) && value.revision <= this.revision) {
                this.ackRevision = Math.max(this.ackRevision, value.revision);
            }
            return;
        }
        if (type === CSL_MESSAGE.REVEAL_RECEIPT) {
            if (!fromHost || round !== this.round || value.to !== this.name) return;
            if (this.localAnswers.has(value.revision)) {
                this.revealAckRevision = Math.max(this.revealAckRevision, value.revision);
            }
            return;
        }
        if (type === CSL_MESSAGE.REVEAL) {
            if (round === this.round) this.reveal(sender, value).catch(error => this.hooks.warning(error.message));
            return;
        }
        if (type === CSL_MESSAGE.SKIP) {
            if (!this.isHost || !player || !player.connected || !(player.activeFrom <= round)) return;
            if (round !== this.round || value.phase !== this.phase) return;
            this.votes.add(sender);
            this.checkVotes();
            return;
        }
        if (fromHost) this.receiveControl(type, round, value);
    }

    // Accept newer commitments and acknowledge identical retries from the sender.
    receiveCommit(sender, player, round, value) {
        if (!player || !player.connected || !(player.activeFrom <= round) || round !== this.round) return;
        if (!["guessing", "locking"].includes(this.phase)) return;
        if (!Number.isInteger(value.revision) || value.revision <= 0 || value.revision > 10000) return;
        if (!/^[A-Za-z0-9_-]{43}$/.test(value.hash)) return;

        const previous = this.commits.get(sender);
        const newer = !previous || previous.revision < value.revision;
        const identical = previous && previous.revision === value.revision && previous.hash === value.hash;
        if (this.isHost && (newer || identical)) {
            this.send(CSL_MESSAGE.COMMIT_RECEIPT, { to: sender, revision: value.revision }, round, 0, () => { }, `receipt:${sender}`);
        }
        if (previous && previous.revision >= value.revision) return;
        const time = this.answerTime();
        this.commits.set(sender, { revision: value.revision, hash: value.hash, time });
        this.hooks.answered(this, player.id, time);
    }

    // Enforce host sequencing before applying a gameplay transition.
    receiveControl(type, round, value) {
        if (!Number.isSafeInteger(value.q) || value.q <= this.applied) return;
        const controlTypes = [
            CSL_MESSAGE.PLAY, CSL_MESSAGE.LOCK, CSL_MESSAGE.COLLECT, CSL_MESSAGE.RESULT,
            CSL_MESSAGE.FINAL, CSL_MESSAGE.PAUSE, CSL_MESSAGE.CONNECTION, CSL_MESSAGE.STOP
        ];
        if (!controlTypes.includes(type)) return;
        if (type === CSL_MESSAGE.STOP) {
            this.applied = value.q;
            this.hooks.end(this);
            return;
        }
        if (value.q !== this.applied + 1) {
            this.synchronize();
            return;
        }
        if (!cslValidControl(type, value, this.players, this.config)) return;
        if (type === CSL_MESSAGE.PLAY) {
            const sameBufferedRound = round === this.round && ["buffering", "waiting"].includes(this.phase);
            const nextRound = round === this.round + 1;
            if (!this.media.has(round) || round < this.waitUntilRound || (!nextRound && !sameBufferedRound)) {
                this.synchronize();
                return;
            }
        }
        this.applied = value.q;
        if (type === CSL_MESSAGE.PAUSE) {
            this.paused = value.paused;
            this.hooks.pause(this);
            this.maybePlay();
            if (!this.paused && this.advanceRequested) this.advance();
            return;
        }
        if (type === CSL_MESSAGE.CONNECTION) {
            const target = this.players.find(player => player.name === value.name);
            if (target) {
                target.connected = value.connected;
                if (!target.connected) target.eliminated = round;
            }
            this.maybePlay();
            this.checkVotes();
            return;
        }
        if (type === CSL_MESSAGE.PLAY) this.beginGuessing(round);
        else if (type === CSL_MESSAGE.LOCK && round === this.round && this.phase !== "waiting") this.beginLocking();
        else if (type === CSL_MESSAGE.COLLECT && round === this.round && this.phase !== "waiting") this.beginCollection(value.commits);
        else if (type === CSL_MESSAGE.RESULT && round === this.round) this.applyResults(value);
        else if (type === CSL_MESSAGE.FINAL) this.showFinalStandings(value.ranks);
    }

    // Invalidate timers and asynchronous answer work when this quiz ends.
    close() {
        this.scope.close();
        this.phaseScope.close();
        this.phase = "closed";
        this.localAnswers.clear();
    }
}

// Message validation

// Validate playback records from chat without trusting arbitrary object shapes.
function cslValidMedia(value) {
    return value && Number.isInteger(value.sample) && value.sample >= 0 && value.sample <= 100 && cslValidMediaLinks(value);
}

// Require at least one usable media link and reject unsafe optional qualities too.
function cslValidMediaLinks(value) {
    const links = [value.audio, value.video480, value.video720];
    return links.some(link => typeof link === "string" && link !== "")
        && links.every(link => typeof link === "string" && (link === "" || cslMedia(link) !== ""));
}

// Check score snapshots independently from optional answer-result presentation fields.
function cslValidPlayerState(players, config) {
    return players.every(player => {
        if (!Number.isInteger(player.score) || player.score < 0) return false;
        const maxScore = config.scoreType === 4 ? config.lives : config.totalSongs;
        if (!(player.score <= maxScore)) return false;
        if (!Number.isInteger(player.correctGuesses) || player.correctGuesses < 0 || !(player.correctGuesses <= config.totalSongs)) return false;
        if (!Number.isInteger(player.reviveScore) || player.reviveScore < 0 || player.reviveScore > 2) return false;
        if (typeof player.connected !== "boolean") return false;
        if (!Number.isInteger(player.activeFrom) || player.activeFrom < 1 || !(player.activeFrom <= config.totalSongs + 1)) return false;
        if (player.eliminated === null) return true;
        return Number.isInteger(player.eliminated) && player.eliminated >= 1 && player.eliminated <= config.totalSongs;
    });
}

// Validate settings before starting a host-announced session or restoring state.
function cslValidConfig(value) {
    if (!value) return value;
    if (![1, 4].includes(value.scoreType)) return false;
    if (!Number.isInteger(value.lives) || value.lives < 1 || value.lives > 5) return false;
    if (!Number.isInteger(value.totalSongs) || value.totalSongs < 1 || value.totalSongs > 10000) return false;
    if (!Number.isInteger(value.guessTime) || value.guessTime < 1 || value.guessTime > 99) return false;
    if (!Number.isInteger(value.extraGuessTime) || value.extraGuessTime < 0 || value.extraGuessTime > 15) return false;
    if (typeof value.fastSkip !== "boolean" || typeof value.fullSongRange !== "boolean") return false;
    return typeof value.quizId === "string" && value.quizId.length <= 64 && typeof value.startTime === "string";
}

// Validate authoritative state before sequence advancement or AMQ presentation.
function cslValidControl(type, value, players, config) {
    if (type === CSL_MESSAGE.PAUSE) return typeof value.paused === "boolean";
    if (type === CSL_MESSAGE.CONNECTION) return players.some(player => player.name === value.name) && typeof value.connected === "boolean";
    if (type === CSL_MESSAGE.COLLECT) {
        if (!Array.isArray(value.commits) || value.commits.length > players.length) return false;
        return value.commits.every(entry => {
            if (!Array.isArray(entry)) return false;
            return players.some(player => player.name === entry[0]) && Number.isInteger(entry[1]);
        });
    }
    if (type === CSL_MESSAGE.FINAL) {
        if (!Array.isArray(value.ranks) || value.ranks.length !== players.length) return false;
        if (new Set(value.ranks.map(rank => rank.id)).size !== players.length) return false;
        return value.ranks.every(rank => {
            if (!players.some(player => player.id === rank.id)) return false;
            return Number.isInteger(rank.place) && rank.place > 0 && rank.place <= players.length;
        });
    }
    if (type !== CSL_MESSAGE.RESULT) return true;
    if (!Array.isArray(value.players) || value.players.length !== players.length) return false;
    if (new Set(value.players.map(player => player.id)).size !== players.length) return false;
    if (!cslValidPlayerState(value.players, config)) return false;
    const validResults = value.players.every(player => {
        if (!players.some(old => old.id === player.id && old.name === player.name)) return false;
        if (typeof player.correct !== "boolean" || typeof player.answer !== "string" || player.answer.length > 512) return false;
        return Number.isFinite(player.time) && player.time >= 0 && player.time <= config.guessTime + config.extraGuessTime;
    });
    return validResults && typeof value.finished === "boolean" && cslValidSong(value.song);
}

// Require the normalized fields consumed by AMQ's song-info presentation.
function cslValidSong(song) {
    if (!song) return song;
    const textFields = ["animeRomajiName", "animeEnglishName", "songName", "songArtist"];
    if (!textFields.every(key => typeof song[key] === "string")) return false;
    if (!cslValidMediaLinks(song)) return false;
    const listFields = ["altAnimeNames", "altAnimeNamesAnswers", "animeTags", "animeGenre"];
    if (!listFields.every(key => Array.isArray(song[key]) && song[key].every(value => typeof value === "string"))) return false;
    if (![1, 2, 3].includes(song.songType) || typeof song.animeType !== "string") return false;
    if (song.animeVintage !== null && typeof song.animeVintage !== "string") return false;
    if (song.songDifficulty === null) return true;
    return Number.isFinite(song.songDifficulty) && song.songDifficulty >= 0 && song.songDifficulty <= 100;
}


// Song import and answer merging

// Keep imported text fields explicit instead of coercing arbitrary objects.
function cslText(value) {
    return typeof value === "string" ? value.trim() : "";
}

// Normalize list-valued metadata while removing empty and duplicate strings.
function cslStrings(value) {
    const values = Array.isArray(value) ? value : [value];
    const strings = values
        .filter(item => typeof item === "string")
        .map(item => item.trim())
        .filter(Boolean);
    return [...new Set(strings)];
}

// Preserve legitimate zero difficulty while distinguishing missing values.
function cslDifficulty(value) {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 && number <= 100 ? number : null;
}

// Validate external anime/song identifiers without preserving object-shaped values.
function cslId(value) {
    const number = Number(value);
    return Number.isSafeInteger(number) && number > 0 ? number : null;
}

// Normalize media links using the same HTTPS-only policy at every boundary.
function cslMedia(value) {
    if (typeof value !== "string" || value.length > 2048) return "";
    value = value.trim();
    if (/^[\w-]+\.[\w]{3,4}$/.test(value)) return value;
    try {
        const url = new URL(value);
        return url.protocol === "https:" ? url.href : "";
    }
    catch {
        return "";
    }
}

// Identify repeated playlist appearances by unique ANN ID or normalized media.
function cslRecordingKey(song) {
    if (song.annSongId) return `ann:${song.annSongId}`;
    return `media:${cslPlaylistMediaKey(song.audio || song.video720 || song.video480)}`;
}

// Match AMQ mirrors and bare filenames while preserving other hosts' full URLs.
function cslPlaylistMediaKey(media) {
    if (!media.startsWith("https://")) return `amq:/${media}`;
    const url = new URL(media);
    return url.hostname === "animemusicquiz.com" || url.hostname.endsWith(".animemusicquiz.com") ? `amq:${url.pathname}` : media;
}

// Share anime answers across overlapping AMQ ID and song/artist matches.
function mergeCslAnimeAnswers(songs) {
    const parents = songs.map((song, index) => index);
    // Resolve a group's representative without retaining long chains.
    const findGroup = index => {
        while (parents[index] !== index) {
            parents[index] = parents[parents[index]];
            index = parents[index];
        }
        return index;
    };
    // Join overlapping matches so every song receives the whole group's answers.
    const connectMatchingSongs = keyForSong => {
        const seen = new Map();
        songs.forEach((song, index) => {
            const key = keyForSong(song);
            if (key === null) return;
            const previous = seen.get(key);
            if (previous === undefined) seen.set(key, index);
            else parents[findGroup(index)] = findGroup(previous);
        });
    };
    // Group by optional AMQ song ID first, independently of unique ANN song IDs.
    connectMatchingSongs(song => song.amqSongId || null);
    // Fall back to a complete song/artist pair without altering punctuation.
    connectMatchingSongs(song => {
        if (!song.songName || !song.songArtist) return null;
        return JSON.stringify([song.songName.toLowerCase(), song.songArtist.toLowerCase()]);
    });
    const groupAnswers = new Map();
    songs.forEach((song, index) => {
        const group = findGroup(index);
        if (!groupAnswers.has(group)) groupAnswers.set(group, new Set());
        const titles = [song.animeRomajiName, song.animeEnglishName, ...song.altAnimeNames, ...song.altAnimeNamesAnswers];
        for (const title of titles) {
            if (title) groupAnswers.get(group).add(title);
        }
    });
    songs.forEach((song, index) => {
        const titles = [...groupAnswers.get(findGroup(index))];
        song.altAnimeNamesAnswers = titles.filter(title => !song.altAnimeNames.includes(title));
    });
    return songs;
}

// Merge repeated anime appearances while retaining separate playlist occurrences.
function mergeCslSongs(first, second) {
    const songsByAppearance = new Map();
    for (const song of [...first, ...second]) {
        const key = JSON.stringify([
            cslRecordingKey(song),
            song.annId || song.malId || song.animeRomajiName,
            song.songType,
            song.songTypeNumber
        ]);
        const existing = songsByAppearance.get(key);
        if (!existing) {
            songsByAppearance.set(key, cslClone(song));
            continue;
        }
        existing.amqSongId ??= song.amqSongId;
        existing.altAnimeNames = [...new Set([...existing.altAnimeNames, ...song.altAnimeNames])];
        existing.altAnimeNamesAnswers = [...new Set([...existing.altAnimeNamesAnswers, ...song.altAnimeNamesAnswers])];
    }
    return mergeCslAnimeAnswers([...songsByAppearance.values()]);
}

// Detect creator records that AMQ can resolve into hover information.
function isArtistHoverInfo(info) {
    return Boolean(info && (info.artistId || info.groupId || info.memberArtists || info.memberGroups || info.memberInGroups?.length || info.altNames?.length));
}

// Join anisongdb artists/composers/arrangers[] names when songArtist/etc string fields are missing
function formatAnisongdbCreatorNames(entries) {
    if (!Array.isArray(entries) || !entries.length) return null;
    const names = entries.map((entry) => entry?.names?.[0]).filter(Boolean);
    return names.length ? names.join(" & ") : null;
}

// Convert a database creator into AMQ artist/group identifiers.
function parseAnisongdbArtistEntry(entry) {
    // Anisongdb uses artists/composers/arrangers[] with { id, names, members }; AMQ uses artistId or groupId.
    // Hover only supports one id; multi-artist songs use the first entry for hover and the full credit string for name.
    if (!entry || entry.id == null) return null;
    const name = entry.names?.[0] ?? "";
    const hasMembers = Array.isArray(entry.members) && entry.members.length > 0;
    const info = {
        name,
        memberArtists: [],
        memberGroups: [],
        memberInGroups: [],
        altNames: []
    };
    if (hasMembers) {
        info.groupId = entry.id; // e.g. μ's with member seiyuu list
    }
    else {
        info.artistId = entry.id; // solo composer/arranger/artist
    }
    return info;
}

// Preserve structured creator credits across all supported import sources.
function resolveCreatorInfo(song, infoKey, anisongdbKey, nameFallback) {
    // Prefer AMQ songInfo, then anisongdb array, else name-only (no hover).
    // Always prefer nameFallback for display: quiz UI shows artistInfo.name, and multi-artist
    // anisongdb songs have a full songArtist string ("A & B") while artists[] are individuals.
    const existing = song[infoKey] ?? song.songInfo?.[infoKey];
    if (isArtistHoverInfo(existing)) {
        return {
            name: nameFallback || existing.name || "",
            artistId: existing.artistId ?? null,
            groupId: existing.groupId ?? null,
            memberArtists: existing.memberArtists ?? [],
            memberGroups: existing.memberGroups ?? [],
            memberInGroups: existing.memberInGroups ?? [],
            altNames: existing.altNames ?? []
        };
    }
    const entries = song[anisongdbKey];
    const entry = Array.isArray(entries) ? entries[0] : entries;
    if (entry) {
        const parsed = parseAnisongdbArtistEntry(entry);
        if (parsed) {
            parsed.name = nameFallback || parsed.name;
            return parsed;
        }
    }
    return nameFallback ? { name: nameFallback } : null;
}

// Unwrap the supported export containers without changing format precedence.
function cslSongRecords(data) {
    if (Array.isArray(data)) return data;
    if (!data || typeof data !== "object") throw new Error("Unrecognized song-list format");
    if (data.songs) return data.songs;
    if (data.songHistory) return Object.values(data.songHistory);
    throw new Error("Unrecognized song-list format");
}

// Normalize a list atomically and report records that cannot be played.
function normalizeCslSongs(data) {
    const records = cslSongRecords(data);
    if (!Array.isArray(records)) throw new Error("Song list must contain an array");
    const songs = [];
    let skipped = 0;
    for (const record of records) {
        const song = normalizeCslSong(record);
        if (song) songs.push(song);
        else skipped++;
    }
    mergeCslAnimeAnswers(songs);
    const warnings = skipped ? [`Skipped ${skipped} records with missing or invalid titles, types, or media`] : [];
    return { songs, warnings };
}

// Resolve supported source fields before validating one playable song.
function normalizeCslSong(song) {
    if (!song || typeof song !== "object" || Array.isArray(song)) return null;
    let animeRomajiName = song.animeRomajiName ?? song.animeJPName ?? song.songInfo?.animeNames?.romaji ?? song.anime?.romaji ?? song.animeRomaji ?? song.animeRom ?? "";
    let animeEnglishName = song.animeEnglishName ?? song.animeENName ?? song.songInfo?.animeNames?.english ?? song.anime?.english ?? song.animeEnglish ?? song.animeEng ?? "";
    let altAnimeNames = song.altAnimeNames ?? song.songInfo?.altAnimeNames ?? [].concat(animeRomajiName, animeEnglishName, song.animeAltName || []);
    let altAnimeNamesAnswers = song.altAnimeNamesAnswers ?? song.songInfo?.altAnimeNamesAnswers ?? [];

    let songArtist = song.songArtist ?? song.artist ?? song.songInfo?.artist ?? song.artistInfo?.name ?? formatAnisongdbCreatorNames(song.artists) ?? "";
    let artistInfo = resolveCreatorInfo(song, "artistInfo", "artists", songArtist);
    let songArranger = song.songArranger ?? song.arrangerInfo?.name ?? song.songInfo?.arrangerInfo?.name ?? formatAnisongdbCreatorNames(song.arrangers) ?? "";
    let arrangerInfo = resolveCreatorInfo(song, "arrangerInfo", "arrangers", songArranger);
    let songComposer = song.songComposer ?? song.composerInfo?.name ?? song.songInfo?.composerInfo?.name ?? formatAnisongdbCreatorNames(song.composers) ?? "";
    let composerInfo = resolveCreatorInfo(song, "composerInfo", "composers", songComposer);

    let songName = song.songName ?? song.name ?? song.songInfo?.songName ?? "";
    let songType = song.songType ?? song.type ?? song.songInfo?.type ?? null;
    let songTypeNumber = song.songTypeNumber ?? song.songInfo?.typeNumber ?? null;
    let songDifficulty = cslDifficulty(song.songDifficulty ?? song.difficulty ?? song.songInfo?.animeDifficulty);
    let dub = song.dub ?? song.isDub ?? song.songInfo?.dub ?? null;
    let rebroadcast = song.rebroadcast ?? song.isRebroadcast ?? song.songInfo?.rebroadcast ?? null;
    let startPoint = song.startPoint ?? song.startSample ?? null;

    let animeType = song.animeType ?? song.songInfo?.animeType ?? "";
    let animeVintage = song.animeVintage ?? song.vintage ?? song.songInfo?.vintage ?? null;
    let animeTags = song.animeTags ?? song.tags ?? song.songInfo?.animeTags ?? [];
    let animeGenre = song.animeGenre ?? song.genre ?? song.songInfo?.animeGenre ?? [];

    let annId = song.annId ?? song.siteIds?.annId ?? song.songInfo?.siteIds?.annId ?? null;
    let malId = song.malId ?? song.linked_ids?.myanimelist ?? song.siteIds?.malId ?? song.songInfo?.siteIds?.malId ?? null;
    let kitsuId = song.kitsuId ?? song.linked_ids?.kitsu ?? song.siteIds?.kitsuId ?? song.songInfo?.siteIds?.kitsuId ?? null;
    let aniListId = song.aniListId ?? song.linked_ids?.anilist ?? song.siteIds?.aniListId ?? song.songInfo?.siteIds?.aniListId ?? null;
    let annSongId = song.annSongId ?? song.songInfo?.annSongId ?? null;
    let amqSongId = song.amqSongId ?? song.songInfo?.amqSongId ?? null;

    let audio = song.audio ?? song.videoUrl ?? song.urls?.catbox?.[0] ?? song.songInfo?.videoTargetMap?.catbox?.[0] ?? song.songInfo?.urlMap?.catbox?.[0] ?? song.LinkMp3 ?? "";
    let video480 = song.video480 ?? song.MQ ?? song.videoUrl ?? song.urls?.catbox?.[480] ?? song.songInfo?.videoTargetMap?.catbox?.[480] ?? song.songInfo?.urlMap?.catbox?.[480] ?? "";
    let video720 = song.video720 ?? song.HQ ?? song.videoUrl ?? song.urls?.catbox?.[720] ?? song.songInfo?.videoTargetMap?.catbox?.[720] ?? song.songInfo?.urlMap?.catbox?.[720] ?? song.LinkVideo ?? "";

    let correctGuess = song.correctGuess ?? null;
    let incorrectGuess = song.incorrectGuess ?? song.wrongGuess ?? null;
    
    if (correctGuess === null && typeof song.correct === "boolean") { // Joseph script check
        correctGuess = song.correct;
        incorrectGuess = !song.correct;
    }
    if (typeof animeVintage === "object" && animeVintage?.key && animeVintage?.data?.year) { // AMQ songinfo vintage is an object
        const season = animeVintage.key.split(".").at(-1);
        animeVintage = season[0].toUpperCase() + season.slice(1) + " " + animeVintage.data.year;
    }
    if (typeof songType === "string") { // Convert songtype string to amq integers
        songType = songType.trim().toUpperCase();
        if (songType.startsWith("O")) {
            songTypeNumber = parseInt(songType.match(/\d+/)?.[0]) || null;
            songType = 1;
        }
        else if (songType.startsWith("E")) {
            songTypeNumber = parseInt(songType.match(/\d+/)?.[0]) || null;
            songType = 2;
        }
        else if (songType.startsWith("I")) {
            songTypeNumber = null;
            songType = 3;
        }
    }

    animeRomajiName = cslText(animeRomajiName);
    animeEnglishName = cslText(animeEnglishName);
    songName = cslText(songName);
    songArtist = cslText(songArtist);
    songArranger = cslText(songArranger);
    songComposer = cslText(songComposer);
    animeType = cslText(animeType);
    animeVintage = typeof animeVintage === "string" ? animeVintage : null;
    altAnimeNames = [...new Set([...cslStrings(altAnimeNames), animeRomajiName, animeEnglishName].filter(Boolean))];
    altAnimeNamesAnswers = cslStrings(altAnimeNamesAnswers);
    animeTags = cslStrings(animeTags);
    animeGenre = cslStrings(animeGenre);
    audio = cslMedia(audio);
    video480 = cslMedia(video480);
    video720 = cslMedia(video720);
    songType = Number(songType);
    songTypeNumber = Number.isInteger(Number(songTypeNumber)) && Number(songTypeNumber) > 0 ? Number(songTypeNumber) : null;
    if (!(audio || video480 || video720) || ![1, 2, 3].includes(songType) || !altAnimeNames.length) return null;
    return {
        animeRomajiName,
        animeEnglishName,
        altAnimeNames,
        altAnimeNamesAnswers,
        songArtist,
        artistInfo,
        songArranger,
        arrangerInfo,
        songComposer,
        composerInfo,
        songName,
        songType,
        songTypeNumber,
        songDifficulty,
        animeType,
        animeVintage,
        annId: cslId(annId),
        malId: cslId(malId),
        kitsuId: cslId(kitsuId),
        aniListId: cslId(aniListId),
        animeTags,
        animeGenre,
        rebroadcast: rebroadcast === true,
        dub: dub === true,
        startPoint,
        annSongId: cslId(annSongId),
        amqSongId: cslId(amqSongId),
        audio,
        video480,
        video720,
        correctGuess: typeof correctGuess === "boolean" ? correctGuess : null,
        incorrectGuess: typeof incorrectGuess === "boolean" ? incorrectGuess : null
    };
}


// AMQ presentation and room integration

// Dispatch synthetic AMQ events with the same isolation as the native socket.
function fireListener(type, data) {
    for (const listener of [...(socket.listners[type] || [])]) {
        try {
            listener.fire(data);
        }
        catch (error) {
            console.error(`CSL: ${type} listener failed`, error);
        }
    }
}

// Escape untrusted warning details before AMQ inserts them into system-chat HTML.
function sendSystemMessage(message) {
    if (gameChat.open) gameChat.systemMessage(escapeHtml(`CSL: ${message}`));
    else console.warn(`CSL: ${message}`);
}

// Protect native HTML renderers while leaving stored names and answers untouched.
function installCslTextRendering() {
    const buildArtist = ArtistHover.prototype.build;
    // Escape the hover heading without changing the raw name used for artist searches.
    ArtistHover.prototype.build = function (artist, delay, searchCallback) {
        const search = searchCallback ? () => searchCallback(artist.name) : searchCallback;
        return buildArtist.call(this, { ...artist, name: escapeHtml(cslText(artist.name)) }, delay, search);
    };
    const buildArtistMap = ArtistHoverMapSetup.prototype.build;
    // Escape the loading heading before native artist information has arrived.
    ArtistHoverMapSetup.prototype.build = function (artist, delay, searchCallback) {
        return buildArtistMap.call(this, { ...artist, name: escapeHtml(cslText(artist.name)) }, delay, searchCallback);
    };
    // Create member labels as text and retain raw metadata for their nested hovers.
    const createMemberEntry = function (member, typeLetter, delay, searchCallback) {
        const typeKey = typeLetter === "G" ? "artist_hover.group.shorthand" : "artist_hover.artist.shorthand";
        const entry = $(format(this.MEMBER_ENTRY, typeKey, ""));
        const trigger = entry.find(".aicMemberName").text(cslText(member.name));
        if (this instanceof ArtistHoverMapSetup) {
            new ArtistHoverMapSetup(member, trigger, delay, this.$body, searchCallback, this.artistMap, this.groupMap);
        }
        else new ArtistHover(member, trigger, delay, this.$body, searchCallback);
        return entry;
    };
    ArtistHover.prototype.createMemberEntry = createMemberEntry;
    ArtistHoverMapSetup.prototype.createMemberEntry = createMemberEntry;
    const historyNames = SongHistoryInfoWindow.prototype.createAnimeNameList;
    // Escape history labels only at the native HTML-list rendering boundary.
    SongHistoryInfoWindow.prototype.createAnimeNameList = function (altNames, altAnswers) {
        return historyNames.call(this, altNames, altAnswers).map(escapeHtml);
    };
}

// Translate canonical session records into the existing AMQ quiz presentation.
class CslAmqAdapter {
    // Retain the real server lobby independently of AMQ's temporary quiz view.
    constructor(controller) {
        this.controller = controller;
        this.serverPlayers = new Map();
        this.presentPlayers = new Map();
        this.prepared = new Set();
    }

    // Copy lobby players before the native view transition removes them.
    capture() {
        this.originalSettings = cslClone(lobby.settings);
        this.originalSolo = lobby.soloMode;
        this.originalSpectator = lobby.isSpectator;
        this.serverPlayers = new Map(Object.values(lobby.players).map(player => [player.name, {
            name: player.name, gamePlayerId: player.gamePlayerId, level: player.level,
            avatar: cslClone(player.avatarInfo), ready: player.ready, inGame: true,
            teamNumber: player.teamNumber, multipleChoice: false
        }]));
        this.presentPlayers = new Map(this.serverPlayers);
        this.prepared.clear();
    }

    // Build compact group and position maps only for avatars present on this client.
    layout(session) {
        const ordered = cslStandings(session.players, session.config.scoreType)
            .map(rank => session.players.find(player => player.id === rank.id))
            .filter(player => quiz.players[player.id]);
        const groups = {};
        ordered.forEach((player, index) => {
            const group = Math.floor(index / 8) + 1;
            (groups[group] ||= []).push(player.id);
        });
        return { ordered, groups };
    }

    // Initialize the native quiz with supported scoring and independent settings.
    start(session) {
        const settings = cslClone(this.originalSettings);
        settings.gameMode = this.originalSolo ? "Solo" : "Standard";
        settings.scoreType = session.config.scoreType;
        settings.lives = session.config.lives;
        settings.teamSize = 1;
        settings.showSelection = quiz.SHOW_SELECTION_IDS.AUTO;
        settings.numberOfSongs = session.config.totalSongs;
        settings.modifiers.fullSongRange = session.config.fullSongRange;
        settings.modifiers.skipGuessing = true;
        settings.modifiers.skipReplay = true;
        const players = session.players.flatMap((player, index) => {
            const info = this.presentPlayers.get(player.name);
            if (!info) return [];
            return [{
                name: player.name, level: info.level, gamePlayerId: player.id,
                avatarInfo: cslClone(info.avatar), host: player.name === session.host,
                score: player.score, correctGuesses: player.correctGuesses, inGame: player.connected,
                pose: 1, position: Math.floor(index / 8) + 1, positionSlot: index % 8,
                teamCaptain: null, teamNumber: null, teamPlayer: null
            }];
        });
        const groups = {};
        players.forEach((player, index) => (groups[Math.floor(index / 8) + 1] ||= []).push(player.gamePlayerId));
        quiz.cslActive = true;
        const originalLobbySettings = lobby.settings;
        lobby.settings = settings;
        this.controller.synthetic = true;
        try {
            fireListener("Game Starting", {
                gameMode: settings.gameMode, showSelection: 1, groupSlotMap: groups, players,
                multipleChoice: false,
                quizDescription: {
                    quizId: session.config.quizId,
                    startTime: session.config.startTime,
                    roomName: this.originalSettings.roomName || "Custom Song List"
                }
            });
        }
        finally {
            lobby.settings = originalLobbySettings;
            this.controller.synthetic = false;
        }
        quiz.fullSongRange = session.config.fullSongRange;
    }

    // Load the next AMQ player using a unique session-and-round media identity.
    prepare(session, round, media) {
        if (this.prepared.has(round)) return;
        this.prepared.add(round);
        const videoInfo = createCslVideoInfo(media.audio, media.video480, media.video720);
        videoInfo.id = `${session.id}:${round}`;
        fireListener("quiz next video info", {
            playLength: session.config.guessTime, playbackSpeed: 1,
            startPoint: media.sample, videoInfo, forceBuffering: this.prepared.size > 1
        });
        if (this.prepared.size === 1) fireListener("quiz ready", { numberOfSongs: session.config.totalSongs });
    }

    // Show normal buffering feedback while the host's loading deadline runs.
    buffer(session) {
        fireListener("quiz waiting buffering", { firstSong: session.round === 1 });
    }

    // Render a normal guess phase using the canonical session settings.
    play(session) {
        quiz.answerInput.active = !quiz.isSpectator;
        fireListener("play next song", {
            time: session.config.guessTime, extraGuessTime: session.config.extraGuessTime,
            songNumber: session.round, progressBarState: { length: session.config.guessTime, played: 0 },
            onLastSong: session.round === session.config.totalSongs, multipleChoiceNames: null
        });
    }

    // Let AMQ perform normal auto-submit and input disabling.
    lock() {
        fireListener("guess phase over");
    }

    // Translate one normalized song consistently for solo and multiplayer.
    songInfo(song) {
        return {
            animeNames: { english: song.animeEnglishName, romaji: song.animeRomajiName },
            artist: song.songArtist, artistInfo: song.artistInfo || { name: song.songArtist },
            arrangerInfo: song.arrangerInfo, composerInfo: song.composerInfo, songName: song.songName,
            videoTargetMap: { catbox: createCatboxLinkObject(song.audio, song.video480, song.video720) },
            type: song.songType, typeNumber: song.songTypeNumber, annId: song.annId, annSongId: song.annSongId,
            highRisk: 0,
            animeScore: null,
            animeType: escapeHtml(song.animeType),
            vintage: formatAmqVintage(song.animeVintage) || { key: "avatar_lore.unknown", data: {} },
            animeDifficulty: song.songDifficulty, animeTags: song.animeTags.map(escapeHtml), animeGenre: song.animeGenre.map(escapeHtml),
            altAnimeNames: song.altAnimeNames, altAnimeNamesAnswers: song.altAnimeNamesAnswers,
            rebroadcast: song.rebroadcast, dub: song.dub,
            siteIds: { annId: song.annId, malId: song.malId, kitsuId: song.kitsuId, aniListId: song.aniListId }
        };
    }

    // Build the native result and scoreboard fields from one shared player model.
    playerResults(session) {
        const { ordered, groups } = this.layout(session);
        const players = ordered.map((player, index) => {
            let pose = 6;
            if (player.correct) pose = 5;
            else if (player.answer) pose = 4;
            return {
                gamePlayerId: player.id,
                pose,
                correct: Boolean(player.correct),
                score: player.score,
                reviveScore: player.reviveScore,
                correctGuesses: player.correctGuesses,
                level: quiz.players[player.id].level,
                answerTimeing: player.time ?? session.config.guessTime + session.config.extraGuessTime,
                listStatus: null,
                showScore: null,
                position: Math.floor(index / 8) + 1,
                positionSlot: index % 8
            };
        });
        return { groups, players };
    }

    // Reveal answers and metadata atomically through the existing AMQ event API.
    result(session, result) {
        const native = this.playerResults(session);
        fireListener("player answers", {
            answers: native.players.map(player => ({
                gamePlayerId: player.gamePlayerId,
                pose: player.pose, answer: session.players.find(entry => entry.id === player.gamePlayerId).answer
            })), progressBarState: null
        });
        fireListener("answer results", {
            players: native.players, songInfo: this.songInfo(result.song),
            groupMap: native.groups,
            progressBarState: {
                length: session.config.fastSkip ? CSL.fastRevealTime / 1000 : CSL.revealTime / 1000,
                played: 0
            },
            watched: false
        });
    }

    // Restore scores without inventing missing round history or replaying a song.
    restore(session) {
        const native = this.playerResults(session);
        for (const player of session.players) {
            if (quiz.players[player.id]) quiz.players[player.id].state = { score: player.score, reviveScore: player.reviveScore, inGame: player.connected };
        }
        quiz.scoreboard.updateStandings(native.players, native.groups);
        quiz.infoContainer.setCurrentSongCount(session.round);
        quiz.answerInput.active = false;
        fireListener("quiz overlay message", "Waiting for Next Song");
    }

    // Present the same final ranking on every participant's client.
    finish(session, ranks) {
        fireListener("quiz end result", { resultStates: ranks.map(rank => ({ gamePlayerId: rank.id, pose: 1, endPosition: rank.place })), progressBarState: null });
    }

    // Reconstruct the real server lobby using server membership and original IDs.
    end() {
        const players = [...this.serverPlayers.values()].map(player => ({ ...player, ready: true, teamNumber: null, multipleChoice: false }));
        const spectators = gameChat.spectators.map(player => ({ name: player.name, gamePlayerId: null }));
        const ownIsSpectator = !players.some(player => player.name === selfName);
        quiz.cslActive = false;
        quiz.isSpectator = ownIsSpectator;
        fireListener("quiz over", {
            spectators, inLobby: true, settings: this.originalSettings, soloMode: this.originalSolo,
            inQueue: [], hostName: lobby.hostName, gameId: lobby.gameId, players, numberOfTeams: 0, teamFullMap: {}, songPool: {}
        });
    }
}

// Allow CSL only in normal rooms, with native quizzes excluded from discovery.
function cslSupportedRoom() {
    if (quiz.inQuiz && (!quiz.cslActive || !["Solo", "Standard"].includes(quiz.gameMode))) return false;
    return (lobby.inLobby || quiz.inQuiz) && ["Solo", "Multiplayer"].includes(lobby.settings.gameMode);
}

// Integrate the editor, chat transport, and AMQ presentation without global quiz state.
class CslController {
    // Keep long-lived integration resources separate from each disposable session.
    constructor() {
        this.roomScope = new CslScope();
        this.roomId = lobby.gameId;
        this.session = null;
        this.discovery = null;
        this.adapter = new CslAmqAdapter(this);
        this.ended = new Set();
        this.syncNonce = "";
        this.lastSyncSent = -Infinity;
        this.joiningAsPlayer = false;
        this.announcementPending = false;
        this.syncRequests = new Map();
        this.lobbyCommandIds = new Set();
    }

    // Bind a game listener once for the userscript lifetime.
    listen(type, callback) {
        new Listener(type, callback).bindListener();
    }

    // Install chat listeners and narrowly scoped native controls.
    install() {
        installCslTextRendering();
        this.transport = new CslTransport({
            name: selfName,
            send: (frame, envelope) => this.transmit(frame, envelope), canSend: envelope => this.canSend(envelope),
            receive: (envelope, value) => this.receive(envelope, value), allow: envelope => this.allow(envelope), warning: sendSystemMessage
        });
        this.installRoomListeners();
        this.installAutocompleteListeners();
        this.installNativeControls();
    }

    // Keep server membership and chat events separate from simulated quiz state.
    installRoomListeners() {
        this.roomId = lobby.gameId;
        this.listen("game chat update", data => data.messages.forEach(message => this.chat(message)));
        this.listen("Game Chat Message", message => this.chat(message));
        for (const event of ["Join Game", "Spectate Game", "Host Game", "Host Custom Game"]) this.listen(event, data => {
            if (data.error) return;
            this.dispose();
            this.roomId = data.gameId;
        });
        this.listen("quiz over", data => {
            this.roomId = data.gameId;
        });
        this.listen("Game Starting", () => { if (!this.synthetic) this.dispose(); });
        this.listen("Host Promotion", data => {
            this.discovery = null;
            if (!this.session) return;
            lobby.hostName = data.newHost;
            sendSystemMessage("Host changed; ending custom quiz");
            this.roomScope.after(0, () => this.end());
        });
        this.listen("Player Left", data => {
            if (this.session && data.newHost) lobby.hostName = data.newHost;
            this.left(data.player.name);
        });
        this.listen("Spectator Left", data => {
            if (this.session && data.newHost) lobby.hostName = data.newHost;
            this.left(data.spectator);
        });
        for (const event of ["New Player", "Spectator Change To Player"]) this.listen(event, data => {
            this.announce();
            if (data.name === selfName) {
                this.joiningAsPlayer = false;
                this.roomScope.after(4200, () => this.sync());
            }
            if (!this.session) return;
            this.adapter.serverPlayers.set(data.name, cslClone(data));
            this.adapter.presentPlayers.set(data.name, cslClone(data));
            const player = this.session.players.find(player => player.name === data.name);
            if (player && quiz.players[player.id]) fireListener("Rejoining Player", { name: data.name, gamePlayerId: player.id });
            if (!player && this.session.isHost) lobby.changeToSpectator(data.name);
        });
        this.listen("New Spectator", () => this.announce());
        this.listen("Player Changed To Spectator", data => {
            if (!this.session) return;
            const name = data.spectatorDescription.name;
            this.adapter.serverPlayers.delete(name);
            this.session.disconnect(name);
            const player = this.session.players.find(player => player.name === name);
            if (player && quiz.players[player.id]) {
                quiz.players[player.id].avatarDisabled = true;
                quiz.players[player.id].inGame = false;
            }
            if (name === selfName) {
                quiz.isSpectator = true;
                quiz.answerInput.active = false;
                quiz.answerInput.disable();
            }
        });
        this.listen("game closed", data => {
            const active = Boolean(this.session);
            this.dispose();
            if (!active) return;
            messageDisplayer.displayMessage("Room Closed", data.reason);
            lobby.leave({ supressServerMsg: true });
        });
        this.listen("Room Settings Changed", data => {
            if (this.session) Object.assign(this.adapter.originalSettings, cslClone(data.changes));
        });
    }

    // Maintain answer-editor suggestions alongside AMQ's autocomplete updates.
    installAutocompleteListeners() {
        this.listen("get all song names", data => {
            animeListLower = new Set(data.names.map(name => name.toLowerCase()));
            rebuildCslAutocomplete(data.names);
        });
        this.listen("update all song names", data => {
            for (const name of data.deleted) animeListLower.delete(name.toLowerCase());
            for (const name of data.new) animeListLower.add(name.toLowerCase());
            if (!autocompleteInput || !(data.deleted.length || data.new.length)) return;
            const remainingNames = autocompleteInput.options.list.filter(name => !data.deleted.includes(name));
            rebuildCslAutocomplete(remainingNames.concat(data.new));
        });
    }

    // Redirect native controls only while a custom quiz owns the presentation.
    installNativeControls() {
        const controller = this;
        const playerLeft = quiz._playerLeaveListner.fire;
        // Translate changed server IDs only for AMQ's own fixed quiz roster listener.
        quiz._playerLeaveListner.fire = function (data) {
            if (!controller.session) return playerLeft.call(this, data);
            const player = controller.session.players.find(player => player.name === data.player.name);
            if (player && quiz.players[player.id]) return playerLeft.call(this, { ...data, player: { ...data.player, gamePlayerId: player.id } });
        };
        const submit = QuizTypeAnswerInputController.prototype.submitAnswer;
        // Redirect only custom-quiz submissions and preserve normal AMQ behavior.
        QuizTypeAnswerInputController.prototype.submitAnswer = function (answer) {
            const session = controller.session;
            if (!session) return submit.apply(this, arguments);
            session.submit(answer).then(sent => {
                if (!sent || controller.session !== session) return;
                this.skipController.highlight = true;
                fireListener("quiz answer", { answer, success: true });
                if (options.autoVoteSkipGuess) this.skipController.voteSkip();
            }).catch(error => sendSystemMessage(error.message));
        };
        const skip = quiz.skipController.sendSkipVote;
        // Send phase-specific votes without polling AMQ's private toggle state.
        quiz.skipController.sendSkipVote = function () {
            if (!controller.session) return skip.apply(this, arguments);
            clearTimeout(this.autoVoteTimeout);
            controller.session.vote();
        };
        const videoReady = quiz.videoReady;
        // Associate native readiness with its exact session-and-round video ID.
        quiz.videoReady = function (id) {
            if (!controller.session) return videoReady.apply(this, arguments);
            const round = controller.mediaRound(id);
            if (round) controller.session.ready(round, true);
        };
        const videoError = MoeVideoPlayer.prototype.handleError;
        // Exhaust alternate media before reporting a non-blocking load failure.
        MoeVideoPlayer.prototype.handleError = function () {
            if (!controller.session) return videoError.apply(this, arguments);
            const round = controller.mediaRound(this.songId);
            if (!round) return;
            this.tryNextVideo();
            if (!Object.keys(this.videoMap).length) controller.session.ready(round, false);
        };
        const returnLobby = quiz.startReturnLobbyVote;
        // Keep normal lobby voting outside custom quizzes.
        quiz.startReturnLobbyVote = function () {
            if (!controller.session) return returnLobby.apply(this, arguments);
            controller.stop();
        };
        const closeView = quiz.closeView;
        // Dispose only when the quiz actually closes, allowing canceled Leave dialogs.
        quiz.closeView = function () {
            controller.dispose();
            return closeView.apply(this, arguments);
        };
        const closeLobby = lobby.closeView;
        // Clear passive discovery and queued chat when leaving the real room view.
        lobby.closeView = function () {
            if (!controller.synthetic) controller.dispose();
            return closeLobby.apply(this, arguments);
        };
        // Capture custom pause clicks without removing native or third-party handlers.
        quiz.pauseButton.$button[0].addEventListener("click", event => {
            if (!this.session) return;
            event.stopImmediatePropagation();
            event.preventDefault();
            this.session.pause();
        }, true);
    }

    // Identify only a live session announced by the current room's current host.
    sessionId() {
        if (this.roomId !== lobby.gameId || !cslSupportedRoom()) return "";
        if (this.session) {
            if (this.session.scope.closed || this.session.host !== lobby.hostName) return "";
            return this.session.id;
        }
        const discovery = this.discovery;
        if (!discovery || discovery.host !== lobby.hostName || this.ended.has(discovery.id)) return "";
        return cslNow() - discovery.time <= CSL.cacheTime ? discovery.id : "";
    }

    // Coalesce joins into one delayed announcement, only while hosting multiplayer CSL.
    announce() {
        if (!this.session?.isHost || this.session.solo || this.announcementPending) return;
        this.announcementPending = true;
        this.roomScope.after(CSL.announcementDelay, () => {
            this.announcementPending = false;
            const session = this.session;
            if (!session?.isHost || session.solo || session.phase === "stopping") return;
            session.send(CSL_MESSAGE.ANNOUNCE, { q: session.applied, phase: session.phase }, session.round, 0, () => { }, "announcement");
        });
    }

    // Permit public game traffic only for active CSL or its recovery handshake.
    canSend({ session, type }) {
        const active = this.sessionId();
        if (!active || lobby.soloMode || session !== active) return false;
        return Boolean(this.session) || [CSL_MESSAGE.SYNC, CSL_MESSAGE.REPAIR].includes(type);
    }

    // Recheck room, mode, and session immediately before writing to public chat.
    transmit(frame, envelope) {
        if (!this.canSend(envelope)) return false;
        socket.sendCommand({ type: "lobby", command: "game chat message", data: { msg: frame, teamMessage: false } });
        return true;
    }

    // Resolve round IDs only for the active session's own media.
    mediaRound(id) {
        const prefix = `${this.session.id}:`;
        if (typeof id !== "string" || !id.startsWith(prefix)) return null;
        const round = Number(id.slice(prefix.length));
        return Number.isInteger(round) ? round : null;
    }

    // Limit parsing to current-room senders and allowed directions of authority.
    allow({ session, sender, type }) {
        if (this.roomId !== lobby.gameId || !cslSupportedRoom()) return false;
        const roomSender = sender === selfName || sender === lobby.hostName
            || Object.values(lobby.players).some(player => player.name === sender)
            || this.session?.players.some(player => player.name === sender)
            || gameChat.spectators.some(player => player.name === sender);
        if (!roomSender) return false;
        if (type === CSL_MESSAGE.SYNC) return this.session?.isHost && session === this.session.id;
        if (!this.session && lobby.inLobby && sender === lobby.hostName && !this.ended.has(session)) {
            const discoveryTypes = [
                CSL_MESSAGE.ANNOUNCE, CSL_MESSAGE.PREPARE, CSL_MESSAGE.PLAY, CSL_MESSAGE.LOCK,
                CSL_MESSAGE.COLLECT, CSL_MESSAGE.RESULT, CSL_MESSAGE.FINAL, CSL_MESSAGE.PAUSE, CSL_MESSAGE.CONNECTION
            ];
            if (discoveryTypes.includes(type)) return true;
        }
        if (type === CSL_MESSAGE.SNAPSHOT) return session === this.sessionId() && sender === lobby.hostName && Boolean(this.syncNonce);
        if (type === CSL_MESSAGE.BEGIN) return !this.session && lobby.inLobby && sender === lobby.hostName && !this.ended.has(session);
        if (!this.session && [CSL_MESSAGE.REPAIR, CSL_MESSAGE.STOP].includes(type)) return session === this.sessionId() && sender === lobby.hostName;
        if (session !== this.session?.id) return false;
        const hostTypes = [
            CSL_MESSAGE.PREPARE, CSL_MESSAGE.PLAY, CSL_MESSAGE.LOCK, CSL_MESSAGE.COLLECT,
            CSL_MESSAGE.RESULT, CSL_MESSAGE.FINAL, CSL_MESSAGE.PAUSE, CSL_MESSAGE.CONNECTION,
            CSL_MESSAGE.STOP, CSL_MESSAGE.ANNOUNCE, CSL_MESSAGE.COMMIT_RECEIPT, CSL_MESSAGE.REVEAL_RECEIPT
        ];
        if (hostTypes.includes(type)) return sender === this.session.host;
        return [CSL_MESSAGE.COMMIT, CSL_MESSAGE.REVEAL, CSL_MESSAGE.READY, CSL_MESSAGE.SKIP, CSL_MESSAGE.REPAIR].includes(type);
    }

    // Consume protocol traffic independently from its optional chat visibility.
    chat(message) {
        const lobbyCommand = Object.values(CSL_LOBBY_COMMAND).find(entry => entry.command === message.message);
        if (lobbyCommand) {
            if (!this.lobbyCommandsAllowed() || message.sender !== lobby.hostName || this.lobbyCommandIds.has(message.messageId)) return;
            this.lobbyCommandIds.add(message.messageId);
            if (this.lobbyCommandIds.size > 64) this.lobbyCommandIds.delete(this.lobbyCommandIds.values().next().value);
            socket.sendCommand({ type: "lobby", command: "game chat message", data: { msg: lobbyCommand.reply(), teamMessage: false } });
        }
        else {
            if (typeof message.message !== "string" || !message.message.startsWith(CSL.prefix)) return;
            this.transport.receive(message.message, message.sender);
        }
        if (!showCSLMessages) this.roomScope.after(0, () => {
            const entry = $("#gcPlayerMessage-" + message.messageId);
            if (entry.length && entry.find(".gcMessage").text() === message.message) {
                entry.remove();
                gameChat.currentMessageCount = Math.max(0, gameChat.currentMessageCount - 1);
                gameChat.$SCROLLABLE_CONTAINERS.perfectScrollbar("update");
            }
        });
    }

    // Construct session hooks with all AMQ-specific effects kept in the adapter.
    hooks() {
        return {
            start: session => this.adapter.start(session),
            prepare: (session, round, media) => this.adapter.prepare(session, round, media),
            buffer: session => this.adapter.buffer(session),
            play: session => this.adapter.play(session),
            lock: session => this.adapter.lock(session),
            extra: () => fireListener("extra guess time"),
            result: (session, result) => this.adapter.result(session, result),
            restore: session => this.adapter.restore(session),
            finish: (session, ranks) => this.adapter.finish(session, ranks),
            pause: session => fireListener(session.paused ? "quiz pause triggered" : "quiz unpause triggered", { playerName: session.host }),
            answered: (session, id, time) => fireListener("player answered", [{ answerTime: time, gamePlayerIds: [id] }]),
            sync: () => this.sync(),
            warning: sendSystemMessage,
            end: () => this.end()
        };
    }

    // Select in-memory delivery for solo while preserving identical session rules.
    emit(session, round, type, value, priority, done, replaceKey) {
        if (this.adapter.originalSolo) {
            this.session.receive({ session, round, type, sender: selfName }, cslClone(value));
            done();
            return;
        }
        this.transport.send(session, round, type, value, priority, done, replaceKey);
    }

    // Start a fixed host plan without sharing the editable song array.
    start(config, plan) {
        if (this.session) throw new Error("A custom quiz is already running");
        if (!cslSupportedRoom() || !lobby.inLobby || !lobby.isHost) throw new Error("Use a normal solo or multiplayer lobby as host");
        if (!cslValidConfig(config)) throw new Error("Invalid quiz settings");
        this.adapter.capture();
        const roster = [...this.adapter.serverPlayers.values()].map(player => ({ id: player.gamePlayerId, name: player.name }));
        if (roster.length > CSL.maxPlayers) throw new Error(`CSL supports at most ${CSL.maxPlayers} players`);
        if (!this.validRoster(roster)) throw new Error("Invalid player roster");
        this.session = new CslSession({
            id: cslSessionId(), name: selfName, host: selfName, config, roster, plan, solo: this.adapter.originalSolo,
            emit: (...args) => this.emit(...args), hooks: this.hooks()
        });
        this.session.start(true);
    }

    // Validate lobby announcements and nonce-bound recovery before creating a session.
    receive(envelope, value) {
        if (!this.allow(envelope)) return;
        value = cslUnpack(envelope.type, value);
        if (!value || typeof value !== "object") return;
        const { type, sender, session, round } = envelope;
        if (type === CSL_MESSAGE.ANNOUNCE && !this.validDiscovery(envelope, value)) return;
        if (!this.session && this.validDiscovery(envelope, value)) {
            if (this.discovery?.id !== session || this.discovery.host !== sender) {
                this.transport.reset();
                this.syncNonce = "";
                this.lastSyncSent = -Infinity;
            }
            this.discovery = { id: session, host: sender, time: cslNow() };
            this.sync();
            return;
        }
        if (type === CSL_MESSAGE.STOP && !this.session) {
            if (Number.isSafeInteger(value.q) && value.q >= 0) {
                this.ended.add(session);
                if (this.ended.size > 64) this.ended.delete(this.ended.values().next().value);
                this.dispose();
            }
            return;
        }
        if (type === CSL_MESSAGE.SYNC) {
            if (this.session?.isHost && /^[a-f0-9]{12}$/.test(value.nonce) && cslNow() - (this.syncRequests.get(sender) ?? -Infinity) > 4000) {
                this.syncRequests.set(sender, cslNow());
                this.session.snapshot(sender, value.nonce);
            }
            return;
        }
        if (type === CSL_MESSAGE.BEGIN) {
            if (!cslValidConfig(value.config) || !this.validRoster(value.roster)) return;
            const allPlayersPresent = value.roster.every(player => {
                return Object.values(lobby.players).some(local => local.name === player.name);
            });
            if (!allPlayersPresent) return;
            this.adapter.capture();
            this.discovery = null;
            this.syncNonce = "";
            this.transport.cancel(session);
            this.session = new CslSession({
                id: session, name: selfName, host: sender, config: value.config, roster: value.roster,
                emit: (...args) => this.emit(...args), hooks: this.hooks()
            });
            this.session.start();
            return;
        }
        if (type === CSL_MESSAGE.SNAPSHOT) {
            if (this.validSnapshot(value, round)) this.restoreSnapshot(envelope, value);
            return;
        }
        this.session?.receive(envelope, value);
    }

    // Reject ambiguous participant identities before they enter a session.
    validRoster(roster) {
        if (!Array.isArray(roster) || roster.length === 0 || roster.length > CSL.maxPlayers) return false;
        if (new Set(roster.map(player => player.id)).size !== roster.length) return false;
        if (new Set(roster.map(player => player.name)).size !== roster.length) return false;
        return roster.every(player => {
            if (!Number.isSafeInteger(player.id) || player.id < 0) return false;
            return typeof player.name === "string" && player.name.length > 0 && player.name.length <= 64;
        });
    }

    // Validate recovery state completely before changing lobby roles or quiz state.
    validSnapshot(value, round) {
        if (value.to !== selfName || value.nonce !== this.syncNonce) return false;
        if (!cslValidConfig(value.config) || !this.validRoster(value.players)) return false;
        if (!Number.isSafeInteger(value.q) || value.q < 0) return false;
        if (!Number.isInteger(round) || round < 0 || round > value.config.totalSongs) return false;
        if (!Array.isArray(value.media) || value.media.length > 2) return false;
        if (!value.media.every(entry => Array.isArray(entry) && Number.isInteger(entry[0]) && cslValidMedia(entry[1]))) return false;
        if (!cslValidPlayerState(value.players, value.config) || typeof value.paused !== "boolean") return false;
        if (!["starting", "buffering", "guessing", "locking", "collecting", "revealing", "finished"].includes(value.phase)) return false;
        if (value.phase === "collecting" && !cslValidControl(CSL_MESSAGE.COLLECT, value, value.players, value.config)) return false;
        if (value.result !== undefined) {
            if (value.phase !== "revealing") return false;
            const result = { ...value.result, players: value.players };
            if (!cslValidControl(CSL_MESSAGE.RESULT, result, value.players, value.config)) return false;
        }
        if (value.ranks !== null && !cslValidControl(CSL_MESSAGE.FINAL, { ranks: value.ranks }, value.players, value.config)) return false;
        return true;
    }

    // Resume a validated snapshot, restoring a returning player's lobby role first.
    restoreSnapshot({ session, sender, round }, value) {
        if (this.session && this.session.id !== session) return;
        if (!this.session && lobby.isSpectator && value.players.some(player => player.name === selfName)) {
            if (!this.joiningAsPlayer) {
                this.joiningAsPlayer = true;
                socket.sendCommand({ type: "lobby", command: "change to player" });
            }
            return;
        }
        if (!this.session) {
            this.adapter.capture();
            this.session = new CslSession({
                id: session, name: selfName, host: sender, config: value.config, roster: value.players,
                emit: (...args) => this.emit(...args), hooks: this.hooks()
            });
            this.session.start();
        }
        this.syncNonce = "";
        this.discovery = null;
        this.session.restore(value, round);
    }

    // Recognize host gameplay packets before requesting a fully validated snapshot.
    validDiscovery({ type, round }, value) {
        if (!Number.isInteger(round) || round < 0 || round > 10000) return false;
        if (type === CSL_MESSAGE.PREPARE) return round > 0 && cslValidMedia(value);
        if (!Number.isSafeInteger(value.q) || value.q < 0) return false;
        if (type === CSL_MESSAGE.ANNOUNCE) return ["starting", "buffering", "guessing", "locking", "collecting", "revealing", "finished"].includes(value.phase);
        if (round === 0 || value.q === 0) return false;
        if ([CSL_MESSAGE.PLAY, CSL_MESSAGE.LOCK].includes(type)) return true;
        if (type === CSL_MESSAGE.COLLECT) {
            if (!Array.isArray(value.commits) || value.commits.length > CSL.maxPlayers) return false;
            return value.commits.every(entry => {
                if (!Array.isArray(entry) || typeof entry[0] !== "string") return false;
                return Number.isInteger(entry[1]) && entry[1] > 0;
            });
        }
        if (type === CSL_MESSAGE.RESULT) return this.validRoster(value.players) && typeof value.finished === "boolean" && cslValidSong(value.song);
        if (type === CSL_MESSAGE.FINAL) {
            if (!Array.isArray(value.ranks) || value.ranks.length === 0 || value.ranks.length > CSL.maxPlayers) return false;
            return value.ranks.every(rank => {
                if (!Number.isSafeInteger(rank.id) || rank.id < 0) return false;
                return Number.isInteger(rank.place) && rank.place > 0 && rank.place <= value.ranks.length;
            });
        }
        if (type === CSL_MESSAGE.PAUSE) return typeof value.paused === "boolean";
        if (type !== CSL_MESSAGE.CONNECTION) return false;
        return typeof value.name === "string" && value.name.length > 0 && value.name.length <= 64
            && typeof value.connected === "boolean";
    }

    // Request fresh state with a nonce that cannot be satisfied by chat history.
    sync() {
        const session = this.sessionId();
        if (!session || this.session?.isHost || lobby.soloMode || cslNow() - this.lastSyncSent < 4000) return;
        this.lastSyncSent = cslNow();
        this.syncNonce ||= cslRandom();
        this.transport.send(session, 0, CSL_MESSAGE.SYNC, { nonce: this.syncNonce }, 1, () => { }, "sync");
    }

    // Use AMQ's current lobby state for manual prompts, independently of CSL tracking.
    lobbyCommandsAllowed() {
        return lobby.inLobby && ["Solo", "Multiplayer"].includes(lobby.settings.gameMode);
    }

    // Broadcast one host request; the host replies through the same chat listener.
    promptLobby(entry) {
        if (!Object.values(CSL_LOBBY_COMMAND).includes(entry)) return;
        if (!this.lobbyCommandsAllowed() || !lobby.isHost) return sendSystemMessage("Use these buttons as host in a normal solo or multiplayer lobby");
        socket.sendCommand({ type: "lobby", command: "game chat message", data: { msg: entry.command, teamMessage: false } });
    }

    // Track actual departures separately from custom quiz score/player identities.
    left(name) {
        if (!this.session) return;
        this.syncRequests.delete(name);
        this.adapter.serverPlayers.delete(name);
        if (name === this.session.host) {
            sendSystemMessage("Host left; ending custom quiz");
            this.roomScope.after(0, () => this.end());
        }
        else this.session.disconnect(name);
    }

    // Route the existing stop hotkey and lobby control through host authority.
    stop() {
        if (this.session?.isHost) this.transport.cancel(this.session.id);
        this.session?.stop();
    }

    // Retire a completed or aborted session before returning to the real lobby.
    end() {
        if (!this.session) return;
        this.ended.add(this.session.id);
        if (this.ended.size > 64) this.ended.delete(this.ended.values().next().value);
        this.dispose();
        this.adapter.end();
    }

    // Release local state while allowing rejoining a session that is still running.
    dispose() {
        this.roomScope.close();
        this.roomScope = new CslScope();
        this.transport.reset();
        this.discovery = null;
        this.syncNonce = "";
        this.lastSyncSent = -Infinity;
        this.joiningAsPlayer = false;
        this.announcementPending = false;
        this.syncRequests.clear();
        this.lobbyCommandIds.clear();
        if (!this.session) return;
        this.session.close();
        this.session = null;
        quiz.cslActive = false;
    }
}


// Editor state and initialization

const saveData = validateLocalStorage("customSongListGame");
const apiBase = "https://anisongdb.com/api/";
const hostDict = { 1: "eudist.animemusicquiz.com", 2: "nawdist.animemusicquiz.com", 3: "naedist.animemusicquiz.com" };
let CSLButtonCSS = saveData.CSLButtonCSS || "calc(25% - 250px)";
let showCSLMessages = saveData.showCSLMessages ?? true;
const savedAnswerEntries = Object.entries(saveData.replacedAnswers || {})
    .filter(([, value]) => typeof value === "string");
let replacedAnswers = Object.assign(Object.create(null), Object.fromEntries(savedAnswerEntries));
let malClientId = saveData.malClientId ?? "";
let debug = Boolean(saveData.debug);
let songListTableView = 0; //0: song + artist, 1: anime + song type + vintage, 2: video/audio links
let songListTableSort = { mode: "", ascending: true } //modes: songName, artist, difficulty, anime, songType, vintage, mp3, 480, 720
let songList = [];
let mergedSongList = [];
let importedSongList = [];
let songOrderType = "random";
let startPointRange = [0, 100];
let difficultyRange = [0, 100];
let fileHostOverride = 0;
let animeListLower = new Set(); //store lowercase version for faster compare speed
let autocompleteInput;
let importRunning = false;
let hotKeys = {
    cslgWindow: loadHotkey("cslgWindow"),
    start: loadHotkey("start"),
    stop: loadHotkey("stop"),
    mergeAll: loadHotkey("mergeAll"),
    clearSongList: loadHotkey("clearSongList"),
    transferMerged: loadHotkey("transferMerged"),
    clearMerged: loadHotkey("clearMerged"),
    downloadMerged: loadHotkey("downloadMerged"),
    tableMode: loadHotkey("tableMode"),
};

let songListView = [];
let searchController;
let searchRequest = 0;
const cslController = new CslController();

// Initialize only after AMQ has completed loading its client UI.
const loadInterval = setInterval(() => {
    if (document.querySelector("#loadingScreen.hidden")) {
        clearInterval(loadInterval);
        setup();
    }
}, 500);

// Rebuild AMQ's autocomplete index and cancel searches using the previous names.
function rebuildCslAutocomplete(names) {
    if (autocompleteInput) {
        autocompleteInput.hide();
        autocompleteInput.destroy();
    }
    autocompleteInput = new AmqAwesomeplete(document.querySelector("#cslgNewAnswerInput"), { list: names }, true);
}

// Build the editor and attach the custom quiz runtime once AMQ is ready.
function setup() {
    cslController.install();
    createCslSettingsModal();
    bindCslTabs();
    bindSongListControls();
    bindQuizSettingsControls();
    bindMergedSongControls();
    bindAutocompleteControl();
    bindListImportControls();
    bindEditorTableControls();
    initializeSettingsControls();
    installCslHotkeys();
    applyStyles();
    registerCslScriptInfo();
}

// Build the editor markup before binding its controls.
function createCslSettingsModal() {
    $("#lobbyPage .topMenuBar").append(`<div id="lnCustomSongListButton" class="clickAble topMenuButton topMenuMediumButton"><h3>CSL</h3></div>`);
    $("#lnCustomSongListButton").on("click", openSettingsModal);

    // build settings modal
    $("#gameContainer").append($(/*html*/`
        <div class="modal fade tab-modal" id="cslgSettingsModal" tabindex="-1" role="dialog">
            <div class="modal-dialog" role="document">
                <div class="modal-content">
                    <div class="modal-header">
                        <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                            <span aria-hidden="true">×</span>
                        </button>
                        <h4 class="modal-title">Custom Song List Game</h4>
                        <div class="tabContainer">
                            <div id="cslgSongListTab" class="tab clickAble selected">
                                <h5>Song List</h5>
                            </div>
                            <div id="cslgQuizSettingsTab" class="tab clickAble">
                                <h5>Settings</h5>
                            </div>
                            <div id="cslgMergeTab" class="tab clickAble">
                                <h5>Merge</h5>
                            </div>
                            <div id="cslgAnswerTab" class="tab clickAble">
                                <h5>Answers</h5>
                            </div>
                            <div id="cslgHotkeyTab" class="tab clickAble">
                                <h5>Hotkey</h5>
                            </div>
                            <div id="cslgListImportTab" class="tab clickAble">
                                <h5>List Import</h5>
                            </div>
                            <div id="cslgInfoTab" class="tab clickAble">
                                <h5><i class="fa fa-info-circle" aria-hidden="true"></i></h5>
                            </div>
                        </div>
                    </div>
                    <div class="modal-body">
                        <div id="cslgSongListContainer" class="tabSection">
                            <div id="cslgSongListTopRow">
                                <label class="cslgField cslgModeField">
                                    <span class="sr-only">Mode</span>
                                    <select id="cslgSongListModeSelect" class="form-control">
                                        <option>Anisongdb</option>
                                        <option>Load File</option>
                                        <option>Previous Game</option>
                                        <option>Filter List</option>
                                    </select>
                                </label>
                                <div class="cslgActions" role="group" aria-label="Song list actions">
                                    <button id="cslgMergeAllButton" class="btn btn-default" type="button"><i class="fa fa-plus" aria-hidden="true"></i><span class="sr-only">Add all to merged</span></button>
                                    <button id="cslgClearSongListButton" class="btn btn-default" type="button"><i class="fa fa-trash" aria-hidden="true"></i><span class="sr-only">Clear song list</span></button>
                                    <button id="cslgTransferSongListButton" class="btn btn-default" type="button"><i class="fa fa-exchange" aria-hidden="true"></i><span class="sr-only">Transfer merged songs</span></button>
                                    <button id="cslgTableModeButton" class="btn btn-default" type="button"><i class="fa fa-table" aria-hidden="true"></i><span class="sr-only">Change table view</span></button>
                                </div>
                                <div class="cslgCounts" aria-live="polite">
                                    <span id="cslgSongListCount">Songs: 0</span>
                                    <span id="cslgMergedSongListCount">Merged: 0</span>
                                </div>
                            </div>
                            <div id="cslgAnisongdbSearchRow">
                                <div class="cslgToolbar">
                                    <div class="cslgField cslgSearchModeField">
                                        <select aria-label="Search by" id="cslgAnisongdbModeSelect" class="form-control">
                                            <option>Anime</option>
                                            <option>Artist</option>
                                            <option>Song</option>
                                            <option>Composer</option>
                                            <option>Season</option>
                                            <option>Ann Id</option>
                                            <option>Mal Id</option>
                                            <option>Ann Song Id</option>
                                            <option>Amq Song Id</option>
                                        </select>
                                    </div>
                                    <div class="cslgField cslgGrow">
                                        <input aria-label="Search" id="cslgAnisongdbQueryInput" class="form-control" type="text">
                                    </div>
                                    <div class="cslgActions">
                                        <button id="cslgAnisongdbSearchButtonGo" class="btn btn-default" type="button">Go</button>
                                        <button id="cslgAnisongdbFilterDropdownButton" class="btn btn-default" type="button" aria-expanded="false" aria-controls="cslgAnisongdbFilterOptions">Filters <i class="fa fa-caret-down" aria-hidden="true"></i></button>
                                    </div>
                                </div>
                                <div id="cslgAnisongdbFilterOptions" style="display: none;">
                                    <div class="cslgFormRow">
                                        <div class="cslgRowTitle">Matching</div>
                                        <div class="cslgCheckGroup">
                                            <label class="cslgCheckbox"><input id="cslgAnisongdbPartialCheckbox" type="checkbox" checked> Partial match</label>
                                            <label class="cslgCheckbox"><input id="cslgAnisongdbMatchCaseCheckbox" type="checkbox"> Match case</label>
                                            <label class="cslgCheckbox"><input id="cslgAnisongdbIgnoreDuplicatesCheckbox" type="checkbox"> Ignore duplicates</label>
                                        </div>
                                    </div>
                                    <div class="cslgFormRow">
                                        <div class="cslgRowTitle">Song types</div>
                                        <div class="cslgCheckGroup">
                                            <label class="cslgCheckbox"><input id="cslgAnisongdbOPCheckbox" type="checkbox" checked> OP</label>
                                            <label class="cslgCheckbox"><input id="cslgAnisongdbEDCheckbox" type="checkbox" checked> ED</label>
                                            <label class="cslgCheckbox"><input id="cslgAnisongdbINCheckbox" type="checkbox" checked> IN</label>
                                        </div>
                                    </div>
                                    <div class="cslgFormRow">
                                        <div class="cslgRowTitle">Broadcasts</div>
                                        <div class="cslgCheckGroup">
                                            <label class="cslgCheckbox"><input id="cslgAnisongdbNormalCheckbox" type="checkbox" checked> Normal</label>
                                            <label class="cslgCheckbox"><input id="cslgAnisongdbDubCheckbox" type="checkbox" checked> Dubs</label>
                                            <label class="cslgCheckbox"><input id="cslgAnisongdbRebroadcastCheckbox" type="checkbox" checked> Rebroadcasts</label>
                                        </div>
                                    </div>
                                    <div class="cslgFormRow">
                                        <div class="cslgRowTitle">Performance</div>
                                        <div class="cslgCheckGroup">
                                            <label class="cslgCheckbox"><input id="cslgAnisongdbStandardCheckbox" type="checkbox" checked> Standard</label>
                                            <label class="cslgCheckbox"><input id="cslgAnisongdbCharacterCheckbox" type="checkbox" checked> Character</label>
                                            <label class="cslgCheckbox"><input id="cslgAnisongdbChantingCheckbox" type="checkbox" checked> Chanting</label>
                                            <label class="cslgCheckbox"><input id="cslgAnisongdbInstrumentalCheckbox" type="checkbox" checked> Instrumental</label>
                                        </div>
                                    </div>
                                    <div class="cslgFormRow">
                                        <div class="cslgRowTitle">Creators</div>
                                        <div class="cslgCreatorFilters">
                                            <label class="cslgCheckbox"><input id="cslgAnisongdbArrangementCheckbox" type="checkbox" checked> Arrangements</label>
                                            <label class="cslgLimitField"><span>Max other people</span><input id="cslgAnisongdbMaxOtherPeopleInput" class="form-control input-sm" type="text" inputmode="numeric" maxlength="2"></label>
                                            <label class="cslgLimitField"><span>Min group members</span><input id="cslgAnisongdbMinGroupMembersInput" class="form-control input-sm" type="text" inputmode="numeric" maxlength="2"></label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div id="cslgFileUploadRow">
                                <label for="cslgFileUpload" class="sr-only">Upload song list JSON</label>
                                <input id="cslgFileUpload" type="file" accept=".json">
                            </div>
                            <div id="cslgPreviousGameRow" class="cslgToolbar">
                                <div class="cslgField cslgGrow"><select aria-label="Previous game" id="cslgPreviousGameSelect" class="form-control"></select></div>
                                <button id="cslgPreviousGameButtonGo" class="btn btn-default" type="button">Go</button>
                            </div>
                            <div id="cslgFilterListRow" class="cslgToolbar">
                                <select aria-label="Action" id="cslgFilterModeSelect" class="form-control"><option>Keep</option><option>Remove</option></select>
                                <select aria-label="Filter by" id="cslgFilterKeySelect" class="form-control">
                                    <option>Anime</option><option>Artist</option><option>Song Name</option>
                                    <option>Song Type</option><option>Anime Type</option><option>Difficulty</option>
                                    <option>Vintage</option><option>Rebroadcast</option><option>Dub</option>
                                    <option>Correct</option><option>Incorrect</option>
                                </select>
                                <input aria-label="Value" id="cslgFilterListInput" class="form-control" type="text">
                                <div class="cslgActions">
                                    <button id="cslgFilterListButtonGo" class="btn btn-default" type="button">Go</button>
                                    <label class="cslgCheckbox"><input id="cslgFilterListCaseCheckbox" type="checkbox"> Case sensitive</label>
                                </div>
                            </div>
                            <div class="cslgTableScroll">
                                <table id="cslgSongListTable" class="styledTable">
                                    <thead>
                                        <tr>
                                            <th class="number">#</th>
                                            <th class="song">Song</th>
                                            <th class="artist">Artist</th>
                                            <th class="difficulty">Dif</th>
                                            <th class="action"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                    </tbody>
                                </table>
                                <div id="cslgSongListWarning"></div>
                            </div>
                        </div>
                        <div id="cslgQuizSettingsContainer" class="tabSection">
                            <div class="cslgFormRow">
                                <div class="cslgRowTitle">Quiz</div>
                                <div class="cslgFields cslgQuizFields">
                                    <label class="cslgField">
                                        <span>Songs</span><input class="form-control" id="cslgSettingsSongs" type="text" inputmode="numeric">
                                    </label>
                                    <label class="cslgField">
                                        <span>Guess time (s)</span><input class="form-control" id="cslgSettingsGuessTime" type="text" inputmode="numeric">
                                    </label>
                                    <label class="cslgField">
                                        <span>Extra time (s)</span><input class="form-control" id="cslgSettingsExtraGuessTime" type="text" inputmode="numeric">
                                    </label>
                                    <label class="cslgField">
                                        <span>Scoring</span>
                                        <select class="form-control" id="cslgSettingsScoreType">
                                            <option value="1">Count</option>
                                            <option value="4">Lives</option>
                                        </select>
                                    </label>
                                    <label id="cslgSettingsLivesLabel" class="cslgField" style="display: none;">
                                        <span># lives</span>
                                        <select class="form-control" id="cslgSettingsLives">
                                            <option value="1">1</option>
                                            <option value="2">2</option>
                                            <option value="3" selected>3</option>
                                            <option value="4">4</option>
                                            <option value="5">5</option>
                                        </select>
                                    </label>
                                </div>
                            </div>
                            <div class="cslgFormRow">
                                <div class="cslgRowTitle">Song types</div>
                                <div class="cslgCheckGroup">
                                    <label class="cslgCheckbox"><input id="cslgSettingsOPCheckbox" type="checkbox" checked> OP</label>
                                    <label class="cslgCheckbox"><input id="cslgSettingsEDCheckbox" type="checkbox" checked> ED</label>
                                    <label class="cslgCheckbox"><input id="cslgSettingsINCheckbox" type="checkbox" checked> IN</label>
                                </div>
                            </div>
                            <div class="cslgFormRow">
                                <div class="cslgRowTitle">Anime types</div>
                                <div class="cslgCheckGroup">
                                    <label class="cslgCheckbox"><input id="cslgSettingsTVCheckbox" type="checkbox" checked> TV</label>
                                    <label class="cslgCheckbox"><input id="cslgSettingsMovieCheckbox" type="checkbox" checked> Movie</label>
                                    <label class="cslgCheckbox"><input id="cslgSettingsOVACheckbox" type="checkbox" checked> OVA</label>
                                    <label class="cslgCheckbox"><input id="cslgSettingsONACheckbox" type="checkbox" checked> ONA</label>
                                    <label class="cslgCheckbox"><input id="cslgSettingsSpecialCheckbox" type="checkbox" checked> Special</label>
                                    <label class="cslgCheckbox" title="Includes Doujin and any unlisted or missing anime type"><input id="cslgSettingsOtherCheckbox" type="checkbox" checked> Other</label>
                                </div>
                            </div>
                            <div class="cslgFormRow">
                                <div class="cslgRowTitle">Broadcasts</div>
                                <div class="cslgCheckGroup">
                                    <label class="cslgCheckbox"><input id="cslgSettingsDubCheckbox" type="checkbox" checked> Dubs</label>
                                    <label class="cslgCheckbox"><input id="cslgSettingsRebroadcastCheckbox" type="checkbox" checked> Rebroadcasts</label>
                                </div>
                            </div>
                            <div class="cslgFormRow">
                                <div class="cslgRowTitle">Previous guesses</div>
                                <div class="cslgCheckGroup">
                                    <label class="cslgCheckbox"><input id="cslgSettingsCorrectGuessCheckbox" type="checkbox" checked> Correct</label>
                                    <label class="cslgCheckbox"><input id="cslgSettingsIncorrectGuessCheckbox" type="checkbox" checked> Wrong</label>
                                </div>
                            </div>
                            <div class="cslgFormRow">
                                <div class="cslgRowTitle">Gameplay</div>
                                <div class="cslgCheckGroup">
                                    <label class="cslgCheckbox"><input id="cslgSettingsFastSkipCheckbox" type="checkbox"> Fast skip</label>
                                    <label class="cslgCheckbox"><input id="cslgSettingsFullSongRangeCheckbox" type="checkbox"> Full song range</label>
                                </div>
                            </div>
                            <div class="cslgFormRow">
                                <div class="cslgRowTitle">Ranges</div>
                                <div class="cslgFields">
                                    <label class="cslgField"><span>Sample point (%)</span><input class="form-control" id="cslgSettingsStartPoint" type="text"></label>
                                    <label class="cslgField"><span>Difficulty (%)</span><input class="form-control" id="cslgSettingsDifficulty" type="text"></label>
                                </div>
                            </div>
                            <div class="cslgFormRow">
                                <div class="cslgRowTitle">Playback</div>
                                <div class="cslgFields">
                                    <label class="cslgField">
                                        <span>Song order</span>
                                        <select class="form-control" id="cslgSongOrderSelect">
                                            <option value="random">Random</option>
                                            <option value="ascending">Ascending</option>
                                            <option value="descending">Descending</option>
                                        </select>
                                    </label>
                                    <label class="cslgField">
                                        <span>File host override</span>
                                        <select class="form-control" id="cslgHostOverrideSelect">
                                            <option value="0">Default</option>
                                            <option value="1">EU (eudist)</option>
                                            <option value="2">NA1 (nawdist)</option>
                                            <option value="3">NA2 (naedist)</option>
                                        </select>
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div id="cslgAnswerContainer" class="tabSection">
                            <div class="cslgToolbar">
                                <div class="cslgField"><input aria-label="Old answer" id="cslgOldAnswerInput" class="form-control" type="text" placeholder="Old answer"></div>
                                <div class="cslgField"><input aria-label="New answer" id="cslgNewAnswerInput" class="form-control" type="text" placeholder="New answer"></div>
                                <button id="cslgAnswerButtonAdd" class="btn btn-default" type="button">Add</button>
                            </div>
                            <div id="cslgAnswerText" class="cslgStatus">No list loaded</div>
                            <div class="cslgTableScroll cslgAnswerScroll">
                                <table id="cslgAnswerTable" class="styledTable">
                                    <thead>
                                        <tr>
                                            <th class="oldName">Old</th>
                                            <th class="newName">New</th>
                                            <th class="edit"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                    </tbody>
                                </table>
                            </div>
                            <p class="help-block">Use this window to replace invalid answers from your imported song list with valid answers from AMQ's autocomplete.</p>
                        </div>
                        <div id="cslgMergeContainer" class="tabSection">
                            <h4 class="cslgSectionHeading">Merge song lists</h4>
                            <div class="cslgToolbar">
                                <div class="cslgGrow cslgStatus">
                                    <div id="cslgMergeCurrentCount">Current song list: 0 songs</div>
                                    <div id="cslgMergeTotalCount">Merged song list: 0 songs</div>
                                </div>
                                <div class="cslgActions">
                                    <button id="cslgMergeButton" class="btn btn-default" type="button">Merge</button>
                                    <button id="cslgMergeClearButton" class="btn btn-warning" type="button">Clear</button>
                                    <button id="cslgMergeDownloadButton" class="btn btn-success" type="button">Download</button>
                                </div>
                            </div>
                            <div class="cslgTableScroll">
                                <table id="cslgMergedSongListTable" class="styledTable">
                                    <thead>
                                        <tr>
                                            <th class="number">#</th>
                                            <th class="anime">Anime</th>
                                            <th class="songType">Type</th>
                                            <th class="action"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                    </tbody>
                                </table>
                            </div>
                            <p class="help-block hidden">1. Load some songs into the table in the song list tab<br>2. Come back to this tab<br>3. Click "merge" to add everything from that list to a new combined list<br>4. Repeat steps 1-3 as many times as you want<br>5. Click "download" to download the new json file<br>6. Upload the file in the song list tab and play</p>
                        </div>
                        <div id="cslgHotkeyContainer" class="tabSection">
                            <table id="cslgHotkeyTable">
                                <thead>
                                    <tr>
                                        <th>Action</th>
                                        <th>Keybind</th>
                                    </tr>
                                </thead>
                                <tbody>
                                </tbody>
                            </table>
                        </div>
                        <div id="cslgListImportContainer" class="tabSection">
                            <h4 class="cslgSectionHeading">Import list from username</h4>
                            <div class="cslgToolbar">
                                <div class="cslgField">
                                    <select aria-label="List service" id="cslgListImportSelect" class="form-control"><option>myanimelist</option><option>anilist</option></select>
                                </div>
                                <div class="cslgField"><input aria-label="Username" id="cslgListImportUsernameInput" class="form-control" type="text" placeholder="username"></div>
                                <button id="cslgListImportStartButton" class="btn btn-default" type="button">Go</button>
                            </div>
                            <div class="cslgCheckGroup cslgBlock">
                                <label class="cslgCheckbox"><input id="cslgListImportWatchingCheckbox" type="checkbox" checked> Watching</label>
                                <label class="cslgCheckbox"><input id="cslgListImportCompletedCheckbox" type="checkbox" checked> Completed</label>
                                <label class="cslgCheckbox"><input id="cslgListImportHoldCheckbox" type="checkbox" checked> On hold</label>
                                <label class="cslgCheckbox"><input id="cslgListImportDroppedCheckbox" type="checkbox" checked> Dropped</label>
                                <label class="cslgCheckbox"><input id="cslgListImportPlanningCheckbox" type="checkbox" checked> Planning</label>
                            </div>
                            <h4 id="cslgListImportText" class="cslgStatus" aria-live="polite"></h4>
                            <div id="cslgListImportActionContainer" class="cslgActions cslgBlock" style="display: none;">
                                <button id="cslgListImportMoveButton" class="btn btn-default" type="button">Move to song list</button>
                                <button id="cslgListImportDownloadButton" class="btn btn-default" type="button">Download</button>
                            </div>
                        </div>
                        <div id="cslgInfoContainer" class="tabSection">
                            <h4 class="cslgSectionHeading">Script info</h4>
                            <div>Created by: kempanator</div>
                            <div>Version: ${GM_info.script.version}</div>
                            <div class="cslgActions"><a href="https://github.com/kempanator/amq-scripts/blob/main/amqCustomSongListGame.user.js" target="_blank">Github</a><a href="https://github.com/kempanator/amq-scripts/raw/main/amqCustomSongListGame.user.js" target="_blank">Install</a></div>
                            <h4 class="cslgSectionHeading cslgBlock">Custom CSS</h4>
                            <div class="cslgCSSSetting">
                                <div class="cslgToolbar">
                                    <label for="cslgCSLButtonCSSInput">#lnCustomSongListButton right:</label>
                                    <div class="cslgField"><input id="cslgCSLButtonCSSInput" class="form-control" type="text"></div>
                                </div>
                                <div class="cslgActions">
                                    <button id="cslgResetCSSButton" class="btn btn-default" type="button">Reset</button><button id="cslgApplyCSSButton" class="btn btn-default" type="button">Save</button>
                                </div>
                            </div>
                            <h4 class="cslgSectionHeading cslgBlock">Prompt all players</h4>
                            <div class="cslgActions">
                                <button id="cslgPromptAllAutocompleteButton" class="btn btn-default" type="button">Autocomplete</button><button id="cslgPromptAllVersionButton" class="btn btn-default" type="button">Version</button>
                            </div>
                            <div class="cslgCheckGroup cslgBlock"><label class="cslgCheckbox"><input id="cslgShowCSLMessagesCheckbox" type="checkbox"> Show CSL messages</label></div>
                            <div class="cslgBlock"><label class="cslgField"><span>MAL client ID</span><input id="cslgMalClientIdInput" class="form-control" type="text" placeholder="MAL Client ID"></label></div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button id="cslgAutocompleteButton" class="btn btn-danger">Autocomplete</button>
                        <button id="cslgExitButton" class="btn btn-default" data-dismiss="modal">Exit</button>
                        <button id="cslgStartButton" class="btn btn-primary">Start</button>
                    </div>
                </div>
            </div>
        </div>
    `));
}

// Connect tab selection to the existing modal sections.
function bindCslTabs() {
    const tabs = ["cslgSongList", "cslgQuizSettings", "cslgAnswer", "cslgMerge", "cslgHotkey", "cslgListImport", "cslgInfo"];
    for (const tab of tabs) {
        $(`#${tab}Tab`).on("click", () => {
            switchTab(tab);
        });
    }
    switchTab("cslgSongList");
}

// Add the current songs without repeating an existing playlist appearance.
function mergeCurrentSongList() {
    mergedSongList = mergeCslSongs(mergedSongList, songList);
    createMergedSongListTable();
}

// Cancel pending searches before clearing the current editor list.
function clearCurrentSongList() {
    cancelSongSearch();
    songList = [];
    createSongListTable();
}

// Copy the merged playlist into the current editor list.
function transferMergedToCurrentSongList() {
    cancelSongSearch();
    songList = Array.from(mergedSongList);
    createSongListTable();
}

// Advance through the existing song, anime, and media table views.
function cycleSongListTableView() {
    songListTableView = (songListTableView + 1) % 3;
    createSongListTable();
}

// Clear the merged list and refresh its table.
function clearMergedSongList() {
    mergedSongList = [];
    createMergedSongListTable();
}

// Download the merged playlist or explain why there is nothing to save.
function downloadMergedSongList() {
    if (mergedSongList.length) {
        downloadListJson(mergedSongList, "merged.json");
    }
    else {
        messageDisplayer.displayMessage("No songs", "Add some songs to the merged song list");
    }
}

// Bind searches, uploads, filters, and song-list toolbar actions.
function bindSongListControls() {
    $("#cslgAnisongdbSearchButtonGo").on("click", () => {
        anisongdbDataSearch();
    });
    $("#cslgAnisongdbQueryInput").on("keypress", (event) => {
        if (event.key === "Enter") {
            anisongdbDataSearch();
        }
    });
    // Keep the filter disclosure and its accessible state together.
    $("#cslgAnisongdbFilterDropdownButton").on("click", function () {
        $(this).attr("aria-expanded", $(this).attr("aria-expanded") !== "true");
        $(this).find("i").toggleClass("fa-caret-down fa-caret-up");
        $("#cslgAnisongdbFilterOptions").stop(true, true).slideToggle(150);
    });
    $("#cslgFileUpload").on("change", async function () {
        if (!this.files.length) return;
        const request = cancelSongSearch();
        try {
            const text = await this.files[0].text();
            if (request !== searchRequest) return;
            handleData(JSON.parse(text));
            if (!songList.length) {
                messageDisplayer.displayMessage("0 song links found");
            }
        }
        catch (error) {
            this.value = "";
            console.error(error);
            messageDisplayer.displayMessage("Upload Error");
        }
        finally {
            setSongListTableSort();
            createSongListTable();
            createAnswerTable();
        }
    });
    $("#cslgPreviousGameButtonGo").on("click", () => {
        const id = $("#cslgPreviousGameSelect").val();
        const found = Object.values(songHistoryWindow.tabs[2].gameMap).find(game => game.quizId === id);
        if (found) {
            handleData(found.songTable.rows);
            setSongListTableSort();
            createSongListTable();
            createAnswerTable();
        }
    });
    $("#cslgFilterListButtonGo").on("click", () => {
        filterSongList();
    });
    $("#cslgFilterListInput").on("keypress", (event) => {
        if (event.key === "Enter") {
            filterSongList();
        }
    });
    $("#cslgMergeAllButton").on("click", () => {
        mergeCurrentSongList();
    }).popover({
        content: "Add all to merged",
        trigger: "hover",
        placement: "bottom"
    });
    $("#cslgClearSongListButton").on("click", () => {
        clearCurrentSongList();
    }).popover({
        content: "Clear song list",
        trigger: "hover",
        placement: "bottom"
    });
    $("#cslgTransferSongListButton").on("click", () => {
        transferMergedToCurrentSongList();
    }).popover({
        content: "Transfer from merged",
        trigger: "hover",
        placement: "bottom"
    });
    $("#cslgTableModeButton").on("click", () => {
        cycleSongListTableView();
    }).popover({
        content: "Table mode",
        trigger: "hover",
        placement: "bottom"
    });
}

// Keep playback choices and scoring-dependent controls in sync.
function bindQuizSettingsControls() {
    $("#cslgSongOrderSelect").on("change", function () {
        songOrderType = this.value;
    });
    $("#cslgHostOverrideSelect").on("change", function () {
        fileHostOverride = parseInt(this.value);
    });
    // Show starting lives only when lives scoring is selected.
    $("#cslgSettingsScoreType").on("change", function () {
        $("#cslgSettingsLivesLabel").toggle(Number(this.value) === quiz.SCORE_TYPE_IDS.LIVES);
    });
}

// Bind the merged-list actions independently of its table.
function bindMergedSongControls() {
    $("#cslgMergeButton").on("click", () => {
        mergeCurrentSongList();
    });
    $("#cslgMergeClearButton").on("click", () => {
        clearMergedSongList();
    });
    $("#cslgMergeDownloadButton").on("click", () => {
        downloadMergedSongList();
    });
}

// Obtain AMQ autocomplete by briefly running a native solo quiz.
function bindAutocompleteControl() {
    $("#cslgAutocompleteButton").on("click", () => {
        if (!lobby.soloMode) {
            messageDisplayer.displayMessage("Autocomplete", "For multiplayer, just start the quiz normally and immediately lobby");
            return;
        }
        $("#cslgSettingsModal").modal("hide");
        socket.sendCommand({ type: "lobby", command: "start game" });
        const autocompleteListener = new Listener("get all song names", () => {
            autocompleteListener.unbindListener();
            viewChanger.changeView("main");
            setTimeout(() => {
                hostModal.displayHostSolo();
            }, 200);
            setTimeout(() => {
                const returnListener = new Listener("Host Game", () => {
                    returnListener.unbindListener();
                    if (songList.length) createAnswerTable();
                    setTimeout(() => { openSettingsModal() }, 10);
                });
                returnListener.bindListener();
                roomBrowser.host();
            }, 400);
        });
        autocompleteListener.bindListener();
    });
}

// Connect anime-list imports to the editor and JSON downloads.
function bindListImportControls() {
    $("#cslgListImportUsernameInput").on("keypress", (event) => {
        if (event.key === "Enter") {
            startImport();
        }
    });
    $("#cslgListImportStartButton").on("click", () => {
        startImport();
    });
    $("#cslgListImportMoveButton").on("click", () => {
        if (!importedSongList.length) return;
        handleData(importedSongList);
        setSongListTableSort();
        createSongListTable();
        createAnswerTable();
    });
    $("#cslgListImportDownloadButton").on("click", () => {
        if (!importedSongList.length) return;
        const listType = $("#cslgListImportSelect").val();
        const username = $("#cslgListImportUsernameInput").val().trim();
        const date = new Date();
        const year = String(date.getFullYear());
        const month = String(date.getMonth() + 1).padStart(2, 0);
        const day = String(date.getDate()).padStart(2, 0);
        const fileName = `${username} ${listType} ${year}-${month}-${day} song list.json`;
        downloadListJson(importedSongList, fileName);
    });
}

// Handle table actions using the displayed song order.
function bindEditorTableControls() {
    $("#cslgStartButton").on("click", () => {
        validateStart();
    });
    $("#cslgSongListTable")
        .on("click", "th", function () {
            const sort = $(this).data("sort");
            if (!sort) return;
            setSongListTableSort(sort);
            createSongListTable();
        })
        .on("click", "i.fa-plus", function () {
            const index = $(this).closest("tr").index();
            mergedSongList = mergeCslSongs(mergedSongList, [songListView[index]]);
            createMergedSongListTable();
        })
        .on("click", "i.fa-trash", function () {
            const index = $(this).closest("tr").index();
            songList.splice(songList.indexOf(songListView[index]), 1);
            createSongListTable();
            createAnswerTable();
        })
        .on("mouseenter", "i.fa-plus, i.fa-trash", function () {
            $(this).closest("tr").addClass("selected");
        })
        .on("mouseleave", "i.fa-plus, i.fa-trash", function () {
            $(this).closest("tr").removeClass("selected");
        });
    $("#cslgAnswerButtonAdd").on("click", function () {
        const oldName = $("#cslgOldAnswerInput").val().trim();
        const newName = $("#cslgNewAnswerInput").val().trim();
        if (!oldName) return;
        if (newName) replacedAnswers[oldName] = newName;
        else delete replacedAnswers[oldName];
        saveSettings();
        createAnswerTable();
    });
    $("#cslgAnswerTable").on("click", "i.fa-pencil", function () {
        const $row = $(this).closest("tr");
        const oldName = $row.find("td.oldName").text();
        const newName = $row.find("td.newName").text();
        $("#cslgOldAnswerInput").val(oldName);
        $("#cslgNewAnswerInput").val(newName);
    });
    $("#cslgMergedSongListTable")
        .on("click", "i.fa-chevron-up", function () {
            const index = $(this).closest("tr").index();
            if (index > 0) {
                [mergedSongList[index], mergedSongList[index - 1]] = [mergedSongList[index - 1], mergedSongList[index]];
                createMergedSongListTable();
            }
        })
        .on("click", "i.fa-chevron-down", function () {
            const index = $(this).closest("tr").index();
            if (index < mergedSongList.length - 1) {
                [mergedSongList[index], mergedSongList[index + 1]] = [mergedSongList[index + 1], mergedSongList[index]];
                createMergedSongListTable();
            }
        })
        .on("click", "i.fa-trash", function () {
            const index = $(this).closest("tr").index();
            mergedSongList.splice(index, 1);
            createMergedSongListTable();
        })
        .on("mouseenter", "i.fa-chevron-up, i.fa-chevron-down, i.fa-trash", function () {
            $(this).closest("tr").addClass("selected");
        })
        .on("mouseleave", "i.fa-chevron-up, i.fa-chevron-down, i.fa-trash", function () {
            $(this).closest("tr").removeClass("selected");
        });
}

// Set initial field values and bind saved script preferences.
function initializeSettingsControls() {
    $("#cslgSongListModeSelect").val("Anisongdb").on("change", function () {
        const val = this.value;
        const idMap = {
            "Anisongdb": "#cslgAnisongdbSearchRow",
            "Load File": "#cslgFileUploadRow",
            "Previous Game": "#cslgPreviousGameRow",
            "Filter List": "#cslgFilterListRow"
        }
        $(Object.values(idMap).join(",")).hide();
        $(idMap[val]).show();
        if (val === "Load File") $("#cslgAnisongdbQueryInput").val("");
        if (val === "Previous Game") loadPreviousGameOptions();
    });
    $("#cslgAnisongdbModeSelect").val("Artist");
    $("#cslgAnisongdbMaxOtherPeopleInput").val("99");
    $("#cslgAnisongdbMinGroupMembersInput").val("0");
    $("#cslgSettingsSongs").val("20");
    $("#cslgSettingsGuessTime").val("20");
    $("#cslgSettingsExtraGuessTime").val("0");
    $("#cslgSettingsStartPoint").val("0-100");
    $("#cslgSettingsDifficulty").val("0-100");
    $("#cslgFileUploadRow").hide();
    $("#cslgPreviousGameRow").hide();
    $("#cslgFilterListRow").hide();
    $("#cslgCSLButtonCSSInput").val(CSLButtonCSS);
    $("#cslgResetCSSButton").on("click", () => {
        CSLButtonCSS = "calc(25% - 250px)";
        $("#cslgCSLButtonCSSInput").val(CSLButtonCSS);
    });
    $("#cslgApplyCSSButton").on("click", () => {
        const val = $("#cslgCSLButtonCSSInput").val();
        if (val) {
            CSLButtonCSS = val;
            saveSettings();
            applyStyles();
        }
        else {
            messageDisplayer.displayMessage("Error");
        }
    });
    $("#cslgShowCSLMessagesCheckbox").prop("checked", showCSLMessages).on("click", () => {
        showCSLMessages = !showCSLMessages;
        saveSettings();
    });
    $("#cslgPromptAllAutocompleteButton").on("click", () => {
        cslController.promptLobby(CSL_LOBBY_COMMAND.AUTOCOMPLETE);
    });
    $("#cslgPromptAllVersionButton").on("click", () => {
        cslController.promptLobby(CSL_LOBBY_COMMAND.VERSION);
    });
    $("#cslgMalClientIdInput").val(malClientId).on("change", function () {
        malClientId = this.value;
        saveSettings();
    });
}

// Render bindings and dispatch the configured keyboard actions.
function installCslHotkeys() {
    createHotkeyTable([
        { action: "cslgWindow", title: "Open This Window" },
        { action: "start", title: "Start CSL" },
        { action: "stop", title: "Stop CSL" },
        { action: "mergeAll", title: "Add All To Merged" },
        { action: "clearSongList", title: "Clear Song List" },
        { action: "transferMerged", title: "Transfer From Merged" },
        { action: "clearMerged", title: "Clear Merged" },
        { action: "downloadMerged", title: "Download Merged" },
        { action: "tableMode", title: "Change Table Mode" }
    ]);

    const hotkeyActions = {
        cslgWindow: () => {
            if ($("#cslgSettingsModal").is(":visible")) {
                $("#cslgSettingsModal").modal("hide");
            }
            else {
                openSettingsModal();
            }
        },
        start: () => {
            validateStart();
        },
        stop: () => {
            cslController.stop();
        },
        mergeAll: () => {
            mergeCurrentSongList();
        },
        clearSongList: () => {
            if (quiz.inQuiz) return;
            clearCurrentSongList();
        },
        transferMerged: () => {
            if (quiz.inQuiz) return;
            transferMergedToCurrentSongList();
        },
        clearMerged: () => {
            clearMergedSongList();
        },
        downloadMerged: () => {
            downloadMergedSongList();
        },
        tableMode: () => {
            cycleSongListTableView();
        }
    };

    document.addEventListener("keydown", (event) => {
        const key = event.key.toUpperCase();
        const ctrl = event.ctrlKey;
        const alt = event.altKey;
        const shift = event.shiftKey;
        const matchesBinding = binding => {
            if (!binding.key) return false;
            if (key !== binding.key) return false;
            if (ctrl !== binding.ctrl) return false;
            if (alt !== binding.alt) return false;
            if (shift !== binding.shift) return false;
            return true;
        }
        for (const [action, binding] of Object.entries(hotKeys)) {
            if (matchesBinding(binding)) {
                event.preventDefault();
                hotkeyActions[action]();
            }
        }
    });
}

// Expose the script description through AMQ script information.
function registerCslScriptInfo() {
    AMQ_addScriptData({
        name: "Custom Song List Game",
        author: "kempanator",
        version: GM_info.script.version,
        link: "https://github.com/kempanator/amq-scripts/raw/main/amqCustomSongListGame.user.js",
        description: `
            </ul><b>How to start a custom song list game:</b>
                <li>Create a solo or multiplayer lobby (all players need this script)</li>
                <li>Click the CSL button in the top right</li>
                <li>Click the autocomplete button if it is red</li>
                <li>Create or upload a list in the song list tab</li>
                <li>Change settings in the settings tab</li>
                <li>Fix any invalid answers in the answer tab</li>
                <li>Click start to play the quiz</li>
            </ul>
        `
    });
}

// Quiz settings and playlist selection

// Validate all settings and attempt to start csl quiz
function validateStart() {
    if (!lobby.inLobby) return;
    if (!cslSupportedRoom()) return messageDisplayer.displayMessage("Unable to start", "Use a normal solo or multiplayer lobby");
    if (!lobby.isHost) {
        return messageDisplayer.displayMessage("Unable to start", "Must be host");
    }
    if (lobby.numberOfPlayers !== lobby.numberOfPlayersReady) {
        return messageDisplayer.displayMessage("Unable to start", "All players must be ready");
    }
    if (!songList || !songList.length) {
        return messageDisplayer.displayMessage("Unable to start", "No songs");
    }
    if (animeListLower.size === 0) {
        return messageDisplayer.displayMessage("Unable to start", "Autocomplete list empty");
    }
    const numSongs = Number($("#cslgSettingsSongs").val());
    if (!Number.isInteger(numSongs) || numSongs < 1) {
        return messageDisplayer.displayMessage("Unable to start", "Invalid number of songs");
    }
    const guessTime = Number($("#cslgSettingsGuessTime").val());
    if (!Number.isInteger(guessTime) || guessTime < 1 || guessTime > 99) {
        return messageDisplayer.displayMessage("Unable to start", "Invalid guess time");
    }
    const extraGuessTime = Number($("#cslgSettingsExtraGuessTime").val());
    if (!Number.isInteger(extraGuessTime) || extraGuessTime < 0 || extraGuessTime > 15) {
        return messageDisplayer.displayMessage("Unable to start", "Invalid extra guess time");
    }
    const startPointText = $("#cslgSettingsStartPoint").val().trim();
    const sampleRange = parseCslRange(startPointText, true);
    if (!sampleRange) {
        return messageDisplayer.displayMessage("Unable to start", "Song start sample must be a number or range 0-100");
    }
    startPointRange = sampleRange;
    if (!cslValidPercentRange(startPointRange)) {
        return messageDisplayer.displayMessage("Unable to start", "Song start sample must be a number or range 0-100");
    }
    const difficultyText = $("#cslgSettingsDifficulty").val().trim();
    const selectedDifficulty = parseCslRange(difficultyText);
    if (!selectedDifficulty) {
        return messageDisplayer.displayMessage("Unable to start", "Difficulty must be a range 0-100");
    }
    difficultyRange = selectedDifficulty;
    if (!cslValidPercentRange(difficultyRange)) {
        return messageDisplayer.displayMessage("Unable to start", "Difficulty must be a range 0-100");
    }
    const selected = selectCslQuizSongs(numSongs);
    if (!selected.length) return messageDisplayer.displayMessage("Unable to start", "No songs match the settings");
    const scoreType = Number($("#cslgSettingsScoreType").val());
    if (![quiz.SCORE_TYPE_IDS.COUNT, quiz.SCORE_TYPE_IDS.LIVES].includes(scoreType)) {
        return messageDisplayer.displayMessage("Unable to start", "Choose Count or Lives in the CSL settings");
    }
    const lives = Number($("#cslgSettingsLives").val());
    if (!Number.isInteger(lives) || lives < 1 || lives > 5) return messageDisplayer.displayMessage("Unable to start", "Starting lives must be between 1 and 5");
    if (lobby.settings.teamSize > 1) return messageDisplayer.displayMessage("Unable to start", "Set team size to 1 for custom song list games");
    const config = {
        totalSongs: selected.length, guessTime, extraGuessTime, scoreType,
        lives, fastSkip: $("#cslgSettingsFastSkipCheckbox").prop("checked"),
        fullSongRange: $("#cslgSettingsFullSongRangeCheckbox").prop("checked"),
        quizId: crypto.randomUUID(), startTime: new Date().toISOString()
    };
    try {
        const plan = selected.map(createCslQuizSong);
        cslController.start(config, plan);
        $("#cslgSettingsModal").modal("hide");
    }
    catch (error) {
        messageDisplayer.displayMessage("Unable to start", error.message);
    }
}

// Parse the existing numeric syntax, allowing a single value only for song samples.
function parseCslRange(text, allowSingle = false) {
    if (allowSingle && /^[0-9]+$/.test(text)) {
        const value = parseInt(text);
        return [value, value];
    }
    const match = /^([0-9]+)[\s-]+([0-9]+)$/.exec(text);
    if (!match) return null;
    return [parseInt(match[1]), parseInt(match[2])];
}

// Require an ordered percentage interval without changing the parsed values.
function cslValidPercentRange([low, high]) {
    return !(low < 0 || low > 100 || high < 0 || high > 100 || low > high);
}

// Filter stored playlist keys before applying the chosen playback order and length.
function selectCslQuizSongs(numSongs) {
    const ops = $("#cslgSettingsOPCheckbox").prop("checked");
    const eds = $("#cslgSettingsEDCheckbox").prop("checked");
    const ins = $("#cslgSettingsINCheckbox").prop("checked");
    const tv = $("#cslgSettingsTVCheckbox").prop("checked");
    const movie = $("#cslgSettingsMovieCheckbox").prop("checked");
    const ova = $("#cslgSettingsOVACheckbox").prop("checked");
    const ona = $("#cslgSettingsONACheckbox").prop("checked");
    const special = $("#cslgSettingsSpecialCheckbox").prop("checked");
    const other = $("#cslgSettingsOtherCheckbox").prop("checked");
    const dub = $("#cslgSettingsDubCheckbox").prop("checked");
    const rebroadcast = $("#cslgSettingsRebroadcastCheckbox").prop("checked");
    const correctGuesses = $("#cslgSettingsCorrectGuessCheckbox").prop("checked");
    const incorrectGuesses = $("#cslgSettingsIncorrectGuessCheckbox").prop("checked");
    const songKeys = Object.keys(songList)
        .filter((key) => songTypeFilter(songList[key], ops, eds, ins))
        .filter((key) => animeTypeFilter(songList[key], tv, movie, ova, ona, special, other))
        .filter((key) => difficultyFilter(songList[key], difficultyRange[0], difficultyRange[1]))
        .filter((key) => guessTypeFilter(songList[key], correctGuesses, incorrectGuesses))
        .filter((key) => broadcastTypeFilter(songList[key], dub, rebroadcast));
    if (songOrderType === "random") shuffleArray(songKeys);
    else if (songOrderType === "descending") songKeys.reverse();
    return songKeys.slice(0, numSongs).map(key => songList[key]);
}

// Snapshot accepted titles and media sampling before the editable list can change.
function createCslQuizSong(song) {
    const snapshot = cslClone(song);
    const answers = [
        ...snapshot.altAnimeNames,
        ...snapshot.altAnimeNamesAnswers,
        snapshot.animeRomajiName,
        snapshot.animeEnglishName
    ];
    const acceptedAnswers = answers
        .flatMap(answer => [answer, replacedAnswers[answer] || ""])
        .filter(Boolean)
        .map(answer => answer.trim().toLowerCase());
    snapshot.acceptedAnswers = [...new Set(acceptedAnswers)];
    snapshot.sample = getStartPoint();
    const metadataSize = new TextEncoder().encode(JSON.stringify(snapshot)).length;
    if (metadataSize > 8192) throw new Error("Song metadata is too large: " + snapshot.songName);
    return snapshot;
}

// Get start point value (0-100)
function getStartPoint() {
    return Math.floor(Math.random() * (startPointRange[1] - startPointRange[0] + 1)) + startPointRange[0];
}

// Return true if song type is allowed
function songTypeFilter(song, ops, eds, ins) {
    const type = song.songType;
    if (ops && type === 1) return true;
    if (eds && type === 2) return true;
    if (ins && type === 3) return true;
    return false;
}

// Match named anime types, with Other covering every unlisted or missing type.
function animeTypeFilter(song, tv, movie, ova, ona, special, other) {
    switch ((song.animeType || "").trim().toLowerCase()) {
        case "tv": return tv;
        case "movie": return movie;
        case "ova": return ova;
        case "ona": return ona;
        case "special": return special;
        default: return other;
    }
}

// Return true if the song difficulty is in allowed range
// Songs with missing difficulty will only pass if 0-100
function difficultyFilter(song, low, high) {
    if (low === 0 && high === 100) return true;
    const dif = parseFloat(song.songDifficulty);
    if (isNaN(dif)) return false;
    if (dif >= low && dif <= high) return true;
    return false;
}

// Return true if guess type is allowed
// Songs with null will only pass if both true
function guessTypeFilter(song, correctGuesses, incorrectGuesses) {
    if (correctGuesses && incorrectGuesses) return true;
    if (correctGuesses && song.correctGuess === true) return true;
    if (incorrectGuesses && song.incorrectGuess === true) return true;
    return false;
}

// Return true if the song is allowed under the selected broadcast type
function broadcastTypeFilter(song, dub, rebroadcast) {
    if (!dub && song.dub) return false;
    if (!rebroadcast && song.rebroadcast) return false;
    return true;
}

// Open custom song list settings modal
function openSettingsModal() {
    if (!lobby.inLobby) return;
    if (animeListLower.size) {
        $("#cslgAutocompleteButton").removeClass("btn-danger").addClass("btn-success disabled");
    }
    if ($("#cslgSongListModeSelect").val() === "Previous Game") {
        loadPreviousGameOptions();
    }
    $("#cslgSettingsModal").modal("show");
}

// Load previous game options in song list window
function loadPreviousGameOptions() {
    const $select = $("#cslgPreviousGameSelect").empty();
    const games = [];
    for (const game of Object.values(songHistoryWindow.tabs[2].gameMap)) {
        if (game.songTable.rows.length) {
            games.push({
                roomName: localizationHandler.translate(game.roomNameKey),
                startTime: game.startTime,
                quizId: game.quizId
            });
        }
    }
    games.sort((a, b) => b.startTime - a.startTime);
    for (const game of games) {
        const text = `${game.roomName} - ${game.startTime.format("YYYY-MM-DD HH:mm")}`;
        $select.append($("<option>", { text: text, val: game.quizId }));
    }
}

// Remote song search

// Read the selected AnisongDB search and filters.
function anisongdbDataSearch() {
    const mode = $("#cslgAnisongdbModeSelect").val().toLowerCase();
    const query = $("#cslgAnisongdbQueryInput").val();
    const options = {
        partial: $("#cslgAnisongdbPartialCheckbox").prop("checked"),
        matchCase: $("#cslgAnisongdbMatchCaseCheckbox").prop("checked"),
        ignoreDuplicates: $("#cslgAnisongdbIgnoreDuplicatesCheckbox").prop("checked"),
        maxOtherPeople: parseInt($("#cslgAnisongdbMaxOtherPeopleInput").val()),
        minGroupMembers: parseInt($("#cslgAnisongdbMinGroupMembersInput").val()),
        arrangement: $("#cslgAnisongdbArrangementCheckbox").prop("checked"),
        ops: $("#cslgAnisongdbOPCheckbox").prop("checked"),
        eds: $("#cslgAnisongdbEDCheckbox").prop("checked"),
        ins: $("#cslgAnisongdbINCheckbox").prop("checked"),
        normal: $("#cslgAnisongdbNormalCheckbox").prop("checked"),
        dub: $("#cslgAnisongdbDubCheckbox").prop("checked"),
        rebroadcast: $("#cslgAnisongdbRebroadcastCheckbox").prop("checked"),
        standard: $("#cslgAnisongdbStandardCheckbox").prop("checked"),
        character: $("#cslgAnisongdbCharacterCheckbox").prop("checked"),
        chanting: $("#cslgAnisongdbChantingCheckbox").prop("checked"),
        instrumental: $("#cslgAnisongdbInstrumentalCheckbox").prop("checked")
    };
    if (query && !isNaN(options.maxOtherPeople) && !isNaN(options.minGroupMembers)) {
        getAnisongdbData(mode, query, options);
    }
}

// Replace the editor list only if this search is still the latest operation.
function getAnisongdbData(mode, query, options) {
    $("#cslgSongListCount").text("Loading...");
    $("#cslgSongListTable tbody").empty();
    const { url, data } = createAnisongdbRequest(mode, query, options);
    searchController?.abort();
    searchController = new AbortController();
    const request = ++searchRequest;
    fetchCslJson(url, { ...data, signal: searchController.signal })
        .then(json => {
            if (request !== searchRequest) return;
            handleData(json);
            setSongListTableSort();
            createSongListTable();
            createAnswerTable();
        })
        .catch(error => {
            if (request !== searchRequest || error.name === "AbortError") return;
            createSongListTable();
            $("#cslgSongListWarning").text(error.message);
        });
}

// Build the API-specific body without mixing it with editor or cancellation state.
function createAnisongdbRequest(mode, query, options) {
    let url;
    const songTypes = [];
    const broadcasts = [];
    const songCategories = [];
    if (options.ops) songTypes.push("opening");
    if (options.eds) songTypes.push("ending");
    if (options.ins) songTypes.push("insert");
    if (options.normal) broadcasts.push("normal");
    if (options.dub) broadcasts.push("dub");
    if (options.rebroadcast) broadcasts.push("rebroadcast");
    if (options.standard) songCategories.push("standard", "other"); // matches anisongdb frontend
    if (options.character) songCategories.push("character");
    if (options.chanting) songCategories.push("chanting");
    if (options.instrumental) songCategories.push("instrumental");
    const body = {
        ignore_duplicate: options.ignoreDuplicates,
        filters: {
            song_types: songTypes,
            broadcasts: broadcasts,
            song_categories: songCategories
        }
    };
    if (mode === "anime") {
        url = apiBase + "search_request";
        body.and_logic = false;
        body.anime_search_filter = {
            search: query,
            partial_match: options.partial,
            match_case: options.matchCase
        };
    }
    else if (mode === "artist") {
        url = apiBase + "search_request";
        body.and_logic = false;
        body.artist_search_filter = {
            search: query,
            partial_match: options.partial,
            match_case: options.matchCase,
            group_granularity: options.minGroupMembers,
            max_other_artist: options.maxOtherPeople
        };
    }
    else if (mode === "song") {
        url = apiBase + "search_request";
        body.and_logic = false;
        body.song_name_search_filter = {
            search: query,
            partial_match: options.partial,
            match_case: options.matchCase
        };
    }
    else if (mode === "composer") {
        url = apiBase + "search_request";
        body.and_logic = false;
        body.composer_search_filter = {
            search: query,
            partial_match: options.partial,
            match_case: options.matchCase,
            arrangement: options.arrangement,
            group_granularity: options.minGroupMembers,
            max_other_artist: options.maxOtherPeople
        };
    }
    else if (mode === "season") {
        body.season = query;
        url = apiBase + "season_request";
    }
    else if (mode === "ann id") {
        url = apiBase + "ann_ids_request";
        body.ann_ids = query.trim().split(/[\s,]+/).map(Number);
    }
    else if (mode === "mal id") {
        url = apiBase + "mal_ids_request";
        body.mal_ids = query.trim().split(/[\s,]+/).map(Number);
    }
    else if (mode === "ann song id") {
        url = apiBase + "ann_song_ids_request";
        body.ann_song_ids = query.trim().split(/[\s,]+/).map(Number);
    }
    else if (mode === "amq song id") {
        url = apiBase + "amq_song_ids_request";
        body.amq_song_ids = query.trim().split(/[\s,]+/).map(Number);
    }
    const data = {
        method: "POST",
        headers: { "Accept": "application/json", "Content-Type": "application/json", "X-Client-Id": "amqCustomSongListGame" },
        body: JSON.stringify(body)
    };
    return { url, data };
}

// Bound external API requests and preserve HTTP/API failure information.
async function fetchCslJson(url, options = {}) {
    const controller = new AbortController();
    const forwardAbort = () => controller.abort();
    if (options.signal?.aborted) controller.abort();
    options.signal?.addEventListener("abort", forwardAbort, { once: true });
    const timeout = setTimeout(() => controller.abort(new Error("Request timed out")), 25000);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        const json = await response.json();
        if (!response.ok || json.errors?.length || json.error) {
            throw new Error(json.errors?.[0]?.message || json.error || JSON.stringify(json.detail || `HTTP ${response.status}`));
        }
        return json;
    }
    finally {
        clearTimeout(timeout);
        options.signal?.removeEventListener("abort", forwardAbort);
    }
}

// Replace the editor list only after an entire import has been normalized.
function handleData(data) {
    const result = normalizeCslSongs(data);
    if (!result.songs.length && result.warnings.length) throw new Error(result.warnings.join("; "));
    cancelSongSearch();
    songList = result.songs;
    $("#cslgSongListWarning").text(result.warnings.join("; "));
}

// Prevent an older remote search from overwriting a newer editor operation.
function cancelSongSearch() {
    searchController?.abort();
    return ++searchRequest;
}

// Song tables and editor filtering

// Sort only the display copy so playback continues using the stored list order.
function sortCslSongListView(view, language) {
    if (!songListTableSort.mode) return;
    switch (songListTableSort.mode) {
        case "songName":
            view.sort((a, b) => a.songName.localeCompare(b.songName));
            break;
        case "artist":
            view.sort((a, b) => a.songArtist.localeCompare(b.songArtist));
            break;
        case "difficulty":
            view.sort((a, b) => a.songDifficulty - b.songDifficulty);
            break;
        case "anime":
            view.sort((a, b) => a[language].localeCompare(b[language]));
            break;
        case "songType":
            view.sort(songTypeSortValue);
            break;
        case "vintage":
            view.sort(vintageSortValue);
            break;
        case "mp3":
            view.sort((a, b) => a.audio.localeCompare(b.audio));
            break;
        case "480":
            view.sort((a, b) => a.video480.localeCompare(b.video480));
            break;
        case "720":
            view.sort((a, b) => a.video720.localeCompare(b.video720));
            break;
    }
    if (!songListTableSort.ascending) view.reverse();
}

// Create song list table
function createSongListTable() {
    $("#cslgSongListCount").text("Songs: " + songList.length);
    $("#cslgMergeCurrentCount").text(`Current song list: ${songList.length} song${songList.length === 1 ? "" : "s"}`);
    const language = options.useRomajiNames ? "animeRomajiName" : "animeEnglishName";
    const $thead = $("#cslgSongListTable thead").empty();
    const $tbody = $("#cslgSongListTable tbody").empty();
    const view = [...songList];
    sortCslSongListView(view, language);
    songListView = view;
    if (songListTableView === 0) {
        $thead.append($("<tr>")
            .append($("<th>", { class: "number", text: "#" }))
            .append($("<th>", { class: "song clickAble", text: "Song", "data-sort": "songName" }))
            .append($("<th>", { class: "artist clickAble", text: "Artist", "data-sort": "artist" }))
            .append($("<th>", { class: "difficulty clickAble", text: "Dif", "data-sort": "difficulty" }))
            .append($("<th>", { class: "action" }))
        );
        view.forEach((song, i) => {
            $tbody.append($("<tr>")
                .append($("<td>", { class: "number", text: i + 1 }))
                .append($("<td>", { class: "song", text: song.songName }))
                .append($("<td>", { class: "artist", text: song.songArtist }))
                .append($("<td>", { class: "difficulty", text: Number.isFinite(song.songDifficulty) ? Math.floor(song.songDifficulty) : "" }))
                .append($("<td>", { class: "action" })
                    .append(`<i class="fa fa-plus clickAble" aria-hidden="true"></i>`)
                    .append(`<i class="fa fa-trash clickAble" aria-hidden="true"></i>`)
                )
            );
        });
    }
    else if (songListTableView === 1) {
        $thead.append($("<tr>")
            .append($("<th>", { class: "number", text: "#" }))
            .append($("<th>", { class: "anime clickAble", text: "Anime", "data-sort": "anime" }))
            .append($("<th>", { class: "songType clickAble", text: "Type", "data-sort": "songType" }))
            .append($("<th>", { class: "vintage clickAble", text: "Vintage", "data-sort": "vintage" }))
            .append($("<th>", { class: "action" }))
        );
        view.forEach((song, i) => {
            $tbody.append($("<tr>")
                .append($("<td>", { class: "number", text: i + 1 }))
                .append($("<td>", { class: "anime", text: song[language] }))
                .append($("<td>", { class: "songType", text: songTypeText(song.songType, song.songTypeNumber) }))
                .append($("<td>", { class: "vintage", text: song.animeVintage }))
                .append($("<td>", { class: "action" })
                    .append(`<i class="fa fa-plus clickAble" aria-hidden="true"></i>`)
                    .append(`<i class="fa fa-trash clickAble" aria-hidden="true"></i>`)
                )
            );
        });
    }
    else if (songListTableView === 2) {
        $thead.append($("<tr>")
            .append($("<th>", { class: "number", text: "#" }))
            .append($("<th>", { class: "link clickAble", text: "MP3", "data-sort": "mp3" }))
            .append($("<th>", { class: "link clickAble", text: "480", "data-sort": "480" }))
            .append($("<th>", { class: "link clickAble", text: "720", "data-sort": "720" }))
            .append($("<th>", { class: "action" }))
        );
        view.forEach((song, i) => {
            $tbody.append($("<tr>")
                .append($("<td>", { class: "number", text: i + 1 }))
                .append($("<td>", { class: "link" })
                    .append(createLinkElement(song.audio)))
                .append($("<td>", { class: "link" })
                    .append(createLinkElement(song.video480)))
                .append($("<td>", { class: "link" })
                    .append(createLinkElement(song.video720)))
                .append($("<td>", { class: "action" })
                    .append(`<i class="fa fa-plus clickAble" aria-hidden="true"></i>`)
                    .append(`<i class="fa fa-trash clickAble" aria-hidden="true"></i>`)
                )
            );
        });
    }
}

// Create merged song list table
function createMergedSongListTable() {
    $("#cslgMergedSongListCount").text("Merged: " + mergedSongList.length);
    $("#cslgMergeTotalCount").text(`Merged song list: ${mergedSongList.length} song${mergedSongList.length === 1 ? "" : "s"}`);
    const $tbody = $("#cslgMergedSongListTable tbody").empty();
    const language = options.useRomajiNames ? "animeRomajiName" : "animeEnglishName";
    mergedSongList.forEach((song, i) => {
        $tbody.append($("<tr>")
            .append($("<td>", { class: "number", text: i + 1 }))
            .append($("<td>", { class: "anime", text: song[language] }))
            .append($("<td>", { class: "songType", text: songTypeText(song.songType, song.songTypeNumber) }))
            .append($("<td>", { class: "action" })
                .append(`<i class="fa fa-chevron-up clickAble" aria-hidden="true"></i>`)
                .append(`<i class="fa fa-chevron-down clickAble" aria-hidden="true"></i>`)
                .append(`<i class="fa fa-trash clickAble" aria-hidden="true"></i>`)
            )
        );
    });
}

// Create answer table
function createAnswerTable() {
    const $tbody = $("#cslgAnswerTable tbody").empty();
    if (songList.length === 0) {
        $("#cslgAnswerText").text("No list loaded");
        return;
    }
    if (animeListLower.size === 0) {
        $("#cslgAnswerText").text("Fetch autocomplete first");
        return;
    }
    const animeList = new Set();
    const missingAnimeList = [];
    for (const song of songList) {
        const answers = [song.animeEnglishName, song.animeRomajiName].concat(song.altAnimeNames, song.altAnimeNamesAnswers);
        answers.forEach(x => animeList.add(x));
    }
    for (const anime of animeList) {
        if (!animeListLower.has(anime.toLowerCase())) {
            missingAnimeList.push(anime);
        }
    }
    missingAnimeList.sort((a, b) => a.localeCompare(b));
    $("#cslgAnswerText").text(`Found ${missingAnimeList.length} anime missing from AMQ's autocomplete`);
    for (const anime of missingAnimeList) {
        $tbody.append($("<tr>")
            .append($("<td>", { class: "oldName", text: anime }))
            .append($("<td>", { class: "newName", text: replacedAnswers[anime] || "" }))
            .append($("<td>", { class: "edit" })
                .append(`<i class="fa fa-pencil clickAble" aria-hidden="true"></i>`))
        );
    }
}

// Resolve table links using the same media-host policy as quiz playback.
function createLinkElement(link) {
    if (!link) return "";
    const $a = $("<a>", { target: "_blank", href: resolveCslMediaUrl(link) });
    $a.text(link.includes("animemusicquiz") || link.includes("catbox") ? link.split("/").at(-1) : link);
    return $a;
}

// Change sort mode or toggle sort order
function setSongListTableSort(mode) {
    if (mode) {
        if (songListTableSort.mode === mode) {
            songListTableSort.ascending = !songListTableSort.ascending;
        }
        else {
            songListTableSort.mode = mode;
            songListTableSort.ascending = true;
        }
    }
    else {
        songListTableSort.mode = "";
        songListTableSort.ascending = true;
    }
}

// Get sorting value for anime vintage
function vintageSortValue(a, b) {
    if (!a.animeVintage && !b.animeVintage) return 0;
    if (!a.animeVintage) return 1;
    if (!b.animeVintage) return -1;
    const [seasonA, yearA] = a.animeVintage.split(" ");
    const [seasonB, yearB] = b.animeVintage.split(" ");
    if (yearA !== yearB) {
        return yearA - yearB;
    }
    const seasonOrder = { "Winter": 1, "Spring": 2, "Summer": 3, "Fall": 4 };
    return seasonOrder[seasonA] - seasonOrder[seasonB];
}

// Get sorting value for song type
function songTypeSortValue(a, b) {
    if (a.songType !== b.songType) {
        return a.songType - b.songType;
    }
    if (a.songType !== 3 && b.songType !== 3) {
        return (a.songTypeNumber || 0) - (b.songTypeNumber || 0);
    }
    return 0;
}

// Apply one editor filter while keeping invalid input from changing the list.
function filterSongList() {
    cancelSongSearch();
    const keep = $("#cslgFilterModeSelect").val() === "Keep";
    const key = $("#cslgFilterKeySelect").val();
    const text = $("#cslgFilterListInput").val();
    const caseSensitive = $("#cslgFilterListCaseCheckbox").prop("checked");
    const matches = createCslSongFilter(key, text, caseSensitive);
    if (matches === null) return;
    if (matches) {
        songList = songList.filter(song => {
            const match = matches(song);
            return keep ? match : !match;
        });
    }
    createSongListTable();
    createAnswerTable();
}

// Return a predicate, null for invalid input, or undefined for an unknown field.
function createCslSongFilter(key, text, caseSensitive) {
    const includes = (value, query) => {
        if (caseSensitive) return value.includes(query);
        return value.toLowerCase().includes(query.toLowerCase());
    };
    switch (key) {
        case "Anime":
            if (!text) return null;
            return song => includes(song.animeRomajiName, text) || includes(song.animeEnglishName, text);
        case "Artist":
            if (!text) return null;
            return song => includes(song.songArtist, text);
        case "Song Name":
            if (!text) return null;
            return song => includes(song.songName, text);
        case "Song Type": {
            const query = text.toLowerCase().trim();
            if (!query) return null;
            const number = parseInt(query.match(/[0-9]+/)?.[0]) || null;
            let type;
            let typeNumber = number;
            if (query.startsWith("o")) type = 1;
            else if (query.startsWith("e")) type = 2;
            else if (query.startsWith("i")) {
                type = 3;
                typeNumber = null;
            }
            else return null;
            return song => song.songType === type && (!typeNumber || typeNumber === song.songTypeNumber);
        }
        case "Anime Type": {
            const query = text.toLowerCase().trim();
            if (!query) return null;
            return song => song.animeType && query === song.animeType.toLowerCase();
        }
        case "Difficulty": {
            const query = text.toLowerCase().trim();
            if (!query) return null;
            if (query === "null") return song => song.songDifficulty === null;
            const [low, high] = query.split(/[\s-]+/).map(Number);
            if (isNaN(low) || isNaN(high) || low > high) return null;
            return song => Number.isFinite(song.songDifficulty) && song.songDifficulty >= low && song.songDifficulty <= high;
        }
        case "Vintage": {
            const query = text.toLowerCase().trim();
            if (!query) return null;
            if (query === "null") return song => song.animeVintage === null;
            if (/^[0-9]{4}[\s-]+[0-9]{4}$/.test(query)) {
                const [low, high] = query.split(/[\s-]+/).map(Number);
                if (isNaN(low) || isNaN(high) || low > high) return null;
                return song => {
                    const year = song.animeVintage ? Number(song.animeVintage.split(" ")[1]) : NaN;
                    return Number.isInteger(year) && year >= low && year <= high;
                };
            }
            return song => song.animeVintage && song.animeVintage.toLowerCase().includes(query);
        }
        case "Rebroadcast":
            return song => Boolean(song.rebroadcast);
        case "Dub":
            return song => Boolean(song.dub);
        case "Correct":
            return song => song.correctGuess === true;
        case "Incorrect":
            return song => song.incorrectGuess === true;
    }
}

// Reset all tabs and switch to the inputted tab
function switchTab(tab) {
    const $w = $("#cslgSettingsModal");
    $w.find(".tab").removeClass("selected");
    $w.find(".tabSection").hide();
    $w.find(`#${tab}Tab`).addClass("selected");
    $w.find(`#${tab}Container`).show();
}

// Media and AMQ song metadata

// Convert vintage string into AMQ songInfo vintage object
function formatAmqVintage(vintage) {
    if (!vintage) return null;
    if (typeof vintage === "object") return vintage;
    vintage = String(vintage).toLowerCase();
    const regex = /^(winter|spring|summer|fall) ([0-9]+)$/.exec(vintage);
    if (!regex) return null;
    return {
        key: "song_library.anime_entry.vintage." + regex[1],
        data: { year: Number(regex[2]) }
    }
}

// Override only AMQ media hosts, preserving external URLs and full media paths.
function resolveCslMediaUrl(url) {
    url = cslMedia(url);
    if (!url) return "";
    const host = hostDict[fileHostOverride];
    if (/^[\w-]+\.[\w]{3,4}$/.test(url)) {
        return host ? `https://${host}/${url}` : videoResolver.formatUrl(url, false);
    }
    if (host) {
        const parsed = new URL(url);
        if (parsed.hostname === "animemusicquiz.com" || parsed.hostname.endsWith(".animemusicquiz.com")) {
            parsed.hostname = host;
            return parsed.href;
        }
    }
    return url;
}

// Translate type and typeNumber ids to shortened type text
function songTypeText(type, typeNumber) {
    if (type === 1) return "OP" + typeNumber;
    if (type === 2) return "ED" + typeNumber;
    if (type === 3) return "IN";
    return "";
};

// VideoInfo payload for quiz next video info (guessMode required by MoeVideoPlayer.updatePlayMode)
function createCslVideoInfo(audio, video480, video720) {
    return {
        id: null,
        encrypted: false,
        guessMode: { song: true, tinyVideo: false, blurVideo: false },
        videoMap: {
            catbox: createCatboxLinkObject(audio, video480, video720)
        },
        videoVolumeMap: {
            catbox: {
                "0": -20,
                "480": -20,
                "720": -20
            }
        }
    };
}

// Input 3 links, return formatted catbox link object
function createCatboxLinkObject(audio, video480, video720) {
    const links = {};
    for (const [quality, url] of [["0", audio], ["480", video480], ["720", video720]]) {
        const resolved = resolveCslMediaUrl(url);
        if (resolved) links[quality] = resolved;
    }
    return links;
}

// Hotkey configuration

// Load hotkey from local storage, input optional default values
function loadHotkey(action, key = "", ctrl = false, alt = false, shift = false) {
    const item = saveData.hotKeys?.[action];
    return {
        key: (typeof item?.key === "string" ? item.key : key).toUpperCase(),
        ctrl: Boolean(item?.ctrl ?? ctrl),
        alt: Boolean(item?.alt ?? alt),
        shift: Boolean(item?.shift ?? shift)
    }
}

// Create hotkey rows and add to table
function createHotkeyTable(data) {
    const $tbody = $("#cslgHotkeyTable tbody");
    for (const { action, title } of data) {
        const $input = $("<input>", { type: "text", class: "form-control hk-input", readonly: true, "data-action": action })
            .val(bindingToText(hotKeys[action]))
            .on("click", startHotkeyRecord);
        $tbody.append($("<tr>")
            .append($("<td>", { text: title }))
            .append($("<td>").append($input)));
    }
}

// Begin hotkey capture on click
function startHotkeyRecord() {
    const $input = $(this);
    if ($input.hasClass("recording")) return;
    const action = $input.data("action");
    const capture = (e) => {
        e.stopImmediatePropagation();
        e.preventDefault();
        if (!e.key) return;
        if (["Shift", "Control", "Alt", "Meta"].includes(e.key)) return;
        if ((e.key === "Delete" || e.key === "Backspace" || e.key === "Escape") && !e.altKey && !e.ctrlKey && !e.shiftKey && !e.metaKey) {
            hotKeys[action] = {
                key: "",
                ctrl: false,
                alt: false,
                shift: false
            };
        }
        else {
            hotKeys[action] = {
                key: e.key.toUpperCase(),
                ctrl: e.ctrlKey,
                alt: e.altKey,
                shift: e.shiftKey
            };
        }
        saveSettings();
        finish();
    };
    const finish = () => {
        document.removeEventListener("keydown", capture, true);
        $input.removeClass("recording").val(bindingToText(hotKeys[action])).off("blur", finish);
    };
    document.addEventListener("keydown", capture, true);
    $input.addClass("recording").val("Press keys…").on("blur", finish);
}

// Input hotKeys[action] and convert the data to a string for the input field
function bindingToText(binding) {
    if (!binding) return "";
    const keys = [];
    if (binding.ctrl) keys.push("CTRL");
    if (binding.alt) keys.push("ALT");
    if (binding.shift) keys.push("SHIFT");
    if (binding.key) keys.push(binding.key === " " ? "SPACE" : binding.key);
    return keys.join(" + ");
}

// Anime-list imports

// Input myanimelist username, return list of mal ids
async function getMalIdsFromMyanimelist(username) {
    const malIds = [];
    const statuses = [];
    if ($("#cslgListImportWatchingCheckbox").prop("checked")) {
        statuses.push("watching");
    }
    if ($("#cslgListImportCompletedCheckbox").prop("checked")) {
        statuses.push("completed");
    }
    if ($("#cslgListImportHoldCheckbox").prop("checked")) {
        statuses.push("on_hold");
    }
    if ($("#cslgListImportDroppedCheckbox").prop("checked")) {
        statuses.push("dropped");
    }
    if ($("#cslgListImportPlanningCheckbox").prop("checked")) {
        statuses.push("plan_to_watch");
    }
    if (!statuses.length) throw new Error("Select at least one list status");
    for (const status of statuses) {
        $("#cslgListImportText").text(`Retrieving Myanimelist: ${status}`);
        let nextPage = `https://api.myanimelist.net/v2/users/${username}/animelist?offset=0&limit=1000&nsfw=true&status=${status}`;
        while (nextPage) {
            const result = await fetchCslMalPage(nextPage);
            for (const anime of result.data) malIds.push(anime.node.id);
            nextPage = result.paging?.next || "";
        }
    }
    return malIds;
}

// Fetch one MAL page through Tampermonkey and retain provider error details.
function fetchCslMalPage(url) {
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: "GET", url, timeout: 25000,
            headers: { "Accept": "application/json", "X-MAL-CLIENT-ID": malClientId },
            onload: response => {
                try {
                    const json = JSON.parse(response.responseText);
                    if (response.status < 200 || response.status >= 300 || json.error || !Array.isArray(json.data)) {
                        throw new Error(json.message || json.error || `MAL HTTP ${response.status}`);
                    }
                    resolve(json);
                }
                catch (error) {
                    reject(error);
                }
            },
            onerror: () => reject(new Error("MAL request failed")),
            ontimeout: () => reject(new Error("MAL request timed out"))
        });
    });
}

// Input anilist username, return list of mal ids
async function getMalIdsFromAnilist(username) {
    const malIds = [];
    const statuses = [];
    let pageNumber = 1;
    let hasNextPage = true;
    if ($("#cslgListImportWatchingCheckbox").prop("checked")) {
        statuses.push("CURRENT");
    }
    if ($("#cslgListImportCompletedCheckbox").prop("checked")) {
        statuses.push("COMPLETED");
    }
    if ($("#cslgListImportHoldCheckbox").prop("checked")) {
        statuses.push("PAUSED");
    }
    if ($("#cslgListImportDroppedCheckbox").prop("checked")) {
        statuses.push("DROPPED");
    }
    if ($("#cslgListImportPlanningCheckbox").prop("checked")) {
        statuses.push("PLANNING");
    }
    if (!statuses.length) throw new Error("Select at least one list status");
    while (hasNextPage) {
        if (pageNumber % 29 === 0) {
            $("#cslgListImportText").text(`Large list: pausing 1 minute to avoid rate limit`);
            await new Promise(r => setTimeout(r, 60000));
        }
        $("#cslgListImportText").text(`Retrieving Anilist: page ${pageNumber}`);
        const data = await getAnilistData(username, statuses, pageNumber);
        if (data) {
            for (const item of data.mediaList) {
                if (item.media.idMal) {
                    malIds.push(item.media.idMal);
                }
            }
            if (data.pageInfo.hasNextPage) {
                pageNumber += 1;
            }
            else {
                hasNextPage = false;
            }
        }
        else {
            $("#cslgListImportText").text("Anilist API Error");
            hasNextPage = false;
        }
    }
    return malIds;
}

// Input username, status, and page number
async function getAnilistData(username, statuses, pageNumber) {
    const query = `query ($username: String!, $statuses: [MediaListStatus], $page: Int!) {
        Page(page: $page, perPage: 50) {
            pageInfo { hasNextPage }
            mediaList(userName: $username, type: ANIME, status_in: $statuses) { media { idMal } }
        }
    }`;
    const json = await fetchCslJson("https://graphql.anilist.co", {
        method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ query, variables: { username, statuses, page: pageNumber } })
    });
    if (!json.data?.Page) throw new Error("AniList returned no list data");
    return json.data.Page;
}

// Stage every import batch before exposing a complete result to the editor.
async function getSongListFromMalIds(malIds) {
    const ids = [...new Set(malIds)];
    const songs = [];
    for (let index = 0; index < ids.length; index += 500) {
        const segment = ids.slice(index, index + 500);
        const json = await fetchCslJson(apiBase + "mal_ids_request", {
            method: "POST", headers: { "Accept": "application/json", "Content-Type": "application/json", "X-Client-Id": "amqCustomSongListGame" },
            body: JSON.stringify({ mal_ids: segment })
        });
        if (!Array.isArray(json)) throw new Error("AnisongDB returned an invalid song list");
        songs.push(...json);
        $("#cslgListImportText").text(`Anime: ${Math.min(index + 500, ids.length)} / ${ids.length} | Songs: ${songs.length}`);
    }
    return songs;
}

// Release the import lock after success, failure, timeout, or malformed API data.
async function startImport() {
    if (importRunning) return;
    const source = $("#cslgListImportSelect").val();
    const username = $("#cslgListImportUsernameInput").val().trim();
    if (!username) return $("#cslgListImportText").text("Input a username");
    if (source === "myanimelist" && !malClientId) return $("#cslgListImportText").text("Missing MAL Client ID");
    importRunning = true;
    $("#cslgListImportStartButton").addClass("disabled");
    $("#cslgListImportActionContainer").hide();
    try {
        const ids = source === "myanimelist" ? await getMalIdsFromMyanimelist(username) : await getMalIdsFromAnilist(username);
        importedSongList = await getSongListFromMalIds(ids);
        $("#cslgListImportText").text(`Imported ${ids.length} anime | Songs: ${importedSongList.length}`);
        if (importedSongList.length) $("#cslgListImportActionContainer").show();
    }
    catch (error) {
        $("#cslgListImportText").text(error.message);
        console.error("CSL import failed", error);
    }
    finally {
        $("#cslgListImportStartButton").removeClass("disabled");
        importRunning = false;
    }
}

// Persistence and styling

// Input list and file name, download json file
function downloadListJson(list, fileName) {
    const json = JSON.stringify(list);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

// Validate json data in local storage
function validateLocalStorage(item) {
    try {
        const json = JSON.parse(localStorage.getItem(item));
        if (!json || typeof json !== "object") return {};
        return json;
    }
    catch {
        return {};
    }
}

// Save settings
function saveSettings() {
    localStorage.setItem("customSongListGame", JSON.stringify({
        replacedAnswers,
        showCSLMessages,
        CSLButtonCSS,
        debug,
        hotKeys,
        malClientId
    }));
}

// Apply styles
function applyStyles() {
    const tableHighlightColor = getComputedStyle(document.documentElement).getPropertyValue("--accentColorContrast") || "#4497ea";
    let css = /*css*/ `
        #lnCustomSongListButton {
            right: ${CSLButtonCSS};
            width: 80px;
        }
        #cslgSettingsModal .modal-dialog {
            width: 680px;
            max-width: calc(100% - 20px);
            margin-left: auto;
            margin-right: auto;
        }
        #cslgSettingsModal .modal-header {
            padding: 3px 0 0;
        }
        #cslgSettingsModal .modal-body {
            overflow-y: auto;
            max-height: calc(100vh - 150px);
        }
        #cslgInfoTab {
            width: 45px;
            margin-right: -10px;
            padding-right: 8px;
            float: right;
        }
        #cslgAutocompleteButton {
            float: left;
        }
        #cslgSettingsModal .cslgToolbar, #cslgSettingsModal .cslgFields {
            display: flex;
            flex-wrap: wrap;
            align-items: flex-end;
            gap: 12px;
            min-width: 0;
        }
        #cslgSettingsModal .cslgActions, #cslgSettingsModal .cslgCheckGroup {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 8px 16px;
            min-width: 0;
        }
        #cslgSettingsModal .cslgActions {
            gap: 8px;
        }
        #cslgSettingsModal .cslgCSSSetting {
            display: grid;
            gap: 10px;
        }
        #cslgSettingsModal .cslgCSSSetting .cslgToolbar {
            align-items: center;
        }
        #cslgSettingsModal .cslgCSSSetting label {
            margin: 0;
            font-weight: normal;
        }
        #cslgSongListContainer .cslgToolbar, #cslgSongListContainer .cslgFields, #cslgSongListContainer .cslgToolbar .cslgActions {
            gap: 10px;
        }
        #cslgSettingsModal .cslgField {
            display: flex;
            flex: 1 1 120px;
            flex-direction: column;
            gap: 2px;
            min-width: 0;
            margin: 0;
            font-weight: normal;
        }
        #cslgSettingsModal .cslgGrow {
            flex: 2 1 180px;
            min-width: 0;
        }
        #cslgSettingsModal .cslgField > span {
            font-size: 12px;
            opacity: 0.8;
        }
        #cslgSettingsModal .cslgRowTitle {
            font-size: 14px;
            opacity: 0.8;
        }
        #cslgSettingsModal .cslgCheckbox {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            margin: 0;
            font-size: 14px;
            font-weight: normal;
            cursor: pointer;
        }
        #cslgSettingsModal .cslgCheckbox input {
            flex: none;
            margin: 0;
        }
        #cslgSettingsModal .cslgFormRow {
            display: grid;
            grid-template-columns: 112px minmax(0, 1fr);
            align-items: center;
            gap: 16px;
            padding: 12px 0;
        }
        #cslgSettingsModal .cslgFormRow + .cslgFormRow {
            border-top: 1px solid rgba(255, 255, 255, 0.12);
        }
        #cslgSettingsModal .cslgQuizFields .cslgField {
            flex-basis: 78px;
        }
        #cslgSettingsModal .cslgBlock {
            margin-top: 18px;
        }
        #cslgSettingsModal .cslgSectionHeading {
            margin: 0 0 12px;
        }
        #cslgSettingsModal .cslgSectionHeading.cslgBlock {
            margin-top: 22px;
        }
        #cslgSettingsModal .cslgStatus {
            margin: 10px 0;
            font-size: 14px;
            overflow-wrap: anywhere;
        }
        #cslgSongListTopRow {
            display: flex;
            flex-wrap: nowrap;
            align-items: center;
            gap: 10px;
            margin: 2px 0 5px 0;
        }
        #cslgSongListTopRow .cslgModeField {
            flex: 0 0 150px;
        }
        #cslgSongListTopRow .cslgActions {
            flex: none;
            flex-wrap: nowrap;
            gap: 6px;
        }
        #cslgSongListTopRow .cslgActions .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 34px;
            height: 34px;
            padding: 0;
        }
        #cslgSongListTopRow .cslgActions .fa {
            font-size: 20px;
        }
        #cslgSongListTopRow .cslgCounts {
            display: flex;
            gap: 12px;
            min-width: 0;
            margin-left: auto;
            font-size: 16px;
            font-variant-numeric: tabular-nums;
        }
        #cslgSongListTopRow .cslgCounts span {
            white-space: nowrap;
        }
        #cslgAnisongdbSearchRow .cslgSearchModeField {
            flex: 0 0 150px;
        }
        #cslgAnisongdbFilterOptions {
            margin-top: 8px;
        }
        #cslgAnisongdbFilterOptions .cslgFormRow {
            grid-template-columns: 84px minmax(0, 1fr);
            gap: 10px;
            padding: 6px 0;
        }
        #cslgAnisongdbFilterOptions .cslgCheckGroup {
            gap: 4px 12px;
        }
        #cslgAnisongdbFilterOptions .cslgCreatorFilters {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 10px;
        }
        #cslgAnisongdbFilterOptions .cslgLimitField {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            margin: 0;
            font-size: 12px;
            font-weight: normal;
        }
        #cslgAnisongdbFilterOptions .cslgLimitField input {
            width: 54px;
        }
        #cslgFileUpload {
            max-width: 100%;
        }
        #cslgFilterListRow > select {
            flex: none;
            width: auto;
        }
        #cslgFilterListInput {
            flex: 1 1 120px;
            min-width: 0;
            width: auto;
        }
        #cslgFilterListRow .cslgActions {
            flex: none;
            flex-wrap: nowrap;
        }
        #cslgSettingsModal .cslgTableScroll {
            height: 400px;
            margin: 5px 0;
            overflow-y: scroll;
        }
        #cslgSettingsModal .cslgAnswerScroll {
            height: 300px;
        }
        @media (max-width: 600px) {
            #cslgSettingsModal .cslgFormRow, #cslgAnisongdbFilterOptions .cslgFormRow {
                grid-template-columns: minmax(0, 1fr);
                gap: 8px;
            }
        }
        #cslgSongListTable {
            width: 100%;
            table-layout: fixed;
        }
        #cslgSongListTable thead tr {
            font-weight: bold;
        }
        #cslgSongListTable .number {
            width: 30px;
        }
        #cslgSongListTable .difficulty {
            width: 30px;
        }
        #cslgSongListTable .songType {
            width: 45px;
        }
        #cslgSongListTable .vintage {
            width: 100px;
        }
        #cslgSongListTable .action {
            width: 35px;
        }
        #cslgSongListTable .action i.fa-trash {
            margin-left: 4px;
        }
        #cslgSongListTable .action i.fa-plus:hover {
            color: #5cb85c;
        }
        #cslgSongListTable .action i.fa-trash:hover {
            color: #d9534f;
        }
        #cslgSongListTable th, #cslgSongListTable td {
            padding: 0 4px;
        }
        #cslgSongListTable tr.selected td:not(.action) {
            color: ${tableHighlightColor};
        }
        #cslgMergedSongListTable {
            width: 100%;
            table-layout: fixed;
        }
        #cslgMergedSongListTable thead tr {
            font-weight: bold;
        }
        #cslgMergedSongListTable .number {
            width: 30px;
        }
        #cslgMergedSongListTable .songType {
            width: 45px;
        }
        #cslgMergedSongListTable .action {
            width: 55px;
        }
        #cslgMergedSongListTable .action i.fa-trash {
            margin-left: 4px;
        }
        #cslgMergedSongListTable .action i.fa-chevron-up:hover, #cslgMergedSongListTable .action i.fa-chevron-down:hover {
            color: #f0ad4e;
        }
        #cslgMergedSongListTable .action i.fa-trash:hover {
            color: #d9534f;
        }
        #cslgMergedSongListTable th, #cslgMergedSongListTable td {
            padding: 0 4px;
        }
        #cslgMergedSongListTable tr.selected td:not(.action) {
            color: ${tableHighlightColor};
        }
        #cslgAnswerTable {
            width: 100%;
            table-layout: fixed;
        }
        #cslgAnswerTable thead tr {
            font-weight: bold;
        }
        #cslgAnswerTable .edit {
            width: 20px;
        }
        #cslgAnswerTable tbody i.fa-pencil:hover {
            opacity: .8;
        }
        #cslgAnswerTable th, #cslgAnswerTable td {
            padding: 0 4px;
        }
        #cslgHotkeyTable th {
            font-weight: bold;
            padding: 0 20px 5px 0;
        }
        #cslgHotkeyTable td {
            padding: 2px 20px 2px 0;
        }
        #cslgHotkeyTable input.hk-input {
            width: 200px;
            cursor: pointer;
            user-select: none;
        }
        table.styledTable thead tr {
            background-color: #282828;
        }
        table.styledTable tbody tr:nth-child(odd) {
            background-color: #424242;
        }
        table.styledTable tbody tr:nth-child(even) {
            background-color: #353535;
        }
    `;
    let style = document.getElementById("customSongListGameStyle");
    if (style) {
        style.textContent = css.trim();
    }
    else {
        style = document.createElement("style");
        style.id = "customSongListGameStyle";
        style.textContent = css.trim();
        document.head.appendChild(style);
    }
}
