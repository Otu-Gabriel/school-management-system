import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { AppProviders } from "@/components/providers/app-providers";
import { getSchoolSettings } from "@/lib/school";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export async function generateMetadata(): Promise<Metadata> {
  try {
    const school = await getSchoolSettings();
    return {
      title: {
        default: school.name,
        template: `%s · ${school.shortName || school.name}`,
      },
      description: `${school.name} management system`,
    };
  } catch {
    return {
      title: "School Management System",
      description: "Single-school Primary to JHS management platform",
    };
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let brand = {
    primaryColor: "#2563EB",
    secondaryColor: "#1E40AF",
    accentColor: "#F59E0B",
  };

  try {
    const school = await getSchoolSettings();
    brand = {
      primaryColor: school.primaryColor,
      secondaryColor: school.secondaryColor,
      accentColor: school.accentColor,
    };
  } catch {
    // DB may not be ready during first boot
  }

  const brandStyle = {
    ["--brand-primary" as string]: brand.primaryColor,
    ["--brand-secondary" as string]: brand.secondaryColor,
    ["--brand-accent" as string]: brand.accentColor,
  };

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${plusJakarta.variable} h-full`}
      style={brandStyle}
    >
      <body className="min-h-full antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
