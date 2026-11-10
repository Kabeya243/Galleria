import { db } from "@/lib/db";

// Messaging safety helpers (Nov 2026): block and report storage.
//
// The UserBlock / MessageReport models land in the generated Prisma
// client on the next `prisma generate` (the Vercel build runs it, see
// vercel.json); the local client does not know them yet, so reach them
// through this narrow typed cast instead of `db.userBlock` /
// `db.messageReport` directly. After a generate, the cast can be
// dropped and the calls below used against `db` as-is. Nothing here
// invents behaviour: every query matches the Prisma models in
// prisma/schema.prisma.

type SafetyClient = {
  userBlock: {
    findFirst: (args: {
      where: { blockerId: string; blockedId: string };
    }) => Promise<{ id: string } | null>;
    findMany: (args: {
      where: { blockerId: string };
      select: { blockedId: true };
    }) => Promise<Array<{ blockedId: string }>>;
    create: (args: {
      data: { blockerId: string; blockedId: string };
    }) => Promise<{ id: string }>;
    deleteMany: (args: {
      where: { blockerId: string; blockedId: string };
    }) => Promise<{ count: number }>;
  };
  messageReport: {
    findFirst: (args: {
      where: { reporterId: string; messageId?: string; conversationId?: string };
    }) => Promise<{ id: string } | null>;
    create: (args: {
      data: {
        reporterId: string;
        messageId?: string | null;
        conversationId?: string | null;
        reason: string;
      };
    }) => Promise<{ id: string }>;
    findMany: (args: {
      orderBy: { createdAt: "desc" };
      take: number;
      include: {
        reporter: { select: { id: true; name: true; email: true } };
        message: {
          select: {
            id: true;
            body: true;
            senderId: true;
            createdAt: true;
            sender: { select: { id: true; name: true } };
          };
        };
        conversation: {
          select: {
            id: true;
            participantA: { select: { id: true; name: true } };
            participantB: { select: { id: true; name: true } };
          };
        };
      };
    }) => Promise<Array<AdminReportRow>>;
  };
};

export type AdminReportRow = {
  id: string;
  reason: string;
  createdAt: Date;
  reporter: { id: string; name: string; email: string };
  message:
    | {
        id: string;
        body: string;
        senderId: string;
        createdAt: Date;
        sender: { id: string; name: string };
      }
    | null;
  conversation:
    | {
        id: string;
        participantA: { id: string; name: string };
        participantB: { id: string; name: string };
      }
    | null;
};

const safetyDb = db as unknown as SafetyClient;

// True when `blockerId` blocked `blockedId`.
export async function isBlocked(blockerId: string, blockedId: string): Promise<boolean> {
  const row = await safetyDb.userBlock.findFirst({ where: { blockerId, blockedId } });
  return row !== null;
}

// Ids of every user `userId` blocked (empty array when none).
export async function blockedIdsFor(userId: string): Promise<string[]> {
  const rows = await safetyDb.userBlock.findMany({
    where: { blockerId: userId },
    select: { blockedId: true },
  });
  return rows.map((row) => row.blockedId);
}

// Record a block; idempotent (a second call for the same pair is a
// no-op that reports the block as in place).
export async function blockUser(blockerId: string, blockedId: string): Promise<boolean> {
  const existing = await safetyDb.userBlock.findFirst({ where: { blockerId, blockedId } });
  if (existing) return true;
  await safetyDb.userBlock.create({ data: { blockerId, blockedId } });
  return true;
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<boolean> {
  const result = await safetyDb.userBlock.deleteMany({ where: { blockerId, blockedId } });
  return result.count > 0;
}

// Record a report; an identical report from the same reporter is
// stored only once.
export async function createMessageReport(input: {
  reporterId: string;
  messageId?: string | null;
  conversationId?: string | null;
  reason: string;
}): Promise<{ id: string; duplicate: boolean }> {
  const where: { reporterId: string; messageId?: string; conversationId?: string } = {
    reporterId: input.reporterId,
  };
  if (input.messageId) where.messageId = input.messageId;
  else if (input.conversationId) where.conversationId = input.conversationId;
  const existing = await safetyDb.messageReport.findFirst({ where });
  if (existing) return { id: existing.id, duplicate: true };
  const created = await safetyDb.messageReport.create({
    data: {
      reporterId: input.reporterId,
      messageId: input.messageId ?? null,
      conversationId: input.conversationId ?? null,
      reason: input.reason,
    },
  });
  return { id: created.id, duplicate: false };
}

export async function listMessageReports(limit = 100): Promise<AdminReportRow[]> {
  return safetyDb.messageReport.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      reporter: { select: { id: true, name: true, email: true } },
      message: {
        select: {
          id: true,
          body: true,
          senderId: true,
          createdAt: true,
          sender: { select: { id: true, name: true } },
        },
      },
      conversation: {
        select: {
          id: true,
          participantA: { select: { id: true, name: true } },
          participantB: { select: { id: true, name: true } },
        },
      },
    },
  });
}
