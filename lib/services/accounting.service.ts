// ============================================================
// Accounting Service — Chart of Accounts business rules
//
// Single source of truth that future modules (Journal Entries,
// General Ledger, Trial Balance, P&L, Balance Sheet, AR/AP, ...)
// must consume instead of querying `Account` directly.
//
// Architecture: Page/API → accountingService → accountRepository → Prisma
// ============================================================

import { Prisma, type Account, type AccountType } from "@prisma/client";
import { accountRepository, type AccountListItem } from "@/lib/repositories/account.repository";
import { createAuditLog } from "@/lib/audit";
import { ACCOUNT_SUBTYPES } from "@/lib/validators/chart-of-accounts";
import type { CreateAccountInput, UpdateAccountInput } from "@/lib/validators/chart-of-accounts";

export type NormalBalance = "DEBIT" | "CREDIT";

export type AccountTreeNode = {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  accountSubType: string | null;
  balance: number;
  isActive: boolean;
  isSystemGenerated: boolean;
  children: AccountTreeNode[];
};

export type PostingAccountInfo = {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  accountSubType: string | null;
  normalBalance: NormalBalance;
  isActive: boolean;
};

// ---------------------------------------------------------------------------
// Pure helpers — exposed for the Journal Entry / GL / reporting modules
// ---------------------------------------------------------------------------

/** ASSET, EXPENSE, COGS and STOCK accounts increase with a debit; the rest with a credit. */
export function normalBalanceForType(type: AccountType): NormalBalance {
  return type === "ASSET" || type === "EXPENSE" || type === "COGS" || type === "STOCK"
    ? "DEBIT"
    : "CREDIT";
}

export function toPostingAccountInfo(account: Pick<Account, "id" | "code" | "name" | "type" | "accountSubType" | "isActive">): PostingAccountInfo {
  return {
    accountId: account.id,
    accountCode: account.code,
    accountName: account.name,
    accountType: account.type,
    accountSubType: account.accountSubType,
    normalBalance: normalBalanceForType(account.type),
    isActive: account.isActive,
  };
}

class AccountingError extends Error {
  constructor(message: string, readonly status: number = 400) {
    super(message);
    this.name = "AccountingError";
  }
}

