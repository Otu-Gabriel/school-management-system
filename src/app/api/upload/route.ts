import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { isCloudinaryConfigured, uploadImage } from "@/lib/cloudinary";
import { can } from "@/lib/permissions";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isCloudinaryConfigured()) {
    return NextResponse.json(
      {
        error:
          "Cloudinary is not configured. Add CLOUDINARY_* keys to your environment.",
      },
      { status: 503 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const folder = String(formData.get("folder") || "misc") as
    | "logos"
    | "students"
    | "staff"
    | "guardians"
    | "misc";

  const isOwnProfilePhoto = folder === "staff" || folder === "guardians";
  const canManageUploads =
    can(session.user.permissions, "students.write") ||
    can(session.user.permissions, "staff.write") ||
    can(session.user.permissions, "settings.write");

  if (folder === "logos" && !can(session.user.permissions, "settings.write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isOwnProfilePhoto && !canManageUploads) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only images are allowed" }, { status: 400 });
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "Max image size is 5MB" }, { status: 400 });
  }

  const uploaded = await uploadImage(file, folder);
  return NextResponse.json(uploaded);
}
