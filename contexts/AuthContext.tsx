// contexts/AuthContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
} from "react";
import * as SecureStore from "expo-secure-store";
import { useRouter, useSegments } from "expo-router";
import {
  base44,
  setAuthToken,
  fetchStudentDashboardData,
} from "../utils/base44";

interface StudentData {
  success: boolean;
  role: string;
  user: {
    id: string;
    email: string;
    school_id: string;
    name: string;
    admission_no: string;
    class_name: string;
    section: string;
  };
  profile: {
    id: string;
    is_verified?: boolean;
    admission_no: string;
    [key: string]: any;
  };
  school_settings?: {
    school_name: string;
    address: string;
    contact_number: string;
    is_bus_tracking_enabled: boolean;
  };
  fees: any[];
  attendance: any[];
  exam_routines: any[];
  exam_results: any[];
  bus_routes: any[];
  assigned_bus?: any;
}

type AuthContextType = {
  token: string | null;
  studentData: StudentData | null;
  loading: boolean;

  // Directly Exported Flattended Properties
  className: string | null;
  sectionName: string | null;
  assignedBus: any | null;
  attendance: any[];
  fees: any[];
  examRoutines: any[];
  examResults: any[];
  busRoutes: any[];
  schoolSettings: any | null;

  // Action Methods
  loginOrRequestOtp: (
    email: string,
    admissionNo: string,
  ) => Promise<{ isVerified: boolean }>;
  verifyOtpAndLogin: (email: string, otpCode: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [studentData, setStudentData] = useState<StudentData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    const bootstrapAsync = async () => {
      try {
        const savedToken = await SecureStore.getItemAsync("user_token");
        if (savedToken) {
          setToken(savedToken);
          setAuthToken(savedToken);
          const data = await fetchStudentDashboardData();
          setStudentData(data as unknown as StudentData);
        }
      } catch (e) {
        console.warn("Session restoration failed", e);
      } finally {
        setLoading(false);
      }
    };
    bootstrapAsync();
  }, []);

  // Protect routing states
  useEffect(() => {
    if (loading) return;
    const inAuthGroup = (segments[0] as string) === "(auth)";

    if (!token && !inAuthGroup) {
      router.replace("/(auth)/student-login" as any);
    } else if (token && inAuthGroup) {
      router.replace("/(tabs)" as any);
    }
  }, [token, segments, loading]);

  /**
   * Deriving the values reactively so they automatically update
   * whenever studentData changes.
   */
  const className = useMemo(
    () => studentData?.user?.class_name || null,
    [studentData],
  );
  const sectionName = useMemo(
    () => studentData?.user?.section || null,
    [studentData],
  );
  const assignedBus = useMemo(
    () => studentData?.assigned_bus || null,
    [studentData],
  );
  const attendance = useMemo(
    () => studentData?.attendance || [],
    [studentData],
  );
  const fees = useMemo(() => studentData?.fees || [], [studentData]);
  const examRoutines = useMemo(
    () => studentData?.exam_routines || [],
    [studentData],
  );
  const examResults = useMemo(
    () => studentData?.exam_results || [],
    [studentData],
  );
  const busRoutes = useMemo(() => studentData?.bus_routes || [], [studentData]);
  const schoolSettings = useMemo(
    () => studentData?.school_settings || null,
    [studentData],
  );

  const loginOrRequestOtp = async (email: string, admissionNo: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanAdmission = admissionNo.trim().toUpperCase();

    const response = await base44.functions.invoke("verifyStudentCredentials", {
      email: cleanEmail,
      admissionNo: cleanAdmission,
    });

    if (response?.isVerified && response?.token) {
      await SecureStore.setItemAsync("user_token", response.token);
      setAuthToken(response.token);

      const data = await fetchStudentDashboardData();
      setStudentData(data as unknown as StudentData);
      setToken(response.token);

      return { isVerified: true };
    } else {
      return { isVerified: false };
    }
  };

  const verifyOtpAndLogin = async (email: string, otpCode: string) => {
    const response = await base44.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      otpCode: otpCode.trim(),
    });

    if (!response?.token) {
      throw new Error("Invalid or expired verification code.");
    }

    await SecureStore.setItemAsync("user_token", response.token);
    setAuthToken(response.token);

    const data = await fetchStudentDashboardData();
    setStudentData(data as unknown as StudentData);
    setToken(response.token);
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync("user_token");
    setToken(null);
    setAuthToken(null);
    setStudentData(null);
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        studentData,
        loading,
        className,
        sectionName,
        assignedBus,
        attendance,
        fees,
        examRoutines,
        examResults,
        busRoutes,
        schoolSettings,
        loginOrRequestOtp,
        verifyOtpAndLogin,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext)!;
