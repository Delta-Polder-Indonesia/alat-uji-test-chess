/*
  Bintang Toba Chess Engine v4.5 (Web Worker)
  Enhanced with Strong Queen Safety Rules
*/

(() => {
  'use strict';

  const FILES = 'abcdefgh';
  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  const EMPTY = 0;
  const WP = 1, WN = 2, WB = 3, WR = 4, WQ = 5, WK = 6;
  const BP = 9, BN = 10, BB = 11, BR = 12, BQ = 13, BK = 14;

  const WHITE = 0;
  const BLACK = 1;

  const INF = 30000;
  const MATE = 29000;
  const DEFAULT_HASH_MB = 64;
  const MIN_HASH_MB = 1;
  const MAX_HASH_MB = 1024;
  const BOOL_RE = /^(true|1|on|yes)$/i;

  const FLAG_CAPTURE = 1;
  const FLAG_EP      = 2;
  const FLAG_CASTLE  = 4;
  const FLAG_PROMO   = 8;

  const KNIGHT_DIR = [31, 33, 14, -14, 18, -18, -31, -33];
  const BISHOP_DIR = [15, 17, -15, -17];
  const ROOK_DIR   = [1, -1, 16, -16];
  const KING_DIR   = [1, -1, 16, -16, 15, 17, -15, -17];

  const PIECE_VALUE = {
    [WP]: 100, [WN]: 320, [WB]: 330, [WR]: 500, [WQ]: 900, [WK]: 0,
    [BP]: 100, [BN]: 320, [BB]: 330, [BR]: 500, [BQ]: 900, [BK]: 0,
  };

  const PIECE_CH = {
    [WP]:'P',[WN]:'N',[WB]:'B',[WR]:'R',[WQ]:'Q',[WK]:'K',
    [BP]:'p',[BN]:'n',[BB]:'b',[BR]:'r',[BQ]:'q',[BK]:'k',
  };

  const CH_PIECE = {
    P:WP,N:WN,B:WB,R:WR,Q:WQ,K:WK,
    p:BP,n:BN,b:BB,r:BR,q:BQ,k:BK,
  };

  function isWhite(p)    { return p >= WP && p <= WK; }
  function isBlack(p)    { return p >= BP && p <= BK; }
  function colorOf(p)    { return isWhite(p) ? WHITE : BLACK; }
  function opponent(c)   { return c ^ 1; }
  function onBoard(sq)   { return (sq & 0x88) === 0; }

  function sqToUci(sq) {
    return FILES[sq & 7] + ((sq >> 4) + 1);
  }
  function uciToSq(uci) {
    if (!uci || uci.length < 2) return -1;
    const f = FILES.indexOf(uci[0]);
    const r = Number(uci[1]) - 1;
    if (f < 0 || r < 0 || r > 7) return -1;
    return (r << 4) | f;
  }

  const SQ = {};
  ['a1','b1','c1','d1','e1','f1','g1','h1',
   'a8','b8','c8','d8','e8','f8','g8','h8'].forEach(n => { SQ[n] = uciToSq(n); });

  /* ── Piece-square tables ── */
  const PST_PAWN = [
      0,  0,  0,  0,  0,  0,  0,  0,
     50, 50, 50, 50, 50, 50, 50, 50,
     10, 10, 20, 30, 30, 20, 10, 10,
      5,  5, 10, 25, 25, 10,  5,  5,
      0,  0,  0, 20, 20,  0,  0,  0,
      5, -5,-10,  0,  0,-10, -5,  5,
      5, 10, 10,-20,-20, 10, 10,  5,
      0,  0,  0,  0,  0,  0,  0,  0,
  ];
  const PST_KNIGHT = [
    -50,-40,-30,-30,-30,-30,-40,-50,
    -40,-20,  0,  0,  0,  0,-20,-40,
    -30,  0, 10, 15, 15, 10,  0,-30,
    -30,  5, 15, 20, 20, 15,  5,-30,
    -30,  0, 15, 20, 20, 15,  0,-30,
    -30,  5, 10, 15, 15, 10,  5,-30,
    -40,-20,  0,  5,  5,  0,-20,-40,
    -50,-40,-30,-30,-30,-30,-40,-50,
  ];
  const PST_BISHOP = [
    -20,-10,-10,-10,-10,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5, 10, 10,  5,  0,-10,
    -10,  5,  5, 10, 10,  5,  5,-10,
    -10,  0, 10, 10, 10, 10,  0,-10,
    -10, 10, 10, 10, 10, 10, 10,-10,
    -10,  5,  0,  0,  0,  0,  5,-10,
    -20,-10,-10,-10,-10,-10,-10,-20,
  ];
  const PST_ROOK = [
      0,  0,  0,  0,  0,  0,  0,  0,
      5, 10, 10, 10, 10, 10, 10,  5,
     -5,  0,  0,  0,  0,  0,  0, -5,
     -5,  0,  0,  0,  0,  0,  0, -5,
     -5,  0,  0,  0,  0,  0,  0, -5,
     -5,  0,  0,  0,  0,  0,  0, -5,
     -5,  0,  0,  0,  0,  0,  0, -5,
      0,  0,  0,  5,  5,  0,  0,  0,
  ];
  const PST_QUEEN = [
    -20,-10,-10, -5, -5,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5,  5,  5,  5,  0,-10,
     -5,  0,  5,  5,  5,  5,  0, -5,
      0,  0,  5,  5,  5,  5,  0, -5,
    -10,  5,  5,  5,  5,  5,  0,-10,
    -10,  0,  5,  0,  0,  0,  0,-10,
    -20,-10,-10, -5, -5,-10,-10,-20,
  ];
  const PST_KING_MG = [
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -20,-30,-30,-40,-40,-30,-30,-20,
    -10,-20,-20,-20,-20,-20,-20,-10,
     20, 20,  0,  0,  0,  0, 20, 20,
     20, 30, 10,  0,  0, 10, 30, 20,
  ];
  const PST_KING_EG = [
    -50,-30,-30,-30,-30,-30,-30,-50,
    -30,-20,-10,-10,-10,-10,-20,-30,
    -30,-10, 20, 30, 30, 20,-10,-30,
    -30,-10, 30, 40, 40, 30,-10,-30,
    -30,-10, 30, 40, 40, 30,-10,-30,
    -30,-10, 20, 30, 30, 20,-10,-30,
    -30,-30,  0,  0,  0,  0,-30,-30,
    -50,-30,-30,-30,-30,-30,-30,-50,
  ];

  const PHASE_WEIGHT = {
    [WP]: 0, [WN]: 1, [WB]: 1, [WR]: 2, [WQ]: 4, [WK]: 0,
    [BP]: 0, [BN]: 1, [BB]: 1, [BR]: 2, [BQ]: 4, [BK]: 0,
  };
  const MAX_PHASE = 24;
  const MVV_LVA = (() => {
    const t = Array.from({ length: 7 }, () => new Int16Array(7));
    for (let victim = 1; victim <= 6; victim++) {
      for (let attacker = 1; attacker <= 6; attacker++) {
        t[victim][attacker] = victim * 16 - attacker;
      }
    }
    return t;
  })();

  const MOBN_S = 4, MOBN_E = -5, MOBN_S0 = -9,  MOBN_E0 = -73;
  const MOBB_S = 7, MOBB_E =  2, MOBB_S0 = -10, MOBB_E0 = -48;
  const MOBR_S = 5, MOBR_E =  2, MOBR_S0 = -2,  MOBR_E0 = -50;
  const MOBQ_S = 3, MOBQ_E =  6, MOBQ_S0 = 6,   MOBQ_E0 = 0;

  const TIGHT_NS = 4,   TIGHT_NE = -4;
  const TIGHT_BS = 10,  TIGHT_BE = 9;
  const TIGHT_RS = 4,   TIGHT_RE = 6;
  const TIGHT_QS = -148, TIGHT_QE = -162;

  const TENSE_NS = 53,  TENSE_NE = 24;
  const TENSE_BS = 36,  TENSE_BE = 40;
  const TENSE_RS = 103, TENSE_RE = -18;
  const TENSE_QS = -4,  TENSE_QE = 23;

  const ATT_N = 27, ATT_B = 9, ATT_R = 44, ATT_Q = 49;
  const TWOBISHOPS_S = 35, TWOBISHOPS_E = 59;
  const ROOK7TH_S = -28, ROOK7TH_E = 33;
  const ROOKOPEN_S = 21, ROOKOPEN_E = -3;
  const ROOK_DOUBLED_S = 27, ROOK_DOUBLED_E = -3;
  const QUEEN7TH_S = -75, QUEEN7TH_E = 55;

  /* ── TWO-SLOT TRANSPOSITION TABLE ── */
  const TT_WORDS = 10; // Two slots of 5 words each
  const TT_SLOTWORDS = 5;
  const TT_DEPTH  = 0;
  const TT_FLAG   = 1;
  const TT_SCORE  = 2;
  const TT_HASH   = 3;
  const TT_BEST   = 4;

  function ttSlotsFromMb(mb) {
    const clamped = Math.max(MIN_HASH_MB, Math.min(MAX_HASH_MB, mb | 0));
    const bytes = clamped * 1024 * 1024;
    const entryBytes = TT_WORDS * 4;
    let slots = 1;
    while ((slots << 1) * entryBytes <= bytes) slots <<= 1;
    return slots;
  }

  class TranspositionTable {
    constructor(hashMb = DEFAULT_HASH_MB) {
      this.resize(hashMb);
    }

    resize(hashMb) {
      this.size = ttSlotsFromMb(hashMb);
      this.mask = this.size - 1;
      this.data = new Int32Array(this.size * TT_WORDS);
      this.ages = new Uint16Array(this.size);
      this.epoch = 1;
    }

    clear() {
      this.data.fill(0);
      this.ages.fill(0);
      this.epoch = 1;
    }

    nextEpoch() {
      this.epoch = (this.epoch + 1) & 0xffff;
      if (this.epoch === 0) this.epoch = 1;
    }

    _idx(slot, hash) { return ((slot * this.size) + ((hash >>> 0) & this.mask)) * TT_SLOTWORDS; }

    probe(hash, depth, alpha, beta) {
      const i0 = this._idx(0, hash);
      const i1 = this._idx(1, hash);
      const key = (hash >>> 0) | 0;
      
      // Check slot 0 (depth-preferred)
      if (this.data[i0 + TT_HASH] === key) {
        if (this.data[i0 + TT_DEPTH] >= depth) {
          const score = this.data[i0 + TT_SCORE];
          const flag = this.data[i0 + TT_FLAG];
          if (flag === 0) return score;
          if (flag === -1 && score <= alpha) return score;
          if (flag === 1 && score >= beta) return score;
        }
      }
      
      // Check slot 1 (always-replace)
      if (this.data[i1 + TT_HASH] === key) {
        if (this.data[i1 + TT_DEPTH] >= depth) {
          const score = this.data[i1 + TT_SCORE];
          const flag = this.data[i1 + TT_FLAG];
          if (flag === 0) return score;
          if (flag === -1 && score <= alpha) return score;
          if (flag === 1 && score >= beta) return score;
        }
      }
      
      return null;
    }

    getBestMove(hash) {
      const i0 = this._idx(0, hash);
      const i1 = this._idx(1, hash);
      const key = (hash >>> 0) | 0;
      if (this.data[i0 + TT_HASH] === key) return this.data[i0 + TT_BEST];
      if (this.data[i1 + TT_HASH] === key) return this.data[i1 + TT_BEST];
      return 0;
    }

    store(hash, depth, score, flag, bestEncoded) {
      const key = (hash >>> 0) | 0;
      const i0 = this._idx(0, hash);
      const i1 = this._idx(1, hash);
      
      const d0 = this.data[i0 + TT_DEPTH];
      const k0 = this.data[i0 + TT_HASH];
      const age0 = k0 ? ((this.epoch - this.ages[(i0/TT_SLOTWORDS)|0]) & 0xffff) : 0xffff;
      
      const d1 = this.data[i1 + TT_DEPTH];
      const k1 = this.data[i1 + TT_HASH];
      const age1 = k1 ? ((this.epoch - this.ages[(i1/TT_SLOTWORDS)|0]) & 0xffff) : 0xffff;
      
      // Slot 0: depth-preferred replacement
      const replace0 = (k0 === 0) || (age0 > 2 && d0 < depth) || (k0 !== key && (age0 > 4 || d0 <= depth));
      
      // Slot 1: always replace if key matches or slot 1 is empty/deep enough
      const replace1 = (k1 === 0) || (k1 === key) || (age1 > 1);
      
      if (replace0) {
        this.data[i0 + TT_HASH] = key;
        this.data[i0 + TT_DEPTH] = depth;
        this.data[i0 + TT_SCORE] = score;
        this.data[i0 + TT_FLAG] = flag;
        this.data[i0 + TT_BEST] = bestEncoded || (k0 === key ? this.data[i0 + TT_BEST] : 0);
        this.ages[(i0/TT_SLOTWORDS)|0] = this.epoch;
      }
      if (replace1) {
        this.data[i1 + TT_HASH] = key;
        this.data[i1 + TT_DEPTH] = depth;
        this.data[i1 + TT_SCORE] = score;
        this.data[i1 + TT_FLAG] = flag;
        this.data[i1 + TT_BEST] = bestEncoded || (k1 === key ? this.data[i1 + TT_BEST] : 0);
        this.ages[(i1/TT_SLOTWORDS)|0] = this.epoch;
      }
    }

    hashfull() {
      const sample = Math.min(1024, this.size * 2);
      if (!sample) return 0;
      const step = Math.max(1, ((this.size * 2) / sample) | 0);
      let used = 0;
      let seen = 0;
      for (let idx = 0; idx < this.size * 2 && seen < sample; idx += step, seen++) {
        if (this.data[idx * TT_SLOTWORDS + TT_HASH] !== 0) used++;
      }
      return Math.max(0, Math.min(1000, Math.floor((used * 1000) / Math.max(1, seen))));
    }

    static encodeMove(m) {
      if (!m) return 0;
      return (m.from) | (m.to << 8) | ((m.promo || 0) << 16) | ((m.flags || 0) << 24);
    }
    static decodeMove(v) {
      if (!v) return null;
      return { from: v & 0xff, to: (v >>> 8) & 0xff, promo: (v >>> 16) & 0xff, flags: (v >>> 24) & 0xff };
    }
  }

  /* ── INTERNAL OPENING BOOK ── */
  const OPENING_BOOK = [
    // Sicilian Defense
    { fen: START_FEN, moves: ['e2e4', 'c7c5', 'Nb1c3', 'Nb8c6', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'Nb1d4'] },
    { fen: START_FEN, moves: ['e2e4', 'c7c5', 'Ng1f3', 'd7d6', 'd2d4', 'c5d4', 'Nf3d4', 'Ng8f6', 'Nb1c3', 'a7a6'] },
    { fen: START_FEN, moves: ['e2e4', 'c7c5', 'Nb1c3', 'Ng8f6', 'g1f3', 'e7e6', 'd2d4', 'c5d4', 'Nf3d4'] },
    
    // French Defense
    { fen: START_FEN, moves: ['e2e4', 'e7e6', 'd2d4', 'd7d5', 'Nb1c3', 'Ng8f6'] },
    { fen: START_FEN, moves: ['e2e4', 'e7e6', 'd2d4', 'd7d5', 'e4e5', 'Nb8c6', 'Nb1c3', 'Ng8f6'] },
    
    // Caro-Kann Defense
    { fen: START_FEN, moves: ['e2e4', 'c7c6', 'd2d4', 'd7d5', 'Nb1c3', 'd5e4', 'Nc3e4', 'Ng8f6'] },
    { fen: START_FEN, moves: ['e2e4', 'c7c6', 'd2d4', 'd7d5', 'e4e5', 'Bf8e7', 'g1f3', 'Nb8d7'] },
    
    // London System
    { fen: START_FEN, moves: ['d2d4', 'd7d5', 'Ng1f3', 'Ng8f6', 'Bc1f4', 'e7e6', 'e2e3', 'c7c5'] },
    
    // Italian Game
    { fen: START_FEN, moves: ['e2e4', 'e7e5', 'Ng1f3', 'Nb8c6', 'Bf1c4', 'Bf8c5'] },
    
    // Ruy Lopez
    { fen: START_FEN, moves: ['e2e4', 'e7e5', 'Ng1f3', 'Nb8c6', 'Bf1b5'] },
    
    // Queen's Gambit
    { fen: START_FEN, moves: ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'Nb1c3', 'Ng8f6'] },
    
    // King's Indian Defense
    { fen: START_FEN, moves: ['d2d4', 'Ng8f6', 'c2c4', 'g7g6', 'Nb1c3', 'Bf8g7'] },
    
    // English Opening
    { fen: START_FEN, moves: ['c2c4', 'e7e5', 'Nb1c3', 'Nb8c6', 'g1f3', 'Ng8f6'] },
  ];

  class OpeningBook {
    constructor() { this.enabled = true; this.randomness = 10; }
    getMove(engineBoard, sideToMove, hash) {
      if (!this.enabled) return null;
      const fen = engineBoard.getFen();
      for (const entry of OPENING_BOOK) {
        if (fen === START_FEN || fen.startsWith(entry.fen.substring(0, fen.length))) {
          const targetMove = entry.moves[engineBoard.history.length];
          if (!targetMove) return null;
          const m = engineBoard.findMoveByUci(targetMove);
          if (m) return m;
        }
      }
      return null;
    }
  }

  class RNG {
    constructor(seed = 0x9e3779b1) { this.s = seed >>> 0; }
    next() {
      let x = this.s;
      x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
      this.s = x >>> 0;
      return this.s;
    }
  }

  class Engine {
    constructor() {
      this.name   = 'Bintang Toba 4.5';
      this.author = 'Bintang Team';

      this.options = {
        Hash: DEFAULT_HASH_MB,
        MultiPV: 1,
        Ponder: false,
        StrengthPreset: 'Custom',
        SkillLevel: 20,
        UCI_LimitStrength: false,
        UCI_Elo: 2200,
        MoveOverhead: 30,
        UCI_AnalyseMode: false,
        UCI_ShowWDL: false,
        UCI_ShowACPL: false,
        PVFormat: 'uci',
        Contempt: 15,
        OwnBook: true,
        BookRandomness: 10,
        QueenSafety: 'Strong',
      };

      this.stop      = false;
      this.nodes     = 0;
      this.selDepth  = 0;
      this.startTime = 0;
      this.moveTime  = 0;
      this.maxNodes  = 0;
      this.selDepthHard = 0;
      this.effectiveSkillLevel = 20;
      this.pondering = false;
      this.lastGoSpec = null;

      this.board    = new Uint8Array(128);
      this.side     = WHITE;
      this.castle   = 0;
      this.ep       = -1;
      this.halfmove = 0;
      this.fullmove = 1;
      this.kingPos  = [SQ['e1'], SQ['e8']];
      this.history  = [];
      this.hashStack = [];
      this.killers  = Array.from({length: 128}, () => [0, 0]);
      this.histTable = new Int32Array(15 * 128);
      this.contHist = new Int16Array((15 * 128) * (15 * 128));
      this.counterMoves = new Int32Array(15 * 128);
      this.evalTrace = new Int32Array(256);
      this.Z = this._initZobrist();
      this.tt = new TranspositionTable(this.options.Hash);
      this.book = new OpeningBook();
      this.bestMove  = null;
      this.setFen(START_FEN);
    }

    _initZobrist() {
      const rng   = new RNG(0x12345678);
      const piece = Array.from({length: 15}, () => {
        const a = new Uint32Array(128);
        for (let sq = 0; sq < 128; sq++) a[sq] = onBoard(sq) ? rng.next() : 0;
        return a;
      });
      const side   = rng.next();
      const castle = new Uint32Array(16);
      for (let i = 0; i < 16; i++) castle[i] = rng.next();
      const ep = new Uint32Array(128);
      for (let i = 0; i < 128; i++) ep[i] = onBoard(i) ? rng.next() : 0;
      return { piece, side, castle, ep };
    }

    send(...parts) { postMessage(parts.join(' ').trim()); }

    clearBoard() {
      this.board.fill(0);
      this.side = WHITE; this.castle = 0; this.ep = -1;
      this.halfmove = 0; this.fullmove = 1;
      this.history.length = 0; this.hashStack.length = 0;
      this.kingPos[WHITE] = -1; this.kingPos[BLACK] = -1;
    }

    setFen(fen) {
      this.clearBoard();
      const parts = fen.trim().split(/\s+/);
      const rows  = parts[0].split('/');
      let r = 7;
      for (const row of rows) {
        let f = 0;
        for (const ch of row) {
          if (ch >= '1' && ch <= '8') { f += +ch; continue; }
          const sq = (r << 4) | f;
          const p  = CH_PIECE[ch] || EMPTY;
          this.board[sq] = p;
          if (p === WK) this.kingPos[WHITE] = sq;
          if (p === BK) this.kingPos[BLACK] = sq;
          f++;
        }
        r--;
      }
      this.side     = parts[1] === 'b' ? BLACK : WHITE;
      const cstr    = parts[2] || '-';
      this.castle   = 0;
      if (cstr.includes('K')) this.castle |= 1;
      if (cstr.includes('Q')) this.castle |= 2;
      if (cstr.includes('k')) this.castle |= 4;
      if (cstr.includes('q')) this.castle |= 8;
      this.ep       = (parts[3] && parts[3] !== '-') ? uciToSq(parts[3]) : -1;
      this.halfmove = +(parts[4] || 0);
      this.fullmove = +(parts[5] || 1);
      this._recomputeHash();
      this.hashStack.push(this.hash);
    }

    getFen() {
      const rows = [];
      for (let rk = 7; rk >= 0; rk--) {
        let row = ''; let emp = 0;
        for (let fl = 0; fl < 8; fl++) {
          const p = this.board[(rk << 4) | fl];
          if (!p) { emp++; continue; }
          if (emp) { row += emp; emp = 0; }
          row += PIECE_CH[p];
        }
        if (emp) row += emp;
        rows.push(row);
      }
      const c = this.castle
        ? `${this.castle&1?'K':''}${this.castle&2?'Q':''}${this.castle&4?'k':''}${this.castle&8?'q':''}`
        : '-';
      return `${rows.join('/')} ${this.side===WHITE?'w':'b'} ${c} ${this.ep===-1?'-':sqToUci(this.ep)} ${this.halfmove} ${this.fullmove}`;
    }

    _recomputeHash() {
      let h = 0;
      for (let sq = 0; sq < 128; sq++) {
        if (!onBoard(sq)) { sq += 7; continue; }
        const p = this.board[sq];
        if (p) h ^= this.Z.piece[p][sq];
      }
      h ^= this.Z.castle[this.castle];
      if (this.ep !== -1) h ^= this.Z.ep[this.ep];
      if (this.side === BLACK) h ^= this.Z.side;
      this.hash = h >>> 0;
    }

    isAttacked(sq, byColor) {
      const board = this.board;
      if (byColor === WHITE) {
        if (onBoard(sq-15) && board[sq-15] === WP) return true;
        if (onBoard(sq-17) && board[sq-17] === WP) return true;
      } else {
        if (onBoard(sq+15) && board[sq+15] === BP) return true;
        if (onBoard(sq+17) && board[sq+17] === BP) return true;
      }
      const kn = byColor === WHITE ? WN : BN;
      for (const d of KNIGHT_DIR) {
        const to = sq + d;
        if (onBoard(to) && board[to] === kn) return true;
      }
      const bi = byColor === WHITE ? WB : BB;
      const ro = byColor === WHITE ? WR : BR;
      const qu = byColor === WHITE ? WQ : BQ;
      for (const d of BISHOP_DIR) {
        let to = sq + d;
        while (onBoard(to)) {
          const p = board[to]; if (p) { if (p===bi||p===qu) return true; break; }
          to += d;
        }
      }
      for (const d of ROOK_DIR) {
        let to = sq + d;
        while (onBoard(to)) {
          const p = board[to]; if (p) { if (p===ro||p===qu) return true; break; }
          to += d;
        }
      }
      const ki = byColor === WHITE ? WK : BK;
      for (const d of KING_DIR) {
        const to = sq + d;
        if (onBoard(to) && board[to] === ki) return true;
      }
      return false;
    }

    inCheck(color) { return this.isAttacked(this.kingPos[color], opponent(color)); }

    isSquareAttackedByPawn(sq, byColor) {
      const board = this.board;
      if (byColor === WHITE) {
        return (onBoard(sq - 15) && board[sq - 15] === WP) ||
               (onBoard(sq - 17) && board[sq - 17] === WP);
      }
      return (onBoard(sq + 15) && board[sq + 15] === BP) ||
             (onBoard(sq + 17) && board[sq + 17] === BP);
    }

    /* ── QUEEN SAFETY EVALUATION ── */
    queenTradeAcceptable(m, minGain = 200) {
      if (!(m.flags & FLAG_CAPTURE)) return true;
      if (m.piece !== WQ && m.piece !== BQ) return true;
      const see = this.see(m);
      const victimVal = PIECE_VALUE[m.capture] || 0;
      const queenVal = PIECE_VALUE[m.piece] || 900;
      
      // Queen-for-Queen is always OK
      if (victimVal >= 850) return true;
      
      // Queen will be traded for lesser material - must have clear compensation
      if (see < minGain) return false;
      
      // Additional safety checks
      const them = opponent(this.side);
      
      // If capturing into an attacked square, extra cautious
      if (this.isAttacked(m.to, them)) {
        if (see < minGain * 1.5) return false;  // Must be much better if ending up attacked
        if (this.isSquareAttackedByPawn(m.to, them)) {
          if (see < minGain * 2) return false;  // Even more cautious about pawn attacks
        }
      }
      
      // For queen-for-minor trades, require even stronger compensation
      if (victimVal <= 500 && see < 300) return false;
      
      return true;
    }

    queenMoveSafe(m, allowAttacked = false) {
      if (m.piece !== WQ && m.piece !== BQ) return true;
      
      const them = opponent(this.side);
      const see = (m.flags & FLAG_CAPTURE) ? this.see(m) : (m.promo ? PIECE_VALUE[m.promo] - 900 : 0);
      
      // Queen-for-queen is fine
      if ((m.flags & FLAG_CAPTURE) && (PIECE_VALUE[m.capture] || 0) >= 850) return true;
      
      // Quiet queen moves - don't move to unsafe squares
      if (!(m.flags & (FLAG_CAPTURE | FLAG_PROMO | FLAG_EP))) {
        // Give strong penalty if moving into attack
        if (this.isAttacked(m.to, them)) {
          if (this.isSquareAttackedByPawn(m.to, them)) return false;
          if (!allowAttacked) return false;
        }
        return true;
      }
      
      // Captures: require positive SEE
      if (see < 200) return false;
      
      // If capturing into attacked square, must be worth it
      if (this.isAttacked(m.to, them)) {
        if (see < 350) return false;
        if (this.isSquareAttackedByPawn(m.to, them) && see < 500) return false;
      }
      
      return true;
    }

    queenMoveAllowedByPolicy(m, depth, isRoot = false) {
      if (m.piece !== WQ && m.piece !== BQ) return true;

      const mode = String(this.options.QueenSafety || 'Strong');
      if (mode === 'Weak') return true;

      const them = opponent(this.side);
      const isCapture = !!(m.flags & (FLAG_CAPTURE | FLAG_EP));

      if (isCapture) {
        const victimVal = PIECE_VALUE[m.capture] || 0;
        if (victimVal >= 850) return true; // queen-for-queen is always acceptable

        let requiredSee = mode === 'Strong' ? 280 : 180;
        if (depth <= 5) requiredSee += mode === 'Strong' ? 180 : 120;
        if (isRoot) requiredSee += 80;
        if (this.isAttacked(m.to, them)) requiredSee += 140;
        if (this.isSquareAttackedByPawn(m.to, them)) requiredSee += 120;
        if (victimVal <= 500) requiredSee += 140; // queen-for-minor/pawn needs clear gain

        return this.see(m) >= requiredSee;
      }

      // Quiet queen moves: forbid stepping into attacked squares for shallow/root searches.
      if (!this.isAttacked(m.to, them)) return true;
      if (this.isSquareAttackedByPawn(m.to, them)) return false;
      if (mode === 'Strong') return false;
      if (isRoot || depth <= 6) return false;
      return true;
    }

    makeMove(m) {
      const oldCastle = this.castle;
      const oldEp     = this.ep;
      const oldHash   = this.hash;
      this.history.push({
        from: m.from, to: m.to, piece: m.piece, capture: m.capture,
        promo: m.promo, flags: m.flags, castle: oldCastle, ep: oldEp,
        halfmove: this.halfmove, fullmove: this.fullmove,
        hash: oldHash, kingW: this.kingPos[WHITE], kingB: this.kingPos[BLACK],
      });
      let h = oldHash;
      h ^= this.Z.piece[m.piece][m.from];
      h ^= this.Z.castle[oldCastle];
      if (oldEp !== -1) h ^= this.Z.ep[oldEp];
      this.halfmove++;
      if (m.piece === WP || m.piece === BP || m.capture) this.halfmove = 0;
      this.board[m.from] = EMPTY;
      if (m.capture && !(m.flags & FLAG_EP)) h ^= this.Z.piece[m.capture][m.to];
      const placed = m.promo || m.piece;
      this.board[m.to] = placed;
      h ^= this.Z.piece[placed][m.to];
      if (m.piece === WK) this.kingPos[WHITE] = m.to;
      if (m.piece === BK) this.kingPos[BLACK] = m.to;
      this.ep = -1;
      if (m.flags & FLAG_EP) {
        const capSq = this.side === WHITE ? m.to - 16 : m.to + 16;
        h ^= this.Z.piece[this.board[capSq]][capSq];
        this.board[capSq] = EMPTY;
      }
      if (m.flags & FLAG_CASTLE) {
        const [rs, rd] = this._castleRookSquares(m.to);
        const rook = this.board[rs];
        h ^= this.Z.piece[rook][rs];
        h ^= this.Z.piece[rook][rd];
        this.board[rd] = rook;
        this.board[rs] = EMPTY;
      }
      if (m.piece === WK) this.castle &= ~3;
      if (m.piece === BK) this.castle &= ~12;
      if (m.from === SQ['a1'] || m.to === SQ['a1']) this.castle &= ~2;
      if (m.from === SQ['h1'] || m.to === SQ['h1']) this.castle &= ~1;
      if (m.from === SQ['a8'] || m.to === SQ['a8']) this.castle &= ~8;
      if (m.from === SQ['h8'] || m.to === SQ['h8']) this.castle &= ~4;
      if (m.piece === WP && m.to - m.from === 32) this.ep = m.from + 16;
      if (m.piece === BP && m.from - m.to === 32) this.ep = m.from - 16;
      h ^= this.Z.castle[this.castle];
      if (this.ep !== -1) h ^= this.Z.ep[this.ep];
      h ^= this.Z.side;
      this.hash = h >>> 0;
      if (this.side === BLACK) this.fullmove++;
      this.side = opponent(this.side);
      this.hashStack.push(this.hash);
    }

    _castleRookSquares(kingTo) {
      if (kingTo === SQ['g1']) return [SQ['h1'], SQ['f1']];
      if (kingTo === SQ['c1']) return [SQ['a1'], SQ['d1']];
      if (kingTo === SQ['g8']) return [SQ['h8'], SQ['f8']];
      return [SQ['a8'], SQ['d8']];
    }

    undoMove() {
      const st = this.history.pop();
      if (!st) return;
      this.hashStack.pop();
      this.side     = opponent(this.side);
      this.castle   = st.castle;
      this.ep       = st.ep;
      this.halfmove = st.halfmove;
      this.fullmove = st.fullmove;
      this.hash     = st.hash;
      this.kingPos[WHITE] = st.kingW;
      this.kingPos[BLACK] = st.kingB;
      this.board[st.from] = st.piece;
      this.board[st.to]   = st.capture || EMPTY;
      if (st.flags & FLAG_EP) {
        const capSq = this.side === WHITE ? st.to - 16 : st.to + 16;
        this.board[capSq] = this.side === WHITE ? BP : WP;
        this.board[st.to] = EMPTY;
      }
      if (st.flags & FLAG_CASTLE) {
        const [rs, rd] = this._castleRookSquares(st.to);
        this.board[rs] = this.board[rd];
        this.board[rd] = EMPTY;
      }
    }

    makeNullMove() {
      const oldEp = this.ep;
      this.history.push({
        from:-1, to:-1, piece:0, capture:0, promo:0, flags:0,
        castle: this.castle, ep: oldEp, halfmove: this.halfmove, fullmove: this.fullmove,
        hash: this.hash, kingW: this.kingPos[WHITE], kingB: this.kingPos[BLACK], isNull: true,
      });
      let h = this.hash;
      if (oldEp !== -1) h ^= this.Z.ep[oldEp];
      this.ep = -1;
      h ^= this.Z.side;
      this.hash = h >>> 0;
      this.halfmove++;
      if (this.side === BLACK) this.fullmove++;
      this.side = opponent(this.side);
      this.hashStack.push(this.hash);
    }

    undoNullMove() { this.undoMove(); }

    isDraw() {
      if (this.halfmove >= 100) return true;
      const cur = this.hash;
      let reps = 0;
      const limit = Math.max(0, this.hashStack.length - this.halfmove - 1);
      for (let i = this.hashStack.length - 1; i >= limit; i--) {
        if (this.hashStack[i] === cur) { if (++reps >= 2) return true; }
      }
      return false;
    }

    isInsufficientMaterial() {
      let wn=0,wb=0,bn=0,bb=0;
      for (let sq=0;sq<128;sq++) {
        if (!onBoard(sq)){sq+=7;continue;}
        const p=this.board[sq];
        if (!p) continue;
        if (p===WP||p===BP||p===WR||p===BR||p===WQ||p===BQ) return false;
        if (p===WN) wn++;
        if (p===WB) wb++;
        if (p===BN) bn++;
        if (p===BB) bb++;
      }
      if (wn+wb+bn+bb===0) return true;
      if (wn+wb<=1&&bn+bb===0) return true;
      if (bn+bb<=1&&wn+wb===0) return true;
      return false;
    }

    genMoves(capturesOnly = false) {
      const moves = [];
      const us    = this.side;
      const board = this.board;
      for (let sq = 0; sq < 128; sq++) {
        if (!onBoard(sq)) { sq += 7; continue; }
        const p = board[sq];
        if (!p) continue;
        if (us === WHITE ? !isWhite(p) : !isBlack(p)) continue;
        if (p === WP || p === BP) {
          this._genPawnMoves(sq, p, us, moves, capturesOnly);
          continue;
        }
        if (p === WN || p === BN) {
          for (const d of KNIGHT_DIR) {
            const to = sq + d;
            if (!onBoard(to)) continue;
            const tp = board[to];
            if (!tp) { if (!capturesOnly) moves.push(this._mk(sq,to,p,EMPTY,0,0)); }
            else if (colorOf(tp) !== us) moves.push(this._mk(sq,to,p,tp,0,FLAG_CAPTURE));
          }
          continue;
        }
        if (p === WB || p === BB) { this._addSlider(sq,p,us,BISHOP_DIR,moves,capturesOnly); continue; }
        if (p === WR || p === BR) { this._addSlider(sq,p,us,ROOK_DIR,  moves,capturesOnly); continue; }
        if (p === WQ || p === BQ) {
          this._addSlider(sq,p,us,BISHOP_DIR,moves,capturesOnly);
          this._addSlider(sq,p,us,ROOK_DIR,  moves,capturesOnly);
          continue;
        }
        if (p === WK || p === BK) { this._genKingMoves(sq,p,us,moves,capturesOnly); }
      }
      const legal = [];
      for (const m of moves) {
        this.makeMove(m);
        if (!this.inCheck(us)) legal.push(m);
        this.undoMove();
      }
      return legal;
    }

    _mk(from,to,piece,capture,promo,flags) {
      return {from,to,piece,capture,promo,flags};
    }

    _genPawnMoves(sq,p,us,moves,capturesOnly) {
      const board   = this.board;
      const up      = p===WP ? 16 : -16;
      const rank    = sq >> 4;
      const sRank   = p===WP ? 1 : 6;
      const pRank   = p===WP ? 6 : 1;
      const promos  = p===WP ? [WQ,WR,WB,WN] : [BQ,BR,BB,BN];
      const capDirs = p===WP ? [15,17] : [-15,-17];
      if (!capturesOnly) {
        const one = sq + up;
        if (onBoard(one) && !board[one]) {
          if (rank === pRank) {
            for (const pr of promos) moves.push(this._mk(sq,one,p,EMPTY,pr,FLAG_PROMO));
          } else {
            moves.push(this._mk(sq,one,p,EMPTY,0,0));
            if (rank === sRank) {
              const two = sq + up + up;
              if (!board[two]) moves.push(this._mk(sq,two,p,EMPTY,0,0));
            }
          }
        }
      }
      for (const d of capDirs) {
        const to = sq + d;
        if (!onBoard(to)) continue;
        const tp = board[to];
        if (tp && colorOf(tp) !== us) {
          if (rank === pRank) {
            for (const pr of promos) moves.push(this._mk(sq,to,p,tp,pr,FLAG_CAPTURE|FLAG_PROMO));
          } else {
            moves.push(this._mk(sq,to,p,tp,0,FLAG_CAPTURE));
          }
        }
        if (to === this.ep) {
          const epCap = p===WP ? BP : WP;
          moves.push(this._mk(sq,to,p,epCap,0,FLAG_CAPTURE|FLAG_EP));
        }
      }
    }

    _addSlider(sq,p,us,dirs,moves,capturesOnly) {
      const board = this.board;
      for (const d of dirs) {
        let to = sq + d;
        while (onBoard(to)) {
          const tp = board[to];
          if (!tp) {
            if (!capturesOnly) moves.push(this._mk(sq,to,p,EMPTY,0,0));
          } else {
            if (colorOf(tp) !== us) moves.push(this._mk(sq,to,p,tp,0,FLAG_CAPTURE));
            break;
          }
          to += d;
        }
      }
    }

    _genKingMoves(sq,p,us,moves,capturesOnly) {
      const board = this.board;
      const opp   = opponent(us);
      for (const d of KING_DIR) {
        const to = sq + d;
        if (!onBoard(to)) continue;
        const tp = board[to];
        if (!tp) { if (!capturesOnly) moves.push(this._mk(sq,to,p,EMPTY,0,0)); }
        else if (colorOf(tp) !== us) moves.push(this._mk(sq,to,p,tp,0,FLAG_CAPTURE));
      }
      if (capturesOnly) return;
      const inChk = this.inCheck(us);
      if (!inChk) {
        if (us === WHITE && sq === SQ['e1']) {
          if ((this.castle&1) && board[SQ['h1']] === WR && !board[SQ['f1']]&&!board[SQ['g1']]&&
              !this.isAttacked(SQ['f1'],opp)&&!this.isAttacked(SQ['g1'],opp))
            moves.push(this._mk(sq,SQ['g1'],p,EMPTY,0,FLAG_CASTLE));
          if ((this.castle&2) && board[SQ['a1']] === WR && !board[SQ['d1']]&&!board[SQ['c1']]&&!board[SQ['b1']]&&
              !this.isAttacked(SQ['d1'],opp)&&!this.isAttacked(SQ['c1'],opp))
            moves.push(this._mk(sq,SQ['c1'],p,EMPTY,0,FLAG_CASTLE));
        }
        if (us === BLACK && sq === SQ['e8']) {
          if ((this.castle&4) && board[SQ['h8']] === BR && !board[SQ['f8']]&&!board[SQ['g8']]&&
              !this.isAttacked(SQ['f8'],opp)&&!this.isAttacked(SQ['g8'],opp))
            moves.push(this._mk(sq,SQ['g8'],p,EMPTY,0,FLAG_CASTLE));
          if ((this.castle&8) && board[SQ['a8']] === BR && !board[SQ['d8']]&&!board[SQ['c8']]&&!board[SQ['b8']]&&
              !this.isAttacked(SQ['d8'],opp)&&!this.isAttacked(SQ['c8'],opp))
            moves.push(this._mk(sq,SQ['c8'],p,EMPTY,0,FLAG_CASTLE));
        }
      }
    }

    moveToUci(m) {
      if (!m) return '0000';
      const base = sqToUci(m.from) + sqToUci(m.to);
      return (m.flags & FLAG_PROMO) ? base + (PIECE_CH[m.promo]||'q').toLowerCase() : base;
    }

    // Safety fallback so the engine does not return 0000 on recoverable errors.
    getEmergencyMoveUci() {
      const moves = this.genMoves(false);
      if (!moves.length) return '0000';
      return this.moveToUci(moves[0]);
    }

    moveToSan(m) {
      if (!m) return '0000';
      if (m.flags & FLAG_CASTLE) {
        return (m.to === SQ['g1'] || m.to === SQ['g8']) ? 'O-O' : 'O-O-O';
      }
      const piece = m.piece;
      const toSq = sqToUci(m.to);
      const isCapture = !!(m.flags & (FLAG_CAPTURE | FLAG_EP));
      let san = '';
      if (piece === WP || piece === BP) {
        if (isCapture) san += FILES[m.from & 7] + 'x';
        san += toSq;
      } else {
        san += (PIECE_CH[piece] || '').toUpperCase();
        const moves = this.genMoves(false);
        const same = moves.filter((x) =>
          x.to === m.to && x.piece === m.piece &&
          !(x.from === m.from && (x.promo || 0) === (m.promo || 0)));
        if (same.length) {
          const fromFile = m.from & 7;
          const fromRank = m.from >> 4;
          let fileConflict = false;
          let rankConflict = false;
          for (const x of same) {
            if ((x.from & 7) === fromFile) fileConflict = true;
            if ((x.from >> 4) === fromRank) rankConflict = true;
          }
          if (!fileConflict) san += FILES[fromFile];
          else if (!rankConflict) san += String(fromRank + 1);
          else san += FILES[fromFile] + String(fromRank + 1);
        }
        if (isCapture) san += 'x';
        san += toSq;
      }
      if (m.flags & FLAG_PROMO) san += '=' + (PIECE_CH[m.promo] || 'Q').toUpperCase();
      this.makeMove(m);
      const inCheck = this.inCheck(this.side);
      if (inCheck) san += this.genMoves(false).length ? '+' : '#';
      this.undoMove();
      return san;
    }

    formatMove(m, fmt = 'uci') {
      return fmt === 'san' ? this.moveToSan(m) : this.moveToUci(m);
    }

    findMoveByUci(uci) {
      const moves = this.genMoves(false);
      for (const m of moves) {
        if (this.moveToUci(m) === uci) return m;
        if ((m.flags & FLAG_PROMO) && uci.length === 4 && this.moveToUci(m).slice(0,4) === uci) return m;
      }
      return null;
    }

    findMoveByEncoded(enc) {
      if (!enc) return null;
      const dec = TranspositionTable.decodeMove(enc);
      if (!dec) return null;
      const moves = this.genMoves(false);
      for (const m of moves) {
        if (m.from === dec.from && m.to === dec.to &&
           (m.promo || 0) === (dec.promo || 0)) return m;
      }
      return null;
    }

    sq128To64(sq) { return ((sq >> 4) << 3) | (sq & 7); }
    mirror64(i)   { return ((7-(i>>3))<<3)|(i&7); }

    _pst(p, sq) {
      const i = this.sq128To64(sq);
      const j = isWhite(p) ? i : this.mirror64(i);
      if (p===WP||p===BP) return PST_PAWN[j];
      if (p===WN||p===BN) return PST_KNIGHT[j];
      if (p===WB||p===BB) return PST_BISHOP[j];
      if (p===WR||p===BR) return PST_ROOK[j];
      if (p===WQ||p===BQ) return PST_QUEEN[j];
      if (p===WK||p===BK) return PST_KING_MG[j];
      return 0;
    }

    _pawnStructure(whiteFiles, blackFiles, wpSquares, bpSquares) {
      let mg = 0, eg = 0;
      const board = this.board;
      const passedBonus = [0,0,0,0,0.1,0.3,0.7,1.2,0];
      for (let f = 0; f < 8; f++) {
        if (whiteFiles[f] > 1) { mg -= 11*(whiteFiles[f]-1); eg -= 3*(whiteFiles[f]-1); }
        if (blackFiles[f] > 1) { mg += 11*(blackFiles[f]-1); eg += 3*(blackFiles[f]-1); }
        if (whiteFiles[f] && (f === 0 ? whiteFiles[1] === 0 : (f === 7 ? whiteFiles[6] === 0 : whiteFiles[f-1]===0 && whiteFiles[f+1]===0))) {
          mg -= 13 * whiteFiles[f]; eg -= 12 * whiteFiles[f];
        }
        if (blackFiles[f] && (f === 0 ? blackFiles[1] === 0 : (f === 7 ? blackFiles[6] === 0 : blackFiles[f-1]===0 && blackFiles[f+1]===0))) {
          mg += 13 * blackFiles[f]; eg += 12 * blackFiles[f];
        }
      }
      for (const sq of wpSquares) {
        const f = sq & 7;
        const r = sq >> 4;
        let passed = true;
        for (let rr = r + 1; rr < 8 && passed; rr++) {
          for (let ff = Math.max(0, f - 1); ff <= Math.min(7, f + 1); ff++) {
            if (board[(rr << 4) | ff] === BP) { passed = false; break; }
          }
        }
        if (passed) {
          const adv = passedBonus[r + 1] || 0;
          mg += Math.round(25 + 8 * adv);
          eg += Math.round(35 + 78 * adv);
        }
        if ((onBoard(sq - 15) && board[sq - 15] === WP) || (onBoard(sq - 17) && board[sq - 17] === WP)) {
          mg += 8; eg += 8;
        }
      }
      for (const sq of bpSquares) {
        const f = sq & 7;
        const r = sq >> 4;
        let passed = true;
        for (let rr = r - 1; rr >= 0 && passed; rr--) {
          for (let ff = Math.max(0, f - 1); ff <= Math.min(7, f + 1); ff++) {
            if (board[(rr << 4) | ff] === WP) { passed = false; break; }
          }
        }
        if (passed) {
          const adv = passedBonus[8 - r] || 0;
          mg -= Math.round(25 + 8 * adv);
          eg -= Math.round(35 + 78 * adv);
        }
        if ((onBoard(sq + 15) && board[sq + 15] === BP) || (onBoard(sq + 17) && board[sq + 17] === BP)) {
          mg -= 8; eg -= 8;
        }
      }
      return { mg, eg, whiteFiles, blackFiles };
    }

    _inKingZone(sq, kingSq) {
      const rf = Math.abs((sq & 7) - (kingSq & 7));
      const rr = Math.abs((sq >> 4) - (kingSq >> 4));
      return rf <= 1 && rr <= 1;
    }

    _activityEval(whiteKingSq, blackKingSq, whiteFiles, blackFiles) {
      let mg = 0, eg = 0;
      let wAttackN = 0, wAttackV = 0, bAttackN = 0, bAttackV = 0;
      const board = this.board;
      const addSlider = (sq, dirs) => {
        let mob = 0, tight = 0, tense = 0, zoneHit = 0;
        for (const d of dirs) {
          let to = sq + d;
          while (onBoard(to)) {
            const tp = board[to];
            const inZone = this._inKingZone(to, this.side === WHITE ? blackKingSq : whiteKingSq);
            if (!tp) { mob++; if (inZone) zoneHit = 1; to += d; continue; }
            if (colorOf(tp) !== this.side) { mob++; tense++; if (inZone) zoneHit = 1; }
            else { tight++; }
            break;
          }
        }
        return { mob, tight, tense, zoneHit };
      };
      for (let sq = 0; sq < 128; sq++) {
        if (!onBoard(sq)) { sq += 7; continue; }
        const p = board[sq];
        if (!p || p === WP || p === BP || p === WK || p === BK) continue;
        const us = colorOf(p);
        const rank = sq >> 4;
        let mob = 0, tight = 0, tense = 0, zoneHit = 0;
        if (p === WN || p === BN) {
          for (const d of KNIGHT_DIR) {
            const to = sq + d;
            if (!onBoard(to)) continue;
            const tp = board[to];
            if (!tp) mob++;
            else if (colorOf(tp) !== us) { mob++; tense++; } else tight++;
            if (this._inKingZone(to, us === WHITE ? blackKingSq : whiteKingSq)) zoneHit = 1;
          }
          const s = mob ? mob * MOBN_S : MOBN_S0;
          const e = mob ? mob * MOBN_E : MOBN_E0;
          if (us === WHITE) { mg += s + tight*TIGHT_NS + tense*TENSE_NS; eg += e + tight*TIGHT_NE + tense*TENSE_NE; if (zoneHit) { wAttackN++; wAttackV += ATT_N; } }
          else { mg -= s + tight*TIGHT_NS + tense*TENSE_NS; eg -= e + tight*TIGHT_NE + tense*TENSE_NE; if (zoneHit) { bAttackN++; bAttackV += ATT_N; } }
          continue;
        }
        if (p === WB || p === BB) {
          ({ mob, tight, tense, zoneHit } = addSlider(sq, BISHOP_DIR));
          const s = mob ? mob * MOBB_S : MOBB_S0;
          const e = mob ? mob * MOBB_E : MOBB_E0;
          if (us === WHITE) { mg += s + tight*TIGHT_BS + tense*TENSE_BS; eg += e + tight*TIGHT_BE + tense*TENSE_BE; if (zoneHit) { wAttackN++; wAttackV += ATT_B; } }
          else { mg -= s + tight*TIGHT_BS + tense*TENSE_BS; eg -= e + tight*TIGHT_BE + tense*TENSE_BE; if (zoneHit) { bAttackN++; bAttackV += ATT_B; } }
          continue;
        }
        if (p === WR || p === BR) {
          ({ mob, tight, tense, zoneHit } = addSlider(sq, ROOK_DIR));
          const s = mob ? mob * MOBR_S : MOBR_S0;
          const e = mob ? mob * MOBR_E : MOBR_E0;
          if (us === WHITE) { mg += s + tight*TIGHT_RS + tense*TENSE_RS; eg += e + tight*TIGHT_RE + tense*TENSE_RE; if (zoneHit) { wAttackN++; wAttackV += ATT_R; } }
          else { mg -= s + tight*TIGHT_RS + tense*TENSE_RS; eg -= e + tight*TIGHT_RE + tense*TENSE_RE; if (zoneHit) { bAttackN++; bAttackV += ATT_R; } }
          continue;
        }
        if (p === WQ || p === BQ) {
          const a = addSlider(sq, BISHOP_DIR);
          const bq = addSlider(sq, ROOK_DIR);
          mob = a.mob + bq.mob; tight = a.tight + bq.tight; tense = a.tense + bq.tense; zoneHit = a.zoneHit || bq.zoneHit ? 1 : 0;
          const s = mob ? mob * MOBQ_S : MOBQ_S0;
          const e = mob ? mob * MOBQ_E : MOBQ_E0;
          if (us === WHITE) { mg += s + tight*TIGHT_QS + tense*TENSE_QS; eg += e + tight*TIGHT_QE + tense*TENSE_QE; if (zoneHit) { wAttackN++; wAttackV += ATT_Q; } }
          else { mg -= s + tight*TIGHT_QS + tense*TENSE_QS; eg -= e + tight*TIGHT_QE + tense*TENSE_QE; if (zoneHit) { bAttackN++; bAttackV += ATT_Q; } }
        }
      }
      return { mg, eg, wAttackN, wAttackV, bAttackN, bAttackV };
    }

    evaluate() {
      if (this.isInsufficientMaterial()) return 0;
      let mgScore = 0, egScore = 0, phase = 0;
      let whiteBishops = 0, blackBishops = 0;
      const whiteFiles = new Int8Array(8);
      const blackFiles = new Int8Array(8);
      const wpSquares = [], bpSquares = [];
      const board = this.board;
      for (let sq = 0; sq < 128; sq++) {
        if (!onBoard(sq)) { sq += 7; continue; }
        const p = board[sq];
        if (!p) continue;
        const mat = PIECE_VALUE[p] || 0;
        const pstMg = this._pst(p, sq);
        const i = this.sq128To64(sq);
        const j = isWhite(p) ? i : this.mirror64(i);
        const pstEg = (p === WK || p === BK) ? PST_KING_EG[j] : pstMg;
        if (isWhite(p)) {
          mgScore += mat + pstMg;
          egScore += mat + pstEg;
          if (p === WB) whiteBishops++;
          if (p === WP) { whiteFiles[sq & 7]++; wpSquares.push(sq); }
        } else {
          mgScore -= mat + pstMg;
          egScore -= mat + pstEg;
          if (p === BB) blackBishops++;
          if (p === BP) { blackFiles[sq & 7]++; bpSquares.push(sq); }
        }
        phase += PHASE_WEIGHT[p] || 0;
      }
      if (whiteBishops >= 2) { mgScore += TWOBISHOPS_S; egScore += TWOBISHOPS_E; }
      if (blackBishops >= 2) { mgScore -= TWOBISHOPS_S; egScore -= TWOBISHOPS_E; }
      const pawnStruct = this._pawnStructure(whiteFiles, blackFiles, wpSquares, bpSquares);
      mgScore += pawnStruct.mg;
      egScore += pawnStruct.eg;
      const activity = this._activityEval(this.kingPos[WHITE], this.kingPos[BLACK], pawnStruct.whiteFiles, pawnStruct.blackFiles);
      mgScore += activity.mg;
      egScore += activity.eg;
      const phaseClamped = Math.max(0, Math.min(MAX_PHASE, phase));
      let score = Math.round((mgScore * phaseClamped + egScore * (MAX_PHASE - phaseClamped)) / MAX_PHASE);
      if (this.inCheck(this.side)) {
        score += this.side === WHITE ? -20 : 20;
      }
      score += this.side === WHITE ? 10 : -10;
      return this.side === WHITE ? score : -score;
    }

    _attacksSquareOnOcc(from, to, piece, occ) {
      const board = this.board, type = piece & 7;
      if (type === 1) {
        if (isWhite(piece)) return from + 15 === to || from + 17 === to;
        return from - 15 === to || from - 17 === to;
      }
      if (type === 2) {
        for (const d of KNIGHT_DIR) {
          if (from + d === to) return true;
        }
        return false;
      }
      if (type === 3 || type === 5) {
        for (const d of BISHOP_DIR) {
          let sq = from + d;
          while (onBoard(sq)) { if (sq === to) return true; if (occ[sq] !== EMPTY) break; sq += d; }
        }
        if (type === 3) return false;
      }
      if (type === 4 || type === 5) {
        for (const d of ROOK_DIR) {
          let sq = from + d;
          while (onBoard(sq)) { if (sq === to) return true; if (occ[sq] !== EMPTY) break; sq += d; }
        }
        if (type === 4) return false;
      }
      if (type === 6) {
        for (const d of KING_DIR) {
          if (from + d === to) return true;
        }
      }
      return false;
    }

    _leastValuableAttacker(to, side, occ) {
      let bestSq = -1, bestPiece = EMPTY, bestVal = INF;
      for (let sq = 0; sq < 128; sq++) {
        if (!onBoard(sq)) { sq += 7; continue; }
        const p = occ[sq];
        if (!p || colorOf(p) !== side || !this._attacksSquareOnOcc(sq, to, p, occ)) continue;
        const v = PIECE_VALUE[p] || 0;
        if (v < bestVal) { bestVal = v; bestSq = sq; bestPiece = p; }
      }
      return bestSq === -1 ? null : { sq: bestSq, piece: bestPiece };
    }

    see(m) {
      if (!(m.flags & FLAG_CAPTURE)) return 0;
      const occ = new Uint8Array(128);
      occ.set(this.board);
      const from = m.from, to = m.to;
      const movedPiece = m.piece, placedPiece = m.promo || movedPiece;
      let capturedValue = PIECE_VALUE[m.capture] || 0;
      if (m.flags & FLAG_EP) capturedValue = PIECE_VALUE[isWhite(m.piece) ? BP : WP];
      const gain = new Int16Array(32);
      gain[0] = capturedValue;
      occ[from] = EMPTY;
      if (m.flags & FLAG_EP) {
        const capSq = isWhite(m.piece) ? to - 16 : to + 16;
        occ[capSq] = EMPTY;
      }
      occ[to] = placedPiece;
      let depth = 0, side = opponent(this.side);
      while (true) {
        const att = this._leastValuableAttacker(to, side, occ);
        if (!att) break;
        depth++;
        gain[depth] = (PIECE_VALUE[att.piece] || 0) - gain[depth - 1];
        occ[att.sq] = EMPTY;
        side = opponent(side);
      }
      while (--depth > -1) gain[depth] = -Math.max(-gain[depth], gain[depth + 1]);
      return gain[0];
    }

    _moveScore(m, ttBestEnc, ply) {
      const enc = TranspositionTable.encodeMove(m);
      if (enc === ttBestEnc) return 2000000;
      if (m.flags & FLAG_CAPTURE) {
        const victim = (m.capture & 7) || 0;
        const attacker = (m.piece & 7) || 0;
        const mvv = MVV_LVA[victim][attacker] || 0;
        const see = m._see || 0;
        const movingQueen = m.piece === WQ || m.piece === BQ;
        if (movingQueen && victim !== 5 && see < 300) return 120000 + mvv + see;
        if (see < 0) return 250000 + mvv + see;
        return 1500000 + mvv + Math.min(200, see);
      }
      if (m.flags & FLAG_PROMO) return 1100000 + ((m.promo & 7) || 0);
      const killers = this.killers[ply] || [];
      if (enc === killers[0]) return 800000;
      if (enc === killers[1]) return 700000;
      const prev = this.history[this.history.length - 1];
      const prevIdx = prev && prev.piece > 0 ? (prev.piece << 7) | prev.to : -1;
      if (prevIdx >= 0) {
        const cm = this.counterMoves[prevIdx];
        if (enc === cm) return 900000;
      }
      let quiet = (this.histTable[(m.piece << 7) | m.to] | 0);
      if (prevIdx >= 0) {
        const curIdx = (m.piece << 7) | m.to;
        quiet += this.contHist[prevIdx * (15 * 128) + curIdx] | 0;
      }
      if (m.piece === WQ || m.piece === BQ) {
        const them = opponent(this.side);
        if (this.isAttacked(m.to, them)) quiet -= 300;
        if (this.isSquareAttackedByPawn(m.to, them)) quiet -= 250;
      }
      return quiet;
    }

    scoreMoves(moves, ttBestEnc, ply) {
      for (const m of moves) {
        if (m.flags & FLAG_CAPTURE) {
          const victimVal = PIECE_VALUE[m.capture] || 0;
          const attackerVal = PIECE_VALUE[m.piece] || 0;
          m._see = victimVal >= attackerVal ? (victimVal - attackerVal) : this.see(m);
        } else {
          m._see = 0;
        }
        m._score = this._moveScore(m, ttBestEnc, ply);
      }
    }

    pickNextMove(moves, startIdx) {
      let bestIdx = startIdx, bestScore = moves[startIdx]._score;
      for (let i = startIdx + 1; i < moves.length; i++) {
        const s = moves[i]._score;
        if (s > bestScore) { bestScore = s; bestIdx = i; }
      }
      if (bestIdx !== startIdx) {
        const tmp = moves[startIdx];
        moves[startIdx] = moves[bestIdx];
        moves[bestIdx] = tmp;
      }
      return moves[startIdx];
    }

    storeKiller(m, ply) {
      const enc = TranspositionTable.encodeMove(m);
      const k = this.killers[ply];
      if (enc !== k[0]) { k[1] = k[0]; k[0] = enc; }
    }

    isKillerMove(m, ply) {
      const enc = TranspositionTable.encodeMove(m);
      const k = this.killers[ply] || [0, 0];
      return enc === k[0] || enc === k[1];
    }

    updateHistory(m, depth) {
      const idx = (m.piece << 7) | m.to;
      this.histTable[idx] = Math.min(this.histTable[idx] + depth * depth, 20000);
      const prev = this.history[this.history.length - 1];
      if (!prev || prev.from < 0 || !prev.piece) return;
      const prevIdx = (prev.piece << 7) | prev.to;
      const cidx = prevIdx * (15 * 128) + idx;
      this.contHist[cidx] = Math.max(-20000, Math.min(20000, (this.contHist[cidx] | 0) + depth * depth));
      this.counterMoves[prevIdx] = TranspositionTable.encodeMove(m);
    }

    hasNonPawnMaterial(color) {
      const lo = color === WHITE ? WN : BN;
      const hi = color === WHITE ? WQ : BQ;
      for (let sq=0;sq<128;sq++) {
        if (!onBoard(sq)){sq+=7;continue;}
        const p=this.board[sq];
        if (p>=lo&&p<=hi) return true;
      }
      return false;
    }

    qsearch(alpha, beta, ply) {
      if (this.stop) return alpha;
      this._checkTime();
      if (this.stop) return alpha;
      if (this.isDraw()||this.isInsufficientMaterial()) return 0;
      if (this.selDepthHard > 0 && ply >= this.selDepthHard) return this.evaluate();
      this.nodes++;
      this.selDepth = Math.max(this.selDepth, ply);
      if (ply >= 120) return this.evaluate();
      const inChk = this.inCheck(this.side);
      if (inChk) {
        const evasions = this.genMoves(false);
        if (evasions.length === 0) return -MATE + ply;
        const ttBest = this.tt.getBestMove(this.hash);
        this.scoreMoves(evasions, ttBest, ply);
        for (let i = 0; i < evasions.length; i++) {
          const m = this.pickNextMove(evasions, i);
          this.makeMove(m);
          const score = -this.qsearch(-beta, -alpha, ply + 1);
          this.undoMove();
          if (this.stop) return alpha;
          if (score >= beta) return beta;
          if (score > alpha) alpha = score;
        }
        return alpha;
      }
      const stand = this.evaluate();
      if (stand >= beta) return beta;
      if (stand > alpha) alpha = stand;
      const moves = this.genMoves(true);
      const ttBest = this.tt.getBestMove(this.hash);
      this.scoreMoves(moves, ttBest, ply);
      for (let i = 0; i < moves.length; i++) {
        const m = this.pickNextMove(moves, i);
        const gain = (PIECE_VALUE[m.capture]||0) + (m.promo ? PIECE_VALUE[m.promo]||0 : 0);
        if (stand + gain + 200 < alpha) continue;
        if ((m.flags & FLAG_CAPTURE) && !(m.flags & FLAG_PROMO) && (m._see || 0) < 0) continue;
        this.makeMove(m);
        const score = -this.qsearch(-beta, -alpha, ply+1);
        this.undoMove();
        if (this.stop) return alpha;
        if (score >= beta) return beta;
        if (score > alpha) alpha = score;
      }
      return alpha;
    }

    negamax(depth, alpha, beta, ply, allowNull = true) {
      if (this.stop) return 0;
      this._checkTime();
      if (this.stop) return 0;
      if (this.selDepthHard > 0 && ply >= this.selDepthHard) return this.evaluate();
      const isPV = beta - alpha > 1;
      this.nodes++;
      this.selDepth = Math.max(this.selDepth, ply);
      if (this.isDraw()||this.isInsufficientMaterial()) return 0;
      const inChk = this.inCheck(this.side);
      if (inChk) depth++;
      if (depth <= 0) return this.qsearch(alpha, beta, ply);
      const mateVal = MATE - ply;
      if (alpha < -mateVal) alpha = -mateVal;
      if (beta > mateVal) beta = mateVal;
      if (alpha >= beta) return alpha;
      const ttScore = this.tt.probe(this.hash, depth, alpha, beta);
      if (!isPV && ttScore !== null) return ttScore;
      const ttBestEnc = this.tt.getBestMove(this.hash);
      let staticEval = 0;
      if (!inChk) staticEval = this.evaluate();
      this.evalTrace[ply] = inChk ? this.evalTrace[Math.max(0, ply - 2)] : staticEval;
      const improving = !inChk && ply >= 2 && staticEval > this.evalTrace[ply - 2];
      if (!isPV && !inChk && depth <= 4) {
        const margin = 120 * depth;
        if (staticEval - margin >= beta) return staticEval - margin;
      }
      if (allowNull && !isPV && depth >= 3 && !inChk && this.hasNonPawnMaterial(this.side)) {
        const R = depth >= 6 ? 4 : 3;
        this.makeNullMove();
        const nmScore = -this.negamax(depth - 1 - R, -beta, -beta+1, ply+1, false);
        this.undoNullMove();
        if (this.stop) return 0;
        if (nmScore >= beta) return beta;
      }
      if (!isPV && !inChk && depth <= 3) {
        const razor = staticEval + 400 * depth;
        if (razor < alpha) {
          const q = this.qsearch(alpha, beta, ply);
          if (q < alpha) return alpha;
        }
      }
      const moves = this.genMoves(false);
      if (moves.length === 0) return inChk ? -MATE + ply : 0;
      this.scoreMoves(moves, ttBestEnc, ply);
      const alpha0 = alpha;
      let bestScore = -INF, bestMove = null, legalIdx = 0, moveTried = 0;
      let fallbackQueen = null;
      for (let i = 0; i < moves.length; i++) {
        const m = this.pickNextMove(moves, i);
        moveTried++;
        const quietMove = (m.flags & (FLAG_CAPTURE | FLAG_PROMO | FLAG_EP)) === 0;
        const killerMove = quietMove && this.isKillerMove(m, ply);
        
        // ── QUEEN SAFETY FILTER IN INTERNAL SEARCH ──
        if (!this.queenMoveAllowedByPolicy(m, depth, false)) {
          if (!fallbackQueen) fallbackQueen = m;
          continue;
        }
        
        if (!isPV && !inChk && quietMove && depth <= 4) {
          const limit = depth === 1 ? 4 : (depth === 2 ? 7 : (depth === 3 ? 11 : 16));
          if (moveTried >= limit) continue;
        }
        if (!isPV && !inChk && quietMove && depth <= 3) {
          const futMargin = 160 * depth;
          if (staticEval + futMargin <= alpha) continue;
        }
        this.makeMove(m);
        const givesCheck = this.inCheck(this.side);
        let score;
        const isSingular = !isPV && !inChk && depth >= 7 && ttBestEnc && (TranspositionTable.encodeMove(m)===ttBestEnc) && legalIdx===0;
        let extension = isSingular ? 1 : 0;
        if (legalIdx === 0) {
          score = -this.negamax(depth - 1 + extension, -beta, -alpha, ply+1, true);
        } else {
          let reduction = 0;
          if (!isPV && depth >= 3 && legalIdx >= 3 && !inChk && quietMove && !givesCheck && !killerMove) {
            const dTerm = Math.floor(Math.log2(Math.max(2, depth)) * 2.2);
            const mTerm = Math.floor(Math.log2(legalIdx + 1));
            reduction = Math.max(1, Math.floor((dTerm * mTerm) / 2.5));
            if (improving) reduction = Math.max(1, reduction - 1);
            reduction = Math.min(reduction, depth - 2);
          }
          const newDepth = depth - 1 - reduction + extension;
          score = -this.negamax(newDepth, -alpha-1, -alpha, ply+1, true);
          if (!this.stop && reduction > 0 && score > alpha) {
            score = -this.negamax(depth - 1 + extension, -alpha-1, -alpha, ply+1, true);
          }
          if (!this.stop && score > alpha && score < beta) {
            score = -this.negamax(depth - 1 + extension, -beta, -alpha, ply+1, true);
          }
        }
        this.undoMove();
        if (this.stop) return 0;
        legalIdx++;
        if (score > bestScore) { bestScore = score; bestMove = m; }
        if (score > alpha) {
          alpha = score;
          if (alpha >= beta) {
            if (!(m.flags & FLAG_CAPTURE)) {
              this.storeKiller(m, ply);
              this.updateHistory(m, depth);
            }
            break;
          }
        }
      }

      // Never return an empty branch when queen guard filtered all moves.
      if (legalIdx === 0 && fallbackQueen) {
        this.makeMove(fallbackQueen);
        const fbScore = -this.negamax(depth - 1, -beta, -alpha, ply + 1, true);
        this.undoMove();
        bestScore = fbScore;
        bestMove = fallbackQueen;
        legalIdx = 1;
      }

      if (legalIdx === 0) return inChk ? -MATE + ply : this.evaluate();

      let flag = 0;
      if (bestScore <= alpha0) flag = -1;
      else if (bestScore >= beta) flag = 1;
      this.tt.store(this.hash, depth, bestScore, flag, TranspositionTable.encodeMove(bestMove));
      return bestScore;
    }

    _checkTime() {
      if ((this.nodes & 2047) === 0) {
        if (this.moveTime > 0 && Date.now() - this.startTime >= this.moveTime) this.stop = true;
        if (this.maxNodes > 0 && this.nodes >= this.maxNodes) this.stop = true;
      }
    }

    _resolveSearchStrength(spec) {
      let skill = Math.max(0, Math.min(20, this.options.SkillLevel | 0));
      let depthCap = 64;
      let nodeCap = Math.max(0, spec.maxNodes | 0);
      if (this.options.UCI_LimitStrength) {
        const e = Math.max(800, Math.min(2800, this.options.UCI_Elo | 0));
        const t = (e - 800) / 2000;
        skill = Math.max(0, Math.min(20, Math.round(t * 20)));
        depthCap = Math.max(1, Math.min(64, Math.round(2 + t * 16)));
        nodeCap = nodeCap > 0 ? Math.min(nodeCap, Math.round(1500 + t * t * 800000)) : Math.round(1500 + t * t * 800000);
      } else if (skill < 20) {
        const t = skill / 20;
        depthCap = Math.min(depthCap, Math.max(2, Math.round(2 + t * 14)));
        nodeCap = nodeCap > 0 ? Math.min(nodeCap, Math.round(2500 + t * t * 600000)) : Math.round(2500 + t * t * 600000);
      }
      return { skill, depthCap, nodeCap };
    }

    calcMoveTime(spec) {
      if (spec.moveTime) return Math.max(1, spec.moveTime - this.options.MoveOverhead);
      const t = this.side === WHITE ? (spec.wtime||0) : (spec.btime||0);
      const inc = this.side === WHITE ? (spec.winc||0) : (spec.binc||0);
      const mtg = spec.movestogo || 30;
      if (!t) return 5000;
      const overhead = this.options.MoveOverhead | 0;
      const base = t / Math.max(12, mtg + 4) + inc * 0.45;
      const emergency = t < 10000 ? t * 0.07 : t * 0.03;
      let alloc = Math.max(base, emergency) - overhead;
      const hardCap = t < 3000 ? t * 0.18 : (t < 10000 ? t * 0.15 : t * 0.12);
      alloc = Math.min(alloc, hardCap);
      return Math.max(1, Math.floor(alloc));
    }

    describeScore(score) {
      if (Math.abs(score) >= MATE - 200) {
        const mate = score > 0 ? Math.ceil((MATE - score) / 2) : -Math.ceil((MATE + score) / 2);
        return { units: 'mate', value: mate };
      }
      return { units: 'cp', value: score | 0 };
    }

    scoreToWDL(score) {
      if (score >= MATE - 200) return { win: 1000, draw: 0, loss: 0 };
      if (score <= -MATE + 200) return { win: 0, draw: 0, loss: 1000 };
      const draw = Math.max(0, Math.min(1000, Math.round(220 * Math.exp(-Math.abs(score) / 280))));
      const decisive = Math.max(0, 1000 - draw);
      const winRatio = 1 / (1 + Math.exp(-score / 180));
      const win = Math.round(decisive * winRatio);
      const loss = decisive - win;
      return { win, draw, loss };
    }

    estimateACPL(rootLines) {
      if (!rootLines || rootLines.length < 2) return 0;
      const best = rootLines[0].score;
      if (Math.abs(best) >= MATE - 200) return 0;
      let total = 0, count = 0;
      for (let i = 1; i < rootLines.length; i++) {
        const s = rootLines[i].score;
        if (Math.abs(s) >= MATE - 200) continue;
        total += Math.max(0, best - s);
        count++;
      }
      return count ? Math.round(total / count) : 0;
    }

    getPonderMove(rootLines) {
      if (!rootLines || !rootLines.length || !rootLines[0].pv) return '';
      const pv = rootLines[0].pv.trim().split(/\s+/);
      return pv.length >= 2 ? pv[1] : '';
    }

    pickSkillMove(scoredMoves) {
      if (!scoredMoves || !scoredMoves.length) return null;
      const skill = Math.max(0, Math.min(20, this.effectiveSkillLevel | 0));
      if (skill >= 20 || scoredMoves.length === 1) return scoredMoves[0].m;
      const bestScore = scoredMoves[0].score;
      const maxDrop = 20 + (20 - skill) * 18;
      const maxCount = Math.min(scoredMoves.length, 2 + Math.floor((20 - skill) / 3));
      const candidates = [];
      for (let i = 0; i < maxCount; i++) {
        const line = scoredMoves[i];
        const gap = bestScore - line.score;
        if (gap <= maxDrop) candidates.push(line);
      }
      if (!candidates.length) return scoredMoves[0].m;
      const temp = Math.max(0.25, (20 - skill) / 8);
      const base = 35 + skill * 5;
      let total = 0;
      for (const c of candidates) {
        const gap = Math.max(0, bestScore - c.score);
        c._w = Math.exp(-(gap / base) * temp);
        total += c._w;
      }
      let r = Math.random() * total;
      for (const c of candidates) {
        r -= c._w;
        if (r <= 0) return c.m;
      }
      return candidates[0].m;
    }

    applyRootBlunderGuard(scoredMoves, depth) {
      if (!scoredMoves || !scoredMoves.length) return;
      for (const line of scoredMoves) line.pickScore = line.score;
      
      if (depth > 7) return; // Only apply guard at shallow depths
      
      const rawBest = scoredMoves[0].score;
      const ultraSafe = depth <= 5;
      let hasSafeAlt = false;
      
      for (const line of scoredMoves) {
        line._hardUnsafe = false;
        const m = line.m;
        const movingQueen = m.piece === WQ || m.piece === BQ;
        const movingPiece = m.promo || m.piece;
        const see = this.see(m);
        
        if (movingQueen) {
          const victimVal = PIECE_VALUE[m.capture] || 0;
          
          // BLUNDER GUARD: Don't trade queen for lesser without compensation
          if (m.flags & FLAG_CAPTURE && victimVal < 850) {
            const victimType = (m.capture & 7) || 0;
            const hardSee = ultraSafe ? 450 : 300;
            const hardGap = ultraSafe ? 35 : 50;
            
            // For queen-for-rook/minor/pawn, MUST be clearly worth it
            if (victimType !== 5) {
              if (see < hardSee || line.score < rawBest - hardGap) {
                line._hardUnsafe = true;
              }
              if (this.isAttacked(m.to, opponent(this.side)) && see < hardSee + 100) {
                line._hardUnsafe = true;
              }
            }
          } else if (!(m.flags & (FLAG_CAPTURE | FLAG_PROMO | FLAG_EP))) {
            // Quiet queen moves - don't move into danger
            const quietGap = ultraSafe ? 25 : 45;
            if (this.isAttacked(m.to, opponent(this.side)) && line.score < rawBest - quietGap) {
              line._hardUnsafe = true;
            }
            if (this.isSquareAttackedByPawn(m.to, opponent(this.side)) && line.score < rawBest - quietGap) {
              line._hardUnsafe = true;
            }
          }
        }
        
        if (!line._hardUnsafe) hasSafeAlt = true;
      }
      
      for (const line of scoredMoves) {
        let penalty = 0;
        const m = line.m;
        if (Math.abs(line.score) < MATE - 500) {
          const see = this.see(m);
          const movingPiece = m.promo || m.piece;
          
          // Strong penalties for risky queen moves
          if (movingPiece === WQ || movingPiece === BQ) {
            if ((m.flags & FLAG_CAPTURE) && (PIECE_VALUE[m.capture] || 0) < 850) {
              if (see <= -500) penalty += ultraSafe ? 500 : 300;
              else if (see <= -200) penalty += ultraSafe ? 250 : 150;
              else if (see < 200) penalty += ultraSafe ? 200 : 100;
            }
            
            if (!(m.flags & (FLAG_CAPTURE | FLAG_PROMO | FLAG_EP))) {
              const them = opponent(this.side);
              if (this.isAttacked(m.to, them)) penalty += ultraSafe ? 200 : 120;
              if (this.isSquareAttackedByPawn(m.to, them)) penalty += ultraSafe ? 300 : 180;
            }
          }
        }
        if (hasSafeAlt && line._hardUnsafe) penalty += ultraSafe ? 500000 : 300000;
        line.pickScore = line.score - penalty;
      }
      
      scoredMoves.sort((a, b) => {
        const d = (b.pickScore | 0) - (a.pickScore | 0);
        if (d !== 0) return d;
        return (b.score | 0) - (a.score | 0);
      });
    }

    sendRootInfo(rootLines, depth, elapsed, nps, hashfull, multiPV) {
      const limit = Math.min(multiPV, rootLines.length);
      for (let i = 0; i < limit; i++) {
        const line = rootLines[i];
        const score = this.describeScore(line.score);
        const parts = ['info', 'depth', depth, 'seldepth', this.selDepth, 'multipv', i + 1, 'score', score.units, score.value];
        if (this.options.UCI_ShowWDL) {
          const wdl = this.scoreToWDL(line.score);
          parts.push('wdl', wdl.win, wdl.draw, wdl.loss);
        }
        parts.push('nodes', this.nodes, 'nps', nps, 'hashfull', hashfull, 'time', elapsed, 'pv', line.pv);
        this.send(...parts);
      }
      if (this.options.UCI_ShowACPL) {
        this.send('info string acpl', this.estimateACPL(rootLines), 'depth', depth);
      }
      if (depth > 0) {
        const evalBar = Math.max(0, Math.min(100, 50 + Math.round(rootLines[0].score / 20)));
        this.send('info string evalbar', evalBar);
      }
    }

    pvLine(depth, fmt = 'uci') {
      const line = [], seen = new Set();
      for (let i = 0; i < depth; i++) {
        const enc = this.tt.getBestMove(this.hash);
        if (!enc) break;
        const m = this.findMoveByEncoded(enc);
        if (!m) break;
        const key = this.hash + ':' + enc;
        if (seen.has(key)) break;
        seen.add(key);
        line.push(this.formatMove(m, fmt));
        this.makeMove(m);
      }
      for (let i = 0; i < line.length; i++) this.undoMove();
      return line;
    }

    search(spec) {
      this.stop = false;
      this.nodes = 0;
      this.selDepth = 0;
      this.startTime = Date.now();
      this.moveTime = this.calcMoveTime(spec);
      this.selDepthHard = Math.max(0, spec.selDepth | 0);
      this.evalTrace.fill(0);
      this.tt.nextEpoch();
      const strength = this._resolveSearchStrength(spec);
      this.maxNodes = strength.nodeCap;
      this.effectiveSkillLevel = strength.skill;
      this.histTable.fill(0);
      this.contHist.fill(0);
      for (const k of this.killers) { k[0] = 0; k[1] = 0; }
      const depthLimit = Math.max(1, Math.min(strength.depthCap, Math.min(64, spec.depth || 64)));
      const multiPV = Math.max(1, Math.min(12, (spec.multiPV || this.options.MultiPV) | 0));
      const outFmt = this.options.PVFormat === 'san' ? 'san' : 'uci';
      
      let rootMoves = this.genMoves(false);
      if (spec.searchMoves && spec.searchMoves.length) {
        const wanted = new Set(spec.searchMoves);
        rootMoves = rootMoves.filter((m) => wanted.has(this.moveToUci(m)));
      }
      if (rootMoves.length === 0) {
        this.send('info string no legal root move');
        this.send('bestmove 0000');
        return;
      }
      
      // Check opening book
      let bookMove = null;
      if (this.options.OwnBook && !spec.infinite && this.moveTime > 0 && depthLimit >= 3) {
        try {
          bookMove = this.book.getMove(this, this.side, this.hash);
        } catch (err) {
          const msg = err && err.message ? err.message : String(err);
          this.send('info string opening_book_error', msg);
          bookMove = null;
        }
        if (bookMove) {
          const bookUci = this.moveToUci(bookMove);
          if (this.book.randomness > 0 && Math.random() < this.book.randomness / 100) {
            // Random deviate sometimes
          } else {
            this.send('bestmove', bookUci);
            return;
          }
        }
      }
      
      let bestMove = rootMoves[0], bestScore = -INF, prevScore = -INF, finalScored = null, stableIters = 0;
      
      for (let d = 1; d <= depthLimit; d++) {
        if (this.stop) break;
        let asp = d > 1 ? 25 : INF, lo = d > 1 ? Math.max(-INF, prevScore - asp) : -INF, hi = d > 1 ? Math.min(INF, prevScore + asp) : INF;
        const scored = [];
        let aspTries = 0;
        aspirationLoop: while (true) {
          if (++aspTries > 12) { lo = -INF; hi = INF; }
          scored.length = 0;
          let alpha = lo, bestInWindow = -INF;
          const rootPool = rootMoves.filter((m) => this.queenMoveAllowedByPolicy(m, d, true));
          const iterMoves = rootPool.length ? rootPool : rootMoves;
          const ttEnc = this.tt.getBestMove(this.hash);
          this.scoreMoves(iterMoves, ttEnc, 0);
          for (let moveIdx = 0; moveIdx < iterMoves.length; moveIdx++) {
            const m = this.pickNextMove(iterMoves, moveIdx);
            if (this.stop) break;
            this.makeMove(m);
            let score;
            if (moveIdx === 0) {
              score = -this.negamax(d-1, -hi, -alpha, 1, true);
            } else {
              score = -this.negamax(d-1, -alpha-1, -alpha, 1, true);
              if (!this.stop && score > alpha && score < hi) {
                score = -this.negamax(d-1, -hi, -alpha, 1, true);
              }
            }
            this.undoMove();
            if (this.stop) break;
            scored.push({ m, score });
            if (score > bestInWindow) bestInWindow = score;
            if (score > alpha) {
              alpha = score;
              if (alpha >= hi) {
                asp = Math.min(asp * 2, INF);
                hi = Math.min(INF, alpha + asp);
                lo = Math.max(-INF, alpha - asp);
                continue aspirationLoop;
              }
            }
          }
          if (scored.length && bestInWindow <= lo && lo > -INF + 1) {
            asp = Math.min(asp * 2, INF);
            lo = Math.max(-INF, bestInWindow - asp);
            hi = Math.min(INF, bestInWindow + asp);
            continue aspirationLoop;
          }
          break;
        }
        if (!scored.length) break;
        scored.sort((a, b) => b.score - a.score);
        this.applyRootBlunderGuard(scored, d);
        finalScored = scored;
        bestMove = scored[0].m;
        bestScore = scored[0].score;
        if (prevScore > -INF + 1 && Math.abs(bestScore - prevScore) <= 18) stableIters++;
        else stableIters = 0;
        prevScore = bestScore;
        rootMoves = scored.map(x => x.m);
        const elapsed = Date.now() - this.startTime;
        const nps = elapsed > 0 ? Math.floor(this.nodes * 1000 / elapsed) : this.nodes;
        const hashfull = this.tt.hashfull();
        const rootLines = [];
        for (let i = 0; i < scored.length; i++) {
          const { m, score } = scored[i];
          const first = this.formatMove(m, outFmt);
          this.makeMove(m);
          const pv = [first, ...this.pvLine(Math.max(0, d-1), outFmt)].join(' ');
          this.undoMove();
          rootLines.push({ move: m, score, pv });
        }
        this.sendRootInfo(rootLines, d, elapsed, nps, hashfull, multiPV);
        if (this.moveTime > 0) {
          const elapsedNow = Date.now() - this.startTime;
          if (d >= 2 && elapsedNow >= this.moveTime * 0.96) break;
          if (!spec.moveTime && d >= 6 && stableIters >= 2 && elapsedNow >= this.moveTime * 0.75) break;
        }
      }
      const chosenMove = this.pickSkillMove(finalScored || [{ m: bestMove, score: bestScore }]) || bestMove;
      this.bestMove = chosenMove;
      const bestMoveUci = this.moveToUci(chosenMove);
      let ponder = '';
      if ((this.options.Ponder || spec.ponder) && chosenMove) {
        this.makeMove(chosenMove);
        const line = this.pvLine(1);
        this.undoMove();
        ponder = line[0] || '';
      }
      if (ponder) this.send('bestmove', bestMoveUci, 'ponder', ponder);
      else this.send('bestmove', bestMoveUci);
      this.pondering = false;
    }

    handlePosition(tokens) {
      let i = 1;
      if (tokens[i] === 'startpos') {
        this.setFen(START_FEN); i++;
      } else if (tokens[i] === 'fen') {
        i++;
        const fp = [];
        while (i < tokens.length && tokens[i] !== 'moves') fp.push(tokens[i++]);
        this.setFen(fp.join(' '));
      }
      if (tokens[i] === 'moves') {
        i++;
        while (i < tokens.length) {
          const m = this.findMoveByUci(tokens[i++]);
          if (!m) break;
          this.makeMove(m);
        }
      }
    }

    handleGo(tokens) {
      const spec = {
        depth:0, moveTime:0, wtime:0, btime:0, winc:0, binc:0, movestogo:30,
        multiPV:0, infinite:false, ponder:false, maxNodes:0, selDepth:0, searchMoves:[],
      };
      const stopWords = new Set(['searchmoves','ponder','wtime','btime','winc','binc','movestogo','depth','nodes','mate','movetime','infinite','multipv','seldepth']);
      for (let i = 1; i < tokens.length; i++) {
        const t = tokens[i], v = Number(tokens[i+1]);
        if (t==='infinite')   { spec.infinite=true; }
        if (t==='ponder')     { spec.ponder=true; }
        if (t==='depth')      { spec.depth=v; }
        if (t==='movetime')   { spec.moveTime=v; }
        if (t==='nodes')      { spec.maxNodes=v; }
        if (t==='seldepth')   { spec.selDepth=v; }
        if (t==='wtime')      { spec.wtime=v; }
        if (t==='btime')      { spec.btime=v; }
        if (t==='winc')       { spec.winc=v; }
        if (t==='binc')       { spec.binc=v; }
        if (t==='movestogo')  { spec.movestogo=v; }
        if (t==='multipv')    { spec.multiPV=v; }
        if (t === 'searchmoves') {
          let j = i + 1;
          while (j < tokens.length && !stopWords.has(tokens[j])) {
            spec.searchMoves.push(tokens[j]);
            j++;
          }
          i = j - 1;
        }
      }
      if (spec.infinite && !spec.moveTime) spec.moveTime = 24 * 3600 * 1000;
      if (spec.ponder && !spec.moveTime) spec.moveTime = 24 * 3600 * 1000;
      if (this.options.UCI_AnalyseMode && !spec.moveTime) spec.moveTime = 0;
      if (!spec.depth) spec.depth = 64;
      this.lastGoSpec = spec;
      this.pondering = !!spec.ponder;
      if (this.searchTimer) clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => {
        this.searchTimer = null;
        try { this.search(spec); }
        catch (err) {
          const msg = err && err.message ? err.message : String(err);
          this.send('info string error search', msg);
          let fallback = '0000';
          try {
            fallback = this.getEmergencyMoveUci();
          } catch (_) {}
          this.send('info string emergency_bestmove', fallback);
          this.send('bestmove', fallback);
        }
      }, 0);
    }

    handleSetOption(tokens) {
      const ni = tokens.indexOf('name');
      const vi = tokens.indexOf('value');
      if (ni < 0) return;
      const name = tokens.slice(ni+1, vi>-1?vi:tokens.length).join(' ');
      const value = vi>-1 ? tokens.slice(vi+1).join(' ') : '';
      if (name === 'MultiPV') {
        this.options.MultiPV = Math.max(1, Math.min(12, +value || 1));
        return;
      }
      if (name === 'Skill Level') {
        const parsed = Number(value);
        this.options.SkillLevel = Number.isFinite(parsed) ? Math.max(0, Math.min(20, parsed | 0)) : 20;
        return;
      }
      if (name === 'Ponder') {
        this.options.Ponder = BOOL_RE.test(value.trim());
        return;
      }
      if (name === 'Move Overhead') {
        this.options.MoveOverhead = Math.max(0, Math.min(10000, +value || 0));
        return;
      }
      if (name === 'UCI_AnalyseMode') {
        this.options.UCI_AnalyseMode = BOOL_RE.test(value.trim());
        return;
      }
      if (name === 'UCI_LimitStrength') {
        this.options.UCI_LimitStrength = BOOL_RE.test(value.trim());
        return;
      }
      if (name === 'UCI_Elo') {
        this.options.UCI_Elo = Math.max(800, Math.min(2800, +value || 2200));
        return;
      }
      if (name === 'UCI_ShowWDL') {
        this.options.UCI_ShowWDL = BOOL_RE.test(value.trim());
        return;
      }
      if (name === 'UCI_ShowACPL') {
        this.options.UCI_ShowACPL = BOOL_RE.test(value.trim());
        return;
      }
      if (name === 'PVFormat') {
        this.options.PVFormat = String(value).trim().toLowerCase() === 'san' ? 'san' : 'uci';
        return;
      }
      if (name === 'Clear Hash') {
        this.tt.clear();
        return;
      }
      if (name === 'Hash') {
        const mb = Math.max(MIN_HASH_MB, Math.min(MAX_HASH_MB, +value || DEFAULT_HASH_MB));
        this.options.Hash = mb;
        this.tt.resize(mb);
        return;
      }
      if (name === 'Contempt') {
        this.options.Contempt = Math.max(-100, Math.min(100, +value || 15));
        return;
      }
      if (name === 'OwnBook') {
        this.options.OwnBook = BOOL_RE.test(value.trim());
        return;
      }
      if (name === 'BookRandomness') {
        this.options.BookRandomness = Math.max(0, Math.min(100, +value || 10));
        return;
      }
      if (name === 'Queen Safety') {
        const val = String(value).trim().toLowerCase();
        if (val === 'strong' || val === 'normal' || val === 'weak') {
          this.options.QueenSafety = val.charAt(0).toUpperCase() + val.slice(1);
        }
        return;
      }
    }

    command(line) {
      const tokens = line.trim().split(/\s+/);
      if (!tokens[0]) return;
      let cmd = tokens[0];
      if (cmd === 'u') cmd = 'ucinewgame';
      if (cmd === 'q') cmd = 'quit';
      if (cmd === 'b') cmd = 'board';
      if (cmd === 'e') cmd = 'eval';
      if (cmd === 'p') {
        cmd = 'position';
        if (tokens[1] === 's') tokens[1] = 'startpos';
      }
      if (cmd === 'g') {
        cmd = 'go';
        if (tokens[1] === 'd') tokens[1] = 'depth';
      }
      switch (cmd) {
        case 'uci':
          this.send('id name', this.name);
          this.send('id author', this.author);
          this.send('option name Clear Hash type button');
          this.send('option name Hash type spin default', DEFAULT_HASH_MB, 'min', MIN_HASH_MB, 'max', MAX_HASH_MB);
          this.send('option name MultiPV type spin default 1 min 1 max 12');
          this.send('option name Skill Level type spin default 20 min 0 max 20');
          this.send('option name Threads type spin default 1 min 1 max 1');
          this.send('option name Ponder type check default false');
          this.send('option name Move Overhead type spin default 30 min 0 max 10000');
          this.send('option name UCI_AnalyseMode type check default false');
          this.send('option name UCI_LimitStrength type check default false');
          this.send('option name UCI_Elo type spin default 2200 min 800 max 2800');
          this.send('option name UCI_ShowWDL type check default false');
          this.send('option name UCI_ShowACPL type check default false');
          this.send('option name PVFormat type combo default uci var uci var san');
          this.send('option name Contempt type spin default 15 min -100 max 100');
          this.send('option name OwnBook type check default true');
          this.send('option name BookRandomness type spin default 10 min 0 max 100');
          this.send('option name Queen Safety type combo default Strong var Strong var Normal var Weak');
          this.send('uciok');
          break;
        case 'isready':
          this.send('readyok');
          break;
        case 'ucinewgame':
          this.tt.clear();
          this.histTable.fill(0);
          this.contHist.fill(0);
          for (const k of this.killers) { k[0]=0; k[1]=0; }
          this.setFen(START_FEN);
          break;
        case 'position':
          this.handlePosition(tokens);
          break;
        case 'go':
          this.handleGo(tokens);
          break;
        case 'stop':
          this.stop = true;
          if (this.searchTimer) { clearTimeout(this.searchTimer); this.searchTimer = null; }
          break;
        case 'setoption':
          this.handleSetOption(tokens);
          break;
        case 'ping':
          this.send('info string', this.name, 'is alive');
          break;
        case 'board':
          this.send('info string board', this.getFen());
          break;
        case 'eval':
          this.send('info string eval cp', this.evaluate());
          break;
        case 'd':
        case 'fen':
          this.send('info string', this.getFen());
          break;
        case 'quit':
          this.stop = true;
          break;
        default:
          this.send('info string unknown command', cmd);
          break;
      }
    }
  }

  const engine = new Engine();
  self.onmessage = (e) => {
    const lines = String(e.data||'').split(/\r?\n/);
    for (const ln of lines) {
      const l = ln.trim();
      if (!l) continue;
      try { engine.command(l); }
      catch (err) {
        const msg = err && err.message ? err.message : String(err);
        engine.send('info string error command', msg, 'line', l);
      }
    }
  };
})();
