// ============================================================
// POST /api/webhooks/clerk
// Handles Clerk webhook events:
//   - user.created  → auto-provision Organization + User in DB
//   - user.updated  → sync email/name
//   - user.deleted  → soft-delete or flag user
//
// Setup in Clerk Dashboard:
//   Webhooks → Add Endpoint → https://yourdomain.com/api/webhooks/clerk
//   Events to subscribe: user.created, user.updated, user.deleted
//
// Required env var: CLERK_WEBHOOK_SECRET (from Clerk Dashboard → Webhooks)
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Webhook } from "svix";
import { seedSystemAccounts } from "@/lib/accounting/system-accounts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ClerkUserCreatedEvent {
  type: "user.created";
  data: {
    id: string;
    email_addresses: { email_address: string; id: string }[];
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
    phone_numbers: { phone_number: string }[];
    public_metadata?: { userRole?: string };
  };
}

interface ClerkUserUpdatedEvent {
  type: "user.updated";
  data: ClerkUserCreatedEvent["data"];
}

interface ClerkUserDeletedEvent {
  type: "user.deleted";
  data: { id: string };
}

type ClerkWebhookEvent =
  | ClerkUserCreatedEvent
  | ClerkUserUpdatedEvent
  | ClerkUserDeletedEvent;

// ---------------------------------------------------------------------------
// Slug helper — "Acme Corp" → "acme-corp-x4k2"
// ---------------------------------------------------------------------------
function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}-${suffix}`;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

  // ── Verify signature ──────────────────────────────────────────────────────
  if (webhookSecret) {
    const svixId = req.headers.get("svix-id");
    const svixTimestamp = req.headers.get("svix-timestamp");
    const svixSignature = req.headers.get("svix-signature");

    if (!svixId || !svixTimestamp || !svixSignature) {
      return NextResponse.json({ error: "Missing svix headers" }, { status: 400 });
    }

    const body = await req.text();

    try {
      const wh = new Webhook(webhookSecret);
      wh.verify(body, {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      });

      const event = JSON.parse(body) as ClerkWebhookEvent;
      return handleEvent(event);
    } catch {
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
    }
  }

  // ── Dev mode: no secret set, accept without verification ─────────────────
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "CLERK_WEBHOOK_SECRET not configured" }, { status: 500 });
  }

  const body = await req.json() as ClerkWebhookEvent;
  return handleEvent(body);
}

// ---------------------------------------------------------------------------
// Event router
// ---------------------------------------------------------------------------
async function handleEvent(event: ClerkWebhookEvent): Promise<NextResponse> {
  switch (event.type) {
    case "user.created":
      return handleUserCreated(event.data);
    case "user.updated":
      return handleUserUpdated(event.data);
    case "user.deleted":
      return handleUserDeleted(event.data);
    default:
      return NextResponse.json({ received: true });
  }
}

// ---------------------------------------------------------------------------
// user.created → create Organization + User (OWNER) + Settings
// ---------------------------------------------------------------------------
async function handleUserCreated(
  data: ClerkUserCreatedEvent["data"]
): Promise<NextResponse> {
  const clerkId = data.id;
  const email = data.email_addresses[0]?.email_address ?? "";
  const name = [data.first_name, data.last_name].filter(Boolean).join(" ") || email.split("@")[0];

  // Idempotency — skip if already provisioned
  const existing = await prisma.user.findUnique({ where: { clerkId } });
  if (existing) {
    return NextResponse.json({ message: "User already exists", userId: existing.id });
  }

  // Create everything in a single transaction
  const result = await prisma.$transaction(async (tx) => {
    // 1. Create the Organization (one per user in this SaaS model)
    const orgName = name ? `${name}'s Organization` : "My Organization";
    const organization = await tx.organization.create({
      data: {
        name: orgName,
        slug: generateSlug(orgName),
        plan: "FREE",
        // Seed default Settings immediately
        settings: {
          create: {
            inventoryEnabled: true,
            payrollEnabled: true,
            complianceEnabled: true,
            loanModuleEnabled: true,
            defaultTaxRate: 18,
            taxLabel: "GST",
            invoicePrefix: "INV",
            invoiceStartNumber: 1,
            defaultPaymentTerms: 30,
            emailNotifications: true,
            overdueReminderDays: 3,
            lowStockThreshold: 10,
            dateFormat: "DD/MM/YYYY",
            numberFormat: "en-IN",
          },
        },
      },
    });

    // 2. Create the User as OWNER.
    //    userRole is only set if Clerk publicMetadata explicitly carries one
    //    (e.g., a CA invited by a firm admin). Regular sign-ups get null,
    //    which triggers the /onboarding/role selection screen on first login.
    const rawUserRole = data.public_metadata?.userRole;
    const VALID_ROLES = ["CA", "CA_FIRM_ADMIN", "ADMIN", "CUSTOMER"] as const;
    type ValidRole = (typeof VALID_ROLES)[number];
    const userRole: ValidRole | null = VALID_ROLES.includes(
      rawUserRole as ValidRole
    )
      ? (rawUserRole as ValidRole)
      : null;

    const user = await tx.user.create({
      data: {
        clerkId,
        email,
        name,
        role: "OWNER",
        ...(userRole !== null ? { userRole } : {}),
        avatarUrl: data.image_url ?? null,
        phone: data.phone_numbers?.[0]?.phone_number ?? null,
        isActive: true,
        organizationId: organization.id,
      },
    });

    // 3. Stamp the org's createdBy with the internal user id
    await tx.organization.update({
      where: { id: organization.id },
      data: { createdBy: user.id },
    });

    // 4. Create Membership record for the OWNER
    await tx.membership.create({
      data: {
        userId: user.id,
        organizationId: organization.id,
        role: "OWNER",
        invitedBy: user.id,
      },
    });

    // 5. Seed the default Chart of Accounts — every org needs a baseline
    //    COA before it can post a single journal entry, invoice, or expense.
    await seedSystemAccounts(tx, organization.id, user.id);

    return { organization, user };
  });

  console.log(
    `[Clerk webhook] Provisioned org ${result.organization.id} for user ${result.user.id} (${email})`
  );

  return NextResponse.json({
    message: "User and organization provisioned",
    userId: result.user.id,
    organizationId: result.organization.id,
  }, { status: 201 });
}

