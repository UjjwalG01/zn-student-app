// Helper utility to safely extract clean primitive string messages from any SDK exception object
export const getSafeErrorMessage = (err: any, fallback: string): string => {
    if (!err) return fallback;
    if (typeof err.message === "function") {
        try {
            return String(err.message());
        } catch {
            /* fallback */
        }
    }
    if (typeof err.message === "string") return err.message;
    if (typeof err === "string") return err;
    return String(err);
};