export { AccountingError };

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const accountingService = {
  normalBalanceForType,

  // -------------------------------------------------------------------------
  // Reads — consumed by the COA UI and (in future) every posting module
  // -------------------------------------------------------------------------

  async list(organizationId: string, params: Parameters<typeof accountRepository.list>[1]) {
    return accountRepository.list(organizationId, params);
  },

  async getById(organizationId: string, id: string) {
    return accountRepository.findById(organizationId, id);
  },

  /** accountingService.getAccountByCode() — required by future posting modules. */
  async getAccountByCode(organizationId: string, code: string): Promise<PostingAccountInfo | null> {
    const account = await accountRepository.findByCode(organizationId, code);
    return account ? toPostingAccountInfo(account) : null;
  },

  /**
   * accountingService.getAccountBalance() — current balance plus the
   * debit/credit activity that produced it (optionally windowed by date).
   */
  async getAccountBalance(organizationId: string, accountId: string, range?: { from?: Date; to?: Date }) {
    const account = await accountRepository.findById(organizationId, accountId);
    if (!account) throw new AccountingError("Account not found", 404);

    const { debit, credit } = await accountRepository.getLedgerActivity(organizationId, accountId, range);
    const normalBalance = normalBalanceForType(account.type);

    return {
      accountId: account.id,
      accountCode: account.code,
      accountName: account.name,
      accountType: account.type,
      normalBalance,
      openingBalance: Number(account.openingBalance),
      currentBalance: Number(account.balance),
      periodDebit: Number(debit),
      periodCredit: Number(credit),
    };
  },

  /**
   * accountingService.validatePostingAccount() — guard that future Journal
   * Entry / Invoice / Expense modules call before writing a JournalLine.
   * Throws AccountingError with a user-facing message on failure.
   */
  async validatePostingAccount(organizationId: string, accountId: string): Promise<PostingAccountInfo> {
    const account = await accountRepository.findById(organizationId, accountId);
    if (!account) throw new AccountingError("Account not found", 404);
    if (!account.isActive) throw new AccountingError(`Account "${account.name}" is inactive and cannot receive postings`, 422);
    if (account._count.children > 0) {
      throw new AccountingError(`"${account.name}" is a parent account — post to one of its sub-accounts instead`, 422);
    }
    return toPostingAccountInfo(account);
  },

  /** accountingService.getAccountTree() — full hierarchy for the tree view. */
  async getAccountTree(organizationId: string): Promise<AccountTreeNode[]> {
    const flat = await accountRepository.listForTree(organizationId);

    const byId = new Map<string, AccountTreeNode>();
    for (const a of flat) {
      byId.set(a.id, {
        id: a.id,
        code: a.code,
        name: a.name,
        type: a.type,
        accountSubType: a.accountSubType,
        balance: Number(a.balance),
        isActive: a.isActive,
        isSystemGenerated: a.isSystemGenerated,
        children: [],
      });
    }

    const roots: AccountTreeNode[] = [];
    for (const a of flat) {
      const node = byId.get(a.id)!;
      const parent = a.parentAccountId ? byId.get(a.parentAccountId) : undefined;
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
    return roots;
  },

  // -------------------------------------------------------------------------
  // Writes — enforce the spec's create/edit/delete business rules + audit
  // -------------------------------------------------------------------------

  async createAccount(
    organizationId: string,
    actor: { userId: string | null },
    input: CreateAccountInput
  ): Promise<Account> {
    const code = input.accountCode.trim();

    const duplicate = await accountRepository.findByCode(organizationId, code);
    if (duplicate) throw new AccountingError(`Account code "${code}" is already in use`, 409);

    if (input.parentAccountId) {
      const parent = await accountRepository.findById(organizationId, input.parentAccountId);
      if (!parent) throw new AccountingError("Parent account not found", 404);
      if (parent.type !== input.accountType) {
        throw new AccountingError("A sub-account must have the same account type as its parent", 422);
      }
    }

    const account = await accountRepository.create(organizationId, {
      code,
      name: input.accountName.trim(),
      type: input.accountType,
      accountSubType: input.accountSubType ?? null,
      parentAccountId: input.parentAccountId ?? null,
      description: input.description ?? null,
      openingBalance: input.openingBalance,
      createdBy: actor.userId,
    });

    await createAuditLog({
      organizationId,
      userId: actor.userId ?? undefined,
      action: "CREATE",
      entity: "account",
      entityId: account.id,
      description: `Created account "${account.name}" (${account.code})`,
      newValue: serializeAccount(account),
    });

    return account;
  },

  async updateAccount(
    organizationId: string,
    actor: { userId: string | null },
    id: string,
    input: UpdateAccountInput
  ): Promise<Account> {
    const existing = await accountRepository.findById(organizationId, id);
    if (!existing) throw new AccountingError("Account not found", 404);

    const hasPostings = await accountRepository.hasJournalLines(organizationId, id);

    const data: Prisma.AccountUpdateInput = { updatedBy: actor.userId };

    if (input.accountName !== undefined) data.name = input.accountName.trim();
    if (input.description !== undefined) data.description = input.description;
    if (input.isActive !== undefined) data.isActive = input.isActive;

    if (input.parentAccountId !== undefined) {
      if (input.parentAccountId === id) throw new AccountingError("An account cannot be its own parent", 422);
      if (input.parentAccountId) {
        const parent = await accountRepository.findById(organizationId, input.parentAccountId);
        if (!parent) throw new AccountingError("Parent account not found", 404);
        if (parent.type !== existing.type) {
          throw new AccountingError("A sub-account must have the same account type as its parent", 422);
        }
      }
      data.parentAccount = input.parentAccountId
        ? { connect: { id: input.parentAccountId } }
        : { disconnect: true };
    }

    // Type / subtype are locked the moment an account has ledger postings,
    // and permanently locked for system-generated accounts.
    if (input.accountType !== undefined && input.accountType !== existing.type) {
      if (existing.isSystemGenerated) throw new AccountingError("System-generated accounts cannot change type", 422);
      if (hasPostings) throw new AccountingError("Cannot change the type of an account that has ledger transactions", 422);
      data.type = input.accountType;
    }
    if (input.accountSubType !== undefined && input.accountSubType !== existing.accountSubType) {
      if (existing.isSystemGenerated) throw new AccountingError("System-generated accounts cannot change subtype", 422);
      if (hasPostings) throw new AccountingError("Cannot change the subtype of an account that has ledger transactions", 422);
      const effectiveType = (data.type as AccountType | undefined) ?? existing.type;
      if (input.accountSubType && !ACCOUNT_SUBTYPES[effectiveType]?.includes(input.accountSubType)) {
        throw new AccountingError(`"${input.accountSubType}" is not a valid subtype for ${effectiveType}`, 422);
      }
      data.accountSubType = input.accountSubType;
    }

    if (existing.isSystemGenerated && input.isActive === false) {
      throw new AccountingError("System-generated accounts cannot be deactivated", 422);
    }

    const updated = await accountRepository.update(organizationId, id, data);
    if (!updated) throw new AccountingError("Account not found", 404);

    await createAuditLog({
      organizationId,
      userId: actor.userId ?? undefined,
      action: "UPDATE",
      entity: "account",
      entityId: id,
      description: `Updated account "${updated.name}" (${updated.code})`,
      oldValue: serializeAccount(existing),
      newValue: serializeAccount(updated),
    });

    return updated;
  },

  /**
   * Soft delete: blocked if the account has ledger entries or sub-accounts,
   * and always blocked for system-generated accounts. Otherwise marks the
   * account inactive + deletedAt (never a hard delete).
   */
  async deleteAccount(organizationId: string, actor: { userId: string | null }, id: string): Promise<void> {
    const existing = await accountRepository.findById(organizationId, id);
    if (!existing) throw new AccountingError("Account not found", 404);
    if (existing.isSystemGenerated) throw new AccountingError("System-generated accounts cannot be deleted", 422);

    const [hasPostings, hasChildren] = await Promise.all([
      accountRepository.hasJournalLines(organizationId, id),
      accountRepository.hasChildren(organizationId, id),
    ]);
    if (hasPostings) throw new AccountingError("Cannot delete an account that has ledger transactions — deactivate it instead", 409);
    if (hasChildren) throw new AccountingError("Cannot delete an account that has sub-accounts — reassign or remove them first", 409);

    await accountRepository.softDelete(organizationId, id, actor.userId);

    await createAuditLog({
      organizationId,
      userId: actor.userId ?? undefined,
      action: "DELETE",
      entity: "account",
      entityId: id,
      description: `Deleted account "${existing.name}" (${existing.code})`,
      oldValue: serializeAccount(existing),
    });
  },

  async setActiveStatus(
    organizationId: string,
    actor: { userId: string | null },
    id: string,
    isActive: boolean
  ): Promise<void> {
    const existing = await accountRepository.findById(organizationId, id);
    if (!existing) throw new AccountingError("Account not found", 404);
    if (existing.isSystemGenerated && !isActive) {
      throw new AccountingError("System-generated accounts cannot be deactivated", 422);
    }

    await accountRepository.setActiveStatus(organizationId, id, isActive, actor.userId);

    await createAuditLog({
      organizationId,
      userId: actor.userId ?? undefined,
      action: "UPDATE",
      entity: "account",
      entityId: id,
      description: `${isActive ? "Activated" : "Deactivated"} account "${existing.name}" (${existing.code})`,
      oldValue: { isActive: existing.isActive },
      newValue: { isActive },
    });
  },

  /** Bulk activate/deactivate — system-generated accounts are silently skipped. */
  async bulkSetActiveStatus(
    organizationId: string,
    actor: { userId: string | null },
    ids: string[],
    isActive: boolean
  ): Promise<{ updated: number; skipped: number }> {
    if (!isActive) {
      // Deactivation must respect the same rule as single-account updates
      const accounts = await accountRepository.findManyByIds(organizationId, ids);
      const blocked = accounts.filter((a) => a.isSystemGenerated);
      const eligible = accounts.filter((a) => !a.isSystemGenerated).map((a) => a.id);

      if (eligible.length > 0) {
        await accountRepository.bulkSetActiveStatus(organizationId, eligible, false, actor.userId);
      }
      await createAuditLog({
        organizationId,
        userId: actor.userId ?? undefined,
        action: "UPDATE",
        entity: "account",
        description: `Bulk-deactivated ${eligible.length} account(s)`,
        newValue: { accountIds: eligible, isActive: false },
      });
      return { updated: eligible.length, skipped: blocked.length };
    }

    const result = await accountRepository.bulkSetActiveStatus(organizationId, ids, true, actor.userId);
    await createAuditLog({
      organizationId,
      userId: actor.userId ?? undefined,
      action: "UPDATE",
      entity: "account",
      description: `Bulk-activated ${result.count} account(s)`,
      newValue: { accountIds: ids, isActive: true },
    });
    return { updated: result.count, skipped: ids.length - result.count };
  },
};

function serializeAccount(account: { id: string; code: string; name: string; type: AccountType; accountSubType?: string | null; description?: string | null; isActive: boolean; parentAccountId?: string | null }) {
  return {
    id: account.id,
    code: account.code,
    name: account.name,
    type: account.type,
    accountSubType: account.accountSubType ?? null,
    description: account.description ?? null,
    isActive: account.isActive,
    parentAccountId: account.parentAccountId ?? null,
  };
}
