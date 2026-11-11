export type PermissionCode =
  | "dashboard.view"
  | "students.read"
  | "students.write"
  | "students.import"
  | "students.export"
  | "students.transfer"
  | "students.promote"
  | "staff.read"
  | "staff.write"
  | "staff.import"
  | "staff.export"
  | "guardians.read"
  | "guardians.write"
  | "academics.read"
  | "academics.write"
  | "stages.manage"
  | "subjects.read"
  | "subjects.write"
  | "activities.read"
  | "activities.write"
  | "assignments.read"
  | "assignments.write"
  | "announcements.read"
  | "announcements.write"
  | "attendance.read"
  | "attendance.write"
  | "audit.read"
  | "settings.write"
  | "roles.manage"
  | "departments.manage"
  | "positions.manage"
  | "wards.read";

export const PERMISSION_CATALOG: Array<{
  code: PermissionCode;
  name: string;
  description: string;
  module: string;
}> = [
  {
    code: "dashboard.view",
    name: "View dashboard",
    description: "Access the admin overview",
    module: "Dashboard",
  },
  {
    code: "students.read",
    name: "View students",
    description: "See student list and details",
    module: "Students",
  },
  {
    code: "students.write",
    name: "Manage students",
    description: "Create and update students",
    module: "Students",
  },
  {
    code: "students.import",
    name: "Import students",
    description: "Import students from CSV",
    module: "Students",
  },
  {
    code: "students.export",
    name: "Export students",
    description: "Export students to CSV",
    module: "Students",
  },
  {
    code: "students.transfer",
    name: "Transfer students",
    description: "Move students between classes anytime with a reason",
    module: "Students",
  },
  {
    code: "students.promote",
    name: "Promote / repeat students",
    description: "Run year-end promotion and repetition into the next year",
    module: "Students",
  },
  {
    code: "staff.read",
    name: "View staff",
    description: "See staff directory",
    module: "Staff",
  },
  {
    code: "staff.write",
    name: "Manage staff",
    description: "Create and update staff",
    module: "Staff",
  },
  {
    code: "staff.import",
    name: "Import staff",
    description: "Import staff from CSV",
    module: "Staff",
  },
  {
    code: "staff.export",
    name: "Export staff",
    description: "Export staff to CSV",
    module: "Staff",
  },
  {
    code: "guardians.read",
    name: "View parents",
    description: "See guardian records",
    module: "Parents",
  },
  {
    code: "guardians.write",
    name: "Manage parents",
    description: "Create, update, and delete parents/guardians",
    module: "Parents",
  },
  {
    code: "academics.read",
    name: "View academics",
    description: "See years, levels, and classes",
    module: "Academics",
  },
  {
    code: "academics.write",
    name: "Manage academics",
    description: "Create years, levels, and classes",
    module: "Academics",
  },
  {
    code: "stages.manage",
    name: "Manage stages",
    description: "Create and edit school stages (Primary, JHS, etc.)",
    module: "Academics",
  },
  {
    code: "subjects.read",
    name: "View subjects",
    description: "See the subject catalog",
    module: "Academics",
  },
  {
    code: "subjects.write",
    name: "Manage subjects",
    description: "Create and update subjects",
    module: "Academics",
  },
  {
    code: "activities.read",
    name: "View activities",
    description: "See the school activity catalog (break, lunch, worship, etc.)",
    module: "Academics",
  },
  {
    code: "activities.write",
    name: "Manage activities",
    description: "Create and update timetable activities",
    module: "Academics",
  },
  {
    code: "assignments.read",
    name: "View teaching assignments",
    description: "See which teacher teaches which subject/class",
    module: "Academics",
  },
  {
    code: "assignments.write",
    name: "Manage teaching assignments",
    description: "Assign teachers to subjects and classes",
    module: "Academics",
  },
  {
    code: "announcements.read",
    name: "View notices",
    description: "Read school notices",
    module: "Communication",
  },
  {
    code: "announcements.write",
    name: "Publish notices",
    description: "Create and publish notices",
    module: "Communication",
  },
  {
    code: "attendance.read",
    name: "View attendance",
    description: "See class attendance registers and summaries",
    module: "Attendance",
  },
  {
    code: "attendance.write",
    name: "Mark attendance",
    description: "Take and update daily class attendance",
    module: "Attendance",
  },
  {
    code: "audit.read",
    name: "View audit logs",
    description: "See important system activity for accountability",
    module: "System",
  },
  {
    code: "settings.write",
    name: "School settings",
    description: "Edit school profile and branding",
    module: "System",
  },
  {
    code: "roles.manage",
    name: "Manage roles",
    description: "Create roles and assign permissions",
    module: "System",
  },
  {
    code: "departments.manage",
    name: "Manage departments",
    description: "Create and edit departments",
    module: "System",
  },
  {
    code: "positions.manage",
    name: "Manage positions",
    description: "Create and edit positions",
    module: "System",
  },
  {
    code: "wards.read",
    name: "View my wards",
    description: "See linked children’s class timetables and parent portal",
    module: "Parent",
  },
];

export const DEFAULT_ROLE_PERMISSIONS: Record<string, PermissionCode[]> = {
  Administrator: PERMISSION_CATALOG.map((p) => p.code),
  Registrar: [
    "dashboard.view",
    "students.read",
    "students.write",
    "students.import",
    "students.export",
    "students.transfer",
    "students.promote",
    "guardians.read",
    "guardians.write",
    "staff.read",
    "academics.read",
    "academics.write",
    "stages.manage",
    "subjects.read",
    "subjects.write",
    "activities.read",
    "activities.write",
    "assignments.read",
    "assignments.write",
    "announcements.read",
    "announcements.write",
    "attendance.read",
    "attendance.write",
  ],
  Bursar: [
    "dashboard.view",
    "students.read",
    "students.export",
    "staff.read",
    "guardians.read",
    "announcements.read",
  ],
  Teacher: [
    "dashboard.view",
    "students.read",
    "academics.read",
    "subjects.read",
    "activities.read",
    "assignments.read",
    "announcements.read",
    "attendance.read",
    "attendance.write",
  ],
  Reception: [
    "dashboard.view",
    "students.read",
    "staff.read",
    "guardians.read",
    "announcements.read",
    "attendance.read",
  ],
  Parent: ["dashboard.view", "announcements.read", "wards.read"],
  Student: ["dashboard.view", "announcements.read"],
};
