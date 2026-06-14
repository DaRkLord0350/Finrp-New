import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { userRepository } from "@/lib/repositories";
import ProfileSettingsClient from "./ProfileSettingsClient";

export default async function ProfileSettingsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const profile = await userRepository.getByClerkId(userId);

  return (
    <ProfileSettingsClient
      initialProfile={
        profile
          ? {
              id: profile.id,
              name: profile.name ?? "",
              email: profile.email,
              phone: profile.phone ?? null,
              designation: profile.designation ?? null,
              department: profile.department ?? null,
              avatarUrl: profile.avatarUrl ?? null,
              role: profile.role,
              lastLoginAt: profile.lastLoginAt?.toISOString() ?? null,
              createdAt: profile.createdAt.toISOString(),
            }
          : null
      }
    />
  );
}