// ---------------------------------------------------------------------------
// user.updated → sync name / email / avatar
// ---------------------------------------------------------------------------
async function handleUserUpdated(
  data: ClerkUserCreatedEvent["data"]
): Promise<NextResponse> {
  const clerkId = data.id;
  const email = data.email_addresses[0]?.email_address ?? "";
  const name = [data.first_name, data.last_name].filter(Boolean).join(" ") || undefined;

  // Sync userRole from Clerk publicMetadata (set by admin or role selection action)
  const rawUserRole = data.public_metadata?.userRole;
  const VALID_ROLES_UPDATE = ["CA", "CA_FIRM_ADMIN", "ADMIN", "CUSTOMER"] as const;
  type ValidRoleUpdate = (typeof VALID_ROLES_UPDATE)[number];
  const userRole: ValidRoleUpdate | undefined = VALID_ROLES_UPDATE.includes(
    rawUserRole as ValidRoleUpdate
  )
    ? (rawUserRole as ValidRoleUpdate)
    : undefined;

  await prisma.user.updateMany({
    where: { clerkId },
    data: {
      email,
      ...(name && { name }),
      ...(data.image_url && { avatarUrl: data.image_url }),
      ...(userRole && { userRole }),
      updatedAt: new Date(),
    },
  });

  return NextResponse.json({ message: "User synced" });
}

// ---------------------------------------------------------------------------
// user.deleted → mark user inactive (preserve data for org)
// ---------------------------------------------------------------------------
async function handleUserDeleted(
  data: ClerkUserDeletedEvent["data"]
): Promise<NextResponse> {
  await prisma.user.updateMany({
    where: { clerkId: data.id },
    data: { isActive: false },
  });

  return NextResponse.json({ message: "User deactivated" });
}
