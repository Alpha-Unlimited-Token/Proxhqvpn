// Re-export useAccess as useAdmin for backward compatibility.
// All components that import useAdmin will get hasAccess, isEmployee, etc.
export { useAccess as useAdmin } from "./useAccess";
