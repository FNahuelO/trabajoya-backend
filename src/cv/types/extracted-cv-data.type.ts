/**
 * Tipos para datos extraídos del CV usando IA
 */

export interface ExtractedEducation {
  degree?: string | null;
  institution?: string | null;
  startDate?: string | null; // ISO string: '2020-01-01'
  endDate?: string | null;
  isCurrent?: boolean | null;
  country?: string | null;
  studyArea?: string | null;
  studyType?: string | null;
  status?: string | null;
  description?: string | null;
  gpa?: number | null;
  honors?: string | null;
}

export interface ExtractedExperience {
  position?: string | null;
  company?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  isCurrent?: boolean | null;
  description?: string | null;
  companyCountry?: string | null;
  jobArea?: string | null;
  companyActivity?: string | null;
  experienceLevel?: "JUNIOR" | "SEMISENIOR" | "SENIOR" | null;
}

export interface ExtractedCVData {
  fullName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  postalCode?: string | null;

  linkedInUrl?: string | null;
  githubUrl?: string | null;
  portfolioUrl?: string | null;
  websiteUrl?: string | null;

  resumeTitle?: string | null;
  professionalDescription?: string | null;
  skills?: string[];

  education?: ExtractedEducation[];
  experiences?: ExtractedExperience[];
}
