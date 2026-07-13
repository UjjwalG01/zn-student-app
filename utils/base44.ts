// utils/base44.ts
import 'react-native-get-random-values';
import { createClient } from '@base44/sdk';

const API_URL = process.env.EXPO_PUBLIC_API_URL;
const APP_ID = process.env.EXPO_PUBLIC_BASE44_APP_ID;

// Initialize the core Base44 SDK instance
export const base44 = createClient({
    appId: APP_ID,
    headers: {
        "api_key": process.env.BASE44_API_KEY
    }
} as any); // Cast as any if custom header properties cause strict type friction

/**
 * Dynamically binds or clears the user authentication state.
 * Uses the official SDK method to modify subsequent outbound authorization headers safely.
 */
export const setAuthToken = (token: string | null) => {
    console.log("Setting Base44 authorization token to:", token ? "Token present" : "Cleared");
    // Pass the token or an empty string to clear the session context safely
    base44.setToken(token || '');
};

/**
 * Triggers the newly upgraded backend edge execution worker.
 * Fetches profile matrix, attendance charts, exam routines, fee summaries, 
 * and live OpenStreetMap bus telemetries in a single request.
 */
export const fetchStudentDashboardData = async () => {
    try {

        const baselineCheck = await fetch("https://jsonplaceholder.typicode.com/todos/1");
        console.log("Global Network Check Status:", baselineCheck.status); // Expect 200
        console.log("Invoking Base44 Edge Function: 'getStudentData'...");

        const response = await base44.functions.fetch('getStudentData');
        return response;
    } catch (error: any) {
        console.error("--- DETAILED NETWORK FAILURE LOG ---");
        console.error(JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
        console.error("Base44 Edge Function Invocation Failed:", error.message || error);
        throw error;
    }
};