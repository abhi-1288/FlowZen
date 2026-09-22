import type { CommandCenterContext } from "./context";
import type { QuickAction } from "./types";

export async function buildQuickActions(ctx: CommandCenterContext): Promise<QuickAction[]> {
  switch (ctx.variant) {
    case "admin":
      return [
        { key: "employee", label: "Add Employee", href: "/profile/members", icon: "user-plus" },
        { key: "project", label: "Create Project", href: "/board", icon: "plus" },
        { key: "task", label: "Create Task", href: "/board", icon: "list" },
        { key: "approvals", label: "Approvals", href: "/profile/approvals", icon: "check-square" },
        { key: "it", label: "IT Ticket", href: "/it/tickets", icon: "wrench" },
        { key: "expense", label: "Expense", href: "/profile/finance", icon: "wallet" },
      ];
    case "hr":
      return [
        { key: "employee", label: "Add Employee", href: "/profile/members", icon: "user-plus" },
        { key: "job", label: "Create Job", href: "/recruitment/jobs", icon: "briefcase" },
        { key: "interview", label: "Schedule Interview", href: "/recruitment/interviews", icon: "calendar" },
        { key: "approvals", label: "Approvals", href: "/profile/approvals", icon: "check-square" },
        { key: "it", label: "IT Ticket", href: "/it/tickets", icon: "wrench" },
      ];
    case "finance":
      return [
        { key: "salary", label: "Approve Salary", href: "/profile/finance", icon: "banknote" },
        { key: "expense", label: "Approve Expense", href: "/profile/finance", icon: "wallet" },
        { key: "budget", label: "Project Budget", href: "/profile/finance", icon: "target" },
        { key: "invoice", label: "New Invoice", href: "/profile/finance", icon: "file" },
      ];
    case "projects":
      return [
        { key: "board", label: "New Board", href: "/board", icon: "plus" },
        { key: "task", label: "New Task", href: "/board", icon: "list" },
        { key: "budget", label: "Project Budget", href: "/profile/finance", icon: "target" },
      ];
    case "it":
      return [
        { key: "ticket", label: "New Ticket", href: "/it/tickets", icon: "plus" },
        { key: "assign", label: "Assign Tickets", href: "/it/board", icon: "check-square" },
        { key: "provision", label: "Provisioning", href: "/it/board", icon: "key" },
      ];
    case "security":
      return [
        { key: "access", label: "Review Access", href: "/profile/security", icon: "shield" },
        { key: "approvals", label: "Approvals", href: "/profile/approvals", icon: "check-square" },
      ];
    default:
      return [
        { key: "leave", label: "Request Leave", href: "/profile/attendance", icon: "calendar" },
        { key: "it", label: "IT Ticket", href: "/it/tickets", icon: "wrench" },
        { key: "expense", label: "Expense", href: "/profile/finance", icon: "wallet" },
        { key: "tasks", label: "View Tasks", href: "/board", icon: "list" },
      ];
  }
}