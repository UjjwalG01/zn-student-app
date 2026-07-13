// contexts/StudentContext.tsx
import React, { createContext, useContext, useMemo } from "react";
import { useAuth } from "./AuthContext"; // Import our live authentication context

export interface Student {
  id: string;
  name: string;
  grade: string;
  assignedBusId: string;
  attendanceCount: number;
  email: string;
  schoolId: string;
}

interface StudentContextType {
  student: Student | null;
  loading: boolean;
}

const StudentContext = createContext<StudentContextType>({
  student: null,
  loading: true,
});

export function StudentProvider({ children }: { children: React.ReactNode }) {
  const { studentData, loading } = useAuth();

  // Map the live backend response from base44.functions.getStudentData()
  // into the frontend Student interface your pages expect.
  const student = useMemo(() => {
    if (!studentData?.user) return null;

    const user = studentData.user;
    return {
      id: user.id,
      name: user.name,
      grade: user.class_name || "N/A",
      assignedBusId:
        studentData.assigned_bus?.busNumber ||
        studentData.assigned_bus?.id ||
        "N/A",
      attendanceCount: studentData.attendance?.length || 0,
      email: user.email,
      schoolId: user.school_id,
    };
  }, [studentData]);

  const value = useMemo(() => ({ student, loading }), [student, loading]);

  return (
    <StudentContext.Provider value={value}>{children}</StudentContext.Provider>
  );
}

export const useStudent = () => useContext(StudentContext);
