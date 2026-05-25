// Central model registration and re-exports
export * from "./Attendance";
export * from "./Board";
export * from "./Column";
export * from "./Company";
export * from "./ExpenseRequest";
export * from "./FinanceSalary";
export * from "./Holiday";
export * from "./JoinRequest";
export * from "./LeaveRequest";
export * from "./Notification";
export * from "./ProjectBudget";
export * from "./Task";
export * from "./Team";
export * from "./User";

// Importing the files above has the side-effect of registering mongoose models
// with `mongoose.models`. Consumers can import from this module to ensure
// schemas are registered before they're used (e.g., before `populate`).
