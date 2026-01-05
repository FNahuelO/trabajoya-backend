import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Servicio para hacer el sistema ATS-friendly
 * Maneja normalización de datos, exportación en formatos estándar, etc.
 */
@Injectable()
export class AtsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Normalizar habilidades/keywords para parsing por ATS
   * Convierte variaciones a términos estándar
   */
  normalizeSkills(skills: string[]): string[] {
    if (!skills || skills.length === 0) return [];

    // Diccionario de normalización de habilidades comunes
    const skillNormalization: Record<string, string> = {
      // Tecnologías
      js: "JavaScript",
      javascript: "JavaScript",
      ts: "TypeScript",
      typescript: "TypeScript",
      react: "React",
      reactjs: "React",
      "react.js": "React",
      "react native": "React Native",
      reactnative: "React Native",
      rn: "React Native",
      node: "Node.js",
      nodejs: "Node.js",
      "node.js": "Node.js",
      vue: "Vue.js",
      vuejs: "Vue.js",
      "vue.js": "Vue.js",
      angular: "Angular",
      next: "Next.js",
      nextjs: "Next.js",
      "next.js": "Next.js",
      python: "Python",
      java: "Java",
      csharp: "C#",
      "c#": "C#",
      cpp: "C++",
      "c++": "C++",
      html: "HTML",
      html5: "HTML5",
      css: "CSS",
      css3: "CSS3",
      sql: "SQL",
      nosql: "NoSQL",
      mongodb: "MongoDB",
      postgresql: "PostgreSQL",
      postgres: "PostgreSQL",
      mysql: "MySQL",
      git: "Git",
      github: "GitHub",
      docker: "Docker",
      kubernetes: "Kubernetes",
      k8s: "Kubernetes",
      aws: "AWS",
      azure: "Azure",
      gcp: "Google Cloud",
      "google cloud": "Google Cloud",

      // Habilidades blandas
      "trabajo en equipo": "Trabajo en equipo",
      "trabajo en grupo": "Trabajo en equipo",
      liderazgo: "Liderazgo",
      comunicación: "Comunicación",
      "resolución de problemas": "Resolución de problemas",
      "gestión de proyectos": "Gestión de proyectos",
      "project management": "Gestión de proyectos",
    };

    const normalized: string[] = [];
    const seen = new Set<string>();

    for (const skill of skills) {
      if (!skill || !skill.trim()) continue;

      const trimmed = skill.trim();
      const lower = trimmed.toLowerCase();

      // Buscar normalización
      const normalizedSkill = skillNormalization[lower] || trimmed;

      // Evitar duplicados
      const normalizedLower = normalizedSkill.toLowerCase();
      if (!seen.has(normalizedLower)) {
        seen.add(normalizedLower);
        normalized.push(normalizedSkill);
      }
    }

    return normalized.sort();
  }

  /**
   * Generar perfil en formato JSON-LD (schema.org/Person)
   * Compatible con sistemas ATS que usan structured data
   */
  async generateJsonLdProfile(postulanteId: string) {
    const profile = await this.prisma.postulanteProfile.findUnique({
      where: { id: postulanteId },
      include: {
        user: { select: { email: true } },
        experiences: { orderBy: { startDate: "desc" } },
        education: { orderBy: { startDate: "desc" } },
        certifications: { orderBy: { issueDate: "desc" } },
      },
    });

    if (!profile) {
      throw new Error("Perfil no encontrado");
    }

    // Construir JSON-LD según schema.org/Person
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "Person",
      name: profile.fullName,
      email: profile.user?.email,
      telephone: profile.phone,
      address: {
        "@type": "PostalAddress",
        addressLocality: profile.city,
        addressRegion: profile.province,
        addressCountry: profile.country,
        postalCode: profile.postalCode,
        streetAddress: profile.address,
      },
      jobTitle: profile.resumeTitle,
      description: profile.professionalDescription,
      url: profile.websiteUrl || profile.portfolioUrl,
      sameAs: [
        profile.linkedInUrl,
        profile.githubUrl,
        profile.portfolioUrl,
      ].filter(Boolean),
      alumniOf: profile.education.map((edu) => ({
        "@type": "EducationalOrganization",
        name: edu.institution,
        address: {
          "@type": "PostalAddress",
          addressCountry: edu.country,
        },
      })),
      knowsAbout: this.normalizeSkills(profile.skills),
      hasCredential: profile.certifications.map((cert) => ({
        "@type": "EducationalOccupationalCredential",
        credentialCategory: cert.name,
        recognizedBy: {
          "@type": "Organization",
          name: cert.issuer,
        },
        dateIssued: cert.issueDate,
        validUntil: cert.expirationDate,
      })),
      workLocation: {
        "@type": "City",
        name: profile.city,
      },
    };

    // Agregar experiencia laboral
    if (profile.experiences && profile.experiences.length > 0) {
      jsonLd["worksFor"] = profile.experiences.map((exp) => ({
        "@type": "Organization",
        name: exp.company,
        jobTitle: exp.position,
        startDate: exp.startDate,
        endDate: exp.endDate,
        description: exp.description,
      }));
    }

    return jsonLd;
  }

  /**
   * Generar perfil en formato HR-XML (estándar para ATS)
   */
  async generateHrXmlProfile(postulanteId: string) {
    const profile = await this.prisma.postulanteProfile.findUnique({
      where: { id: postulanteId },
      include: {
        user: { select: { email: true } },
        experiences: { orderBy: { startDate: "desc" } },
        education: { orderBy: { startDate: "desc" } },
        certifications: { orderBy: { issueDate: "desc" } },
      },
    });

    if (!profile) {
      throw new Error("Perfil no encontrado");
    }

    // Construir XML en formato HR-XML simplificado
    const xmlParts: string[] = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<Resume xmlns="http://ns.hr-xml.org/2007-04-15">',
      "<CandidateProfile>",
      `<PersonName><GivenName>${this.escapeXml(
        profile.fullName.split(" ")[0]
      )}</GivenName><FamilyName>${this.escapeXml(
        profile.fullName.split(" ").slice(1).join(" ")
      )}</FamilyName></PersonName>`,
      `<ContactMethod><InternetEmailAddress>${this.escapeXml(
        profile.user?.email || ""
      )}</InternetEmailAddress></ContactMethod>`,
      profile.phone
        ? `<ContactMethod><Telephone><FormattedNumber>${this.escapeXml(
            profile.phone
          )}</FormattedNumber></Telephone></ContactMethod>`
        : "",
      profile.address
        ? `<PostalAddress><AddressLine>${this.escapeXml(
            profile.address
          )}</AddressLine><Municipality>${this.escapeXml(
            profile.city || ""
          )}</Municipality><Region>${this.escapeXml(
            profile.province || ""
          )}</Region><PostalCode>${this.escapeXml(
            profile.postalCode || ""
          )}</PostalCode><CountryCode>${this.escapeXml(
            profile.country || ""
          )}</CountryCode></PostalAddress>`
        : "",
      "</CandidateProfile>",
    ];

    // Experiencia laboral
    if (profile.experiences && profile.experiences.length > 0) {
      xmlParts.push("<EmploymentHistory>");
      profile.experiences.forEach((exp) => {
        xmlParts.push(
          "<EmployerOrg>",
          `<EmployerOrgName>${this.escapeXml(exp.company)}</EmployerOrgName>`,
          "<PositionHistory>",
          `<Title>${this.escapeXml(exp.position)}</Title>`,
          `<StartDate><AnyDate>${this.formatDateForXml(
            exp.startDate
          )}</AnyDate></StartDate>`,
          exp.endDate
            ? `<EndDate><AnyDate>${this.formatDateForXml(
                exp.endDate
              )}</AnyDate></EndDate>`
            : exp.isCurrent
            ? `<EndDate><AnyDate>Present</AnyDate></EndDate>`
            : "",
          exp.description
            ? `<Description>${this.escapeXml(exp.description)}</Description>`
            : "",
          "</PositionHistory>",
          "</EmployerOrg>"
        );
      });
      xmlParts.push("</EmploymentHistory>");
    }

    // Educación
    if (profile.education && profile.education.length > 0) {
      xmlParts.push("<EducationHistory>");
      profile.education.forEach((edu) => {
        xmlParts.push(
          "<SchoolOrInstitution>",
          `<School>${this.escapeXml(edu.institution)}</School>`,
          `<Degree>${this.escapeXml(edu.degree)}</Degree>`,
          `<StartDate><AnyDate>${this.formatDateForXml(
            edu.startDate
          )}</AnyDate></StartDate>`,
          edu.endDate
            ? `<EndDate><AnyDate>${this.formatDateForXml(
                edu.endDate
              )}</AnyDate></EndDate>`
            : edu.isCurrent
            ? `<EndDate><AnyDate>Present</AnyDate></EndDate>`
            : "",
          edu.studyArea
            ? `<Major>${this.escapeXml(edu.studyArea)}</Major>`
            : "",
          "</SchoolOrInstitution>"
        );
      });
      xmlParts.push("</EducationHistory>");
    }

    // Habilidades
    if (profile.skills && profile.skills.length > 0) {
      const normalizedSkills = this.normalizeSkills(profile.skills);
      xmlParts.push("<Qualifications>");
      normalizedSkills.forEach((skill) => {
        xmlParts.push(
          `<Competency><Name>${this.escapeXml(skill)}</Name></Competency>`
        );
      });
      xmlParts.push("</Qualifications>");
    }

    // Certificaciones
    if (profile.certifications && profile.certifications.length > 0) {
      xmlParts.push("<LicensesAndCertifications>");
      profile.certifications.forEach((cert) => {
        xmlParts.push(
          "<LicenseOrCertification>",
          `<Name>${this.escapeXml(cert.name)}</Name>`,
          `<IssuingAuthority>${this.escapeXml(cert.issuer)}</IssuingAuthority>`,
          `<IssueDate>${this.formatDateForXml(cert.issueDate)}</IssueDate>`,
          cert.expirationDate
            ? `<ExpirationDate>${this.formatDateForXml(
                cert.expirationDate
              )}</ExpirationDate>`
            : "",
          cert.credentialId
            ? `<LicenseNumber>${this.escapeXml(
                cert.credentialId
              )}</LicenseNumber>`
            : "",
          "</LicenseOrCertification>"
        );
      });
      xmlParts.push("</LicensesAndCertifications>");
    }

    xmlParts.push("</Resume>");

    return xmlParts.filter((part) => part !== "").join("\n");
  }

  /**
   * Generar perfil en formato JSON estructurado para ATS
   */
  async generateAtsJsonProfile(postulanteId: string) {
    const profile = await this.prisma.postulanteProfile.findUnique({
      where: { id: postulanteId },
      include: {
        user: { select: { email: true, updatedAt: true } },
        experiences: { orderBy: { startDate: "desc" } },
        education: { orderBy: { startDate: "desc" } },
        certifications: { orderBy: { issueDate: "desc" } },
      },
    });

    if (!profile) {
      throw new Error("Perfil no encontrado");
    }

    const fullNameParts = profile.fullName.split(" ");
    const firstName = fullNameParts[0] || "";
    const lastName = fullNameParts.slice(1).join(" ") || "";

    return {
      // Información personal
      personal: {
        firstName,
        lastName,
        fullName: profile.fullName,
        email: profile.user?.email,
        phone: profile.phone,
        alternatePhone: profile.alternatePhone,
        address: {
          street: profile.address,
          city: profile.city,
          state: profile.province,
          zip: profile.postalCode,
          country: profile.country,
        },
        dateOfBirth: profile.birthDate,
        nationality: profile.nationality,
        linkedInUrl: profile.linkedInUrl,
        portfolioUrl: profile.portfolioUrl,
        websiteUrl: profile.websiteUrl,
        githubUrl: profile.githubUrl,
      },

      // Perfil profesional
      professional: {
        title: profile.resumeTitle,
        summary: profile.professionalDescription,
        employmentStatus: profile.employmentStatus,
        minimumSalary: profile.minimumSalary,
        availability: profile.employmentStatus,
      },

      // Experiencia laboral
      workExperience: profile.experiences.map((exp) => ({
        position: exp.position,
        company: exp.company,
        location: exp.companyCountry || profile.country,
        startDate: exp.startDate,
        endDate: exp.endDate,
        isCurrent: exp.isCurrent,
        description: exp.description,
        industry: exp.companyActivity,
        jobArea: exp.jobArea,
        experienceLevel: exp.experienceLevel,
        peopleInCharge: exp.peopleInCharge,
      })),

      // Educación
      education: profile.education.map((edu) => ({
        degree: edu.degree,
        institution: edu.institution,
        location: edu.country,
        fieldOfStudy: edu.studyArea,
        startDate: edu.startDate,
        endDate: edu.endDate,
        isCurrent: edu.isCurrent,
        gpa: edu.gpa,
        honors: edu.honors,
        description: edu.description,
      })),

      // Habilidades
      skills: {
        raw: profile.skills,
        normalized: this.normalizeSkills(profile.skills),
      },

      // Certificaciones
      certifications: profile.certifications.map((cert) => ({
        name: cert.name,
        issuer: cert.issuer,
        issueDate: cert.issueDate,
        expirationDate: cert.expirationDate,
        credentialId: cert.credentialId,
        credentialUrl: cert.credentialUrl,
        description: cert.description,
      })),

      // Idiomas
      languages: profile.languages || [],

      // Metadatos
      metadata: {
        cvUrl: profile.cvUrl,
        videoUrl: profile.videoUrl,
        updatedAt: profile.user?.updatedAt || new Date(),
        profileCompleteness: this.calculateProfileCompleteness(profile),
      },
    };
  }

  /**
   * Calcular completitud del perfil para ATS
   */
  private calculateProfileCompleteness(profile: any): number {
    const fields = [
      profile.fullName,
      profile.user?.email,
      profile.phone,
      profile.city,
      profile.country,
      profile.resumeTitle,
      profile.professionalDescription,
      profile.experiences?.length > 0,
      profile.education?.length > 0,
      profile.skills?.length > 0,
      profile.cvUrl,
    ];

    const filledFields = fields.filter(Boolean).length;
    return Math.round((filledFields / fields.length) * 100);
  }

  /**
   * Helper para escapar XML
   */
  private escapeXml(unsafe: string): string {
    if (!unsafe) return "";
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * Helper para formatear fecha para XML
   */
  private formatDateForXml(date: Date | string): string {
    if (!date) return "";
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toISOString().split("T")[0]; // YYYY-MM-DD
  }

  /**
   * Actualizar habilidades normalizadas del perfil
   */
  async updateNormalizedSkills(postulanteId: string) {
    const profile = await this.prisma.postulanteProfile.findUnique({
      where: { id: postulanteId },
      select: { skills: true },
    });

    if (!profile) {
      throw new Error("Perfil no encontrado");
    }

    const normalizedSkills = this.normalizeSkills(profile.skills);

    await this.prisma.postulanteProfile.update({
      where: { id: postulanteId },
      data: { normalizedSkills },
    });

    return normalizedSkills;
  }
}
