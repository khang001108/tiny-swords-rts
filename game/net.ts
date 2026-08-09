import { supabase } from "@/lib/supabaseClient";
import type { RealtimeChannel } from "@supabase/supabase-js";

// ── Kiểu dữ liệu trao đổi giữa 2 client ──────────────────────────────
export type Side = "left" | "right";

export interface UnitSnapshot {
  id: string;
  type: "pawn" | "warrior" | "archer";
  x: number;
  hp: number;
  maxHp: number;
  state: "walk" | "attack" | "dead";
}

export interface StatePayload {
  from: string; // playerId
  side: Side;
  baseHp: number;
  gold: number;
  units: UnitSnapshot[];
  t: number; // timestamp gửi
}

export interface HitPayload {
  from: string;
  targetId: string; // "base" hoặc id của unit
  damage: number;
}

export interface GameOverPayload {
  loserSide: Side;
}

type Handlers = {
  onState?: (p: StatePayload) => void;
  onHit?: (p: HitPayload) => void;
  onGameOver?: (p: GameOverPayload) => void;
  onOpponentJoined?: (side: Side) => void;
  onOpponentLeft?: () => void;
};

/**
 * RoomSync quản lý 1 Supabase Realtime channel cho 1 phòng đấu 1vs1.
 * Người tạo phòng (host) luôn là "left", người vào sau (guest) là "right".
 * Không cần bảng DB nào — chỉ dùng broadcast + presence, nên không tốn quota Postgres.
 */
export class RoomSync {
  private channel: RealtimeChannel;
  public readonly playerId: string;
  public side: Side | null = null;
  private handlers: Handlers = {};
  private joinedResolve: ((side: Side) => void) | null = null;

  constructor(private roomCode: string, private isHost: boolean) {
    this.playerId = crypto.randomUUID();
    this.channel = supabase.channel(`room:${roomCode}`, {
      config: { presence: { key: this.playerId }, broadcast: { self: false } },
    });
  }

  on(handlers: Handlers) {
    this.handlers = { ...this.handlers, ...handlers };
  }

  /** Kết nối và xác định vai trò trái/phải. Trả về Promise khi đủ 2 người. */
  connect(): Promise<Side> {
    return new Promise((resolve) => {
      this.joinedResolve = resolve;

      this.channel
        .on("broadcast", { event: "state" }, ({ payload }) => {
          this.handlers.onState?.(payload as StatePayload);
        })
        .on("broadcast", { event: "hit" }, ({ payload }) => {
          this.handlers.onHit?.(payload as HitPayload);
        })
        .on("broadcast", { event: "gameover" }, ({ payload }) => {
          this.handlers.onGameOver?.(payload as GameOverPayload);
        })
        .on("presence", { event: "sync" } as any, () => {
          const state = this.channel.presenceState() as Record<string, any[]>;
          const ids = Object.keys(state);
          if (ids.length >= 2 && !this.side) {
            // Sắp xếp theo thời điểm join để xác định host/guest ổn định
            const sorted = ids
              .map((id) => ({ id, joinedAt: state[id][0]?.joinedAt ?? 0 }))
              .sort((a, b) => a.joinedAt - b.joinedAt);
            const mySide: Side = sorted[0].id === this.playerId ? "left" : "right";
            this.side = mySide;
            this.joinedResolve?.(mySide);
            this.joinedResolve = null;
            const opponentId = sorted.find((s) => s.id !== this.playerId)?.id;
            if (opponentId) {
              this.handlers.onOpponentJoined?.(mySide === "left" ? "right" : "left");
            }
          } else if (ids.length < 2 && this.side) {
            this.handlers.onOpponentLeft?.();
          }
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await this.channel.track({ joinedAt: Date.now() });
          }
        });
    });
  }

  sendState(p: Omit<StatePayload, "from" | "t">) {
    this.channel.send({
      type: "broadcast",
      event: "state",
      payload: { ...p, from: this.playerId, t: Date.now() },
    });
  }

  sendHit(targetId: string, damage: number) {
    this.channel.send({
      type: "broadcast",
      event: "hit",
      payload: { from: this.playerId, targetId, damage } as HitPayload,
    });
  }

  sendGameOver(loserSide: Side) {
    this.channel.send({
      type: "broadcast",
      event: "gameover",
      payload: { loserSide } as GameOverPayload,
    });
  }

  disconnect() {
    supabase.removeChannel(this.channel);
  }
}

export function randomRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 5; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
