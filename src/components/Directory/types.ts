export interface UserProfile {
  id: number;
  name: string;
  email: string;
  role: string;
  department: string;
  major: string;
  interests: string[];
}

export interface UserDataOptions {
  count?: number;
  roles?: string[];
  departments?: string[];
  majors?: string[];
  allInterests?: string[];
}
