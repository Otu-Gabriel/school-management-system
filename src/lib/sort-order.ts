import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

type OrderedDelegate = {
  updateMany: (args: {
    where: Record<string, unknown>;
    data: { sortOrder: { increment?: number; decrement?: number } | number };
  }) => Promise<unknown>;
  findMany: (args: {
    orderBy: { sortOrder: "asc" };
    select: { id: true; sortOrder: true };
  }) => Promise<Array<{ id: string; sortOrder: number }>>;
  update: (args: {
    where: { id: string };
    data: { sortOrder: number };
  }) => Promise<unknown>;
};

function delegate(
  tx: Tx,
  model: "stage" | "gradeLevel"
): OrderedDelegate {
  return (model === "stage" ? tx.stage : tx.gradeLevel) as unknown as OrderedDelegate;
}

/** Clamp to a positive 1-based order. */
export function normalizeDesiredOrder(desired: number, maxInclusive: number) {
  if (!Number.isFinite(desired)) return maxInclusive;
  return Math.max(1, Math.min(Math.floor(desired), maxInclusive));
}

/**
 * Make room for a new row at `desiredOrder` by bumping existing rows
 * at that order and above (+1). Returns the order to assign.
 */
export async function makeRoomForCreate(
  tx: Tx,
  model: "stage" | "gradeLevel",
  desiredOrder: number
) {
  const rows = await delegate(tx, model).findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, sortOrder: true },
  });
  const order = normalizeDesiredOrder(desiredOrder, rows.length + 1);

  await delegate(tx, model).updateMany({
    where: { sortOrder: { gte: order } },
    data: { sortOrder: { increment: 1 } },
  });

  return order;
}

/**
 * Move an existing row to `desiredOrder`, shifting neighbors so orders
 * stay unique and contiguous. Returns the order assigned.
 */
export async function moveToOrder(
  tx: Tx,
  model: "stage" | "gradeLevel",
  id: string,
  desiredOrder: number,
  currentOrder: number
) {
  const rows = await delegate(tx, model).findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, sortOrder: true },
  });
  const order = normalizeDesiredOrder(desiredOrder, rows.length);
  if (order === currentOrder) return order;

  if (order < currentOrder) {
    // Insert earlier: [order, currentOrder) shift up
    await delegate(tx, model).updateMany({
      where: {
        id: { not: id },
        sortOrder: { gte: order, lt: currentOrder },
      },
      data: { sortOrder: { increment: 1 } },
    });
  } else {
    // Insert later: (currentOrder, order] shift down
    await delegate(tx, model).updateMany({
      where: {
        id: { not: id },
        sortOrder: { gt: currentOrder, lte: order },
      },
      data: { sortOrder: { decrement: 1 } },
    });
  }

  return order;
}

/** Renumber remaining rows to 1..n after a delete. */
export async function compactOrders(
  tx: Tx,
  model: "stage" | "gradeLevel"
) {
  const rows = await delegate(tx, model).findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, sortOrder: true },
  });

  for (let i = 0; i < rows.length; i += 1) {
    const next = i + 1;
    if (rows[i].sortOrder !== next) {
      await delegate(tx, model).update({
        where: { id: rows[i].id },
        data: { sortOrder: next },
      });
    }
  }
}